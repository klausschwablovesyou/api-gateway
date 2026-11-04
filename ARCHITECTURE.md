# Architecture

This document describes how the API Gateway is built internally: process startup, the module layout, the request-forwarding algorithm, IP binding, realtime messaging, persistence, security, the frontend, and the known gaps. For setup and usage see [README.md](README.md).

## 1. System overview

```
                 ┌─────────────────────────────────────────────────────────┐
                 │  Host (Linux, network_mode: host, CAP_NET_ADMIN)        │
                 │                                                         │
  Browser ──────▶│  Angular admin UI  (static files served by the backend) │
   (JWT)         │        │ /api/*  (REST)        │ /realtime (WebSocket)  │
                 │        ▼                       ▼                        │
                 │  ┌───────────────────────────────────────────────┐      │
  API client ───▶│  │  Deno + Danet backend  (backend/main.ts)      │      │
  GET /api/gateway  │   auth · gateway · api-manager · ip-manager   │      │
  + key + HMAC   │  │   config-manager · realtime · request-log     │      │
                 │  └───────┬──────────────────────┬────────────────┘      │
                 │          │ SQL (pool)           │ `ip addr add/del`     │
                 │          ▼                      ▼                       │
                 │     PostgreSQL          Network interface (eth0, …)     │
                 │                           IP1  IP2  IP3 …               │
                 └─────────────────────────────┬───────────────────────────┘
                                               │ fetch() bound to local IPn
                                               ▼
                                         Target API (rate-limited per IP)
```

Three kinds of traffic reach the backend:

| Traffic | Path | Authentication |
|---------|------|----------------|
| Admin UI REST calls | `/api/*` | JWT in `Authorization: Bearer`, enforced by the global `RolesGuard` |
| Admin UI realtime | `/realtime` (WebSocket) | JWT sent in the `Subscribe` message |
| External API clients | `GET /api/gateway` | Per-API public key + HMAC-SHA256 signature |

## 2. Process startup

Entry point: [backend/main.ts](backend/main.ts). The order matters because later steps depend on earlier ones.

1. **File logger** is created and `console.*` is patched before anything else logs.
1. **`.env`** is loaded from `../.env` (repository root) if it exists.
2. **Migrations** run through `MigrationRunner`. Failure is logged but does not abort startup.
3. **Danet application** is initialized with `AppModule`; the HTTP router gets the `/api` base path. WebSocket controllers are not affected by this prefix, which is why the realtime endpoint is `/realtime`, not `/api/realtime`.
5. The `RealtimeService` instance is handed to the file logger so log lines can be broadcast.
5. **IP sync**: unless `SYNC_IPS_ON_STARTUP=false`, every IP in the database is added to the default interface.
6. **Static assets** are registered after the API routes so `/api/*` wins. Path: `../client/dist/client/browser` in development, `../public` in production.
7. **SPA fallback** middleware: any non-`/api` request that would 404 gets `index.html` instead.
9. The server listens on `0.0.0.0:PORT` (default 3000).

## 3. Backend module layout

The backend follows the NestJS pattern that Danet provides: modules declare controllers and injectables, and constructor injection wires them together. Every module that touches the database lists `PostgresService` in its own injectables, so each module gets its own pool instance rather than a shared singleton.

| Module | Controller base path | Responsibility | Key collaborators |
|--------|----------------------|----------------|-------------------|
| `AuthModule` | `/api/auth` | Login, registration | `AuthService`, `UserRepository`, `JwtService`, `PasswordService`, `ConfigManagerService` |
| `GatewayModule` | `/api/gateway` | Request forwarding | `GatewayService`, `ApiRepository`, `IpRepository`, `IpUsageRepository`, `ApiKeyService`, `RequestLogRepository`, `RealtimeService` |
| `ApiManagerModule` | `/api/api-manager` | CRUD for API definitions, key generation | `ApiManagerService`, `ApiKeyService` |
| `IpManagerModule` | `/api/ip-manager` | CRUD for the IP pool, network sync | `IpManagerService`, `IpSyncService` |
| `ConfigManagerModule` | `/api/config` | Key/value settings (`enableRegistration`) | `ConfigRepository` |
| `RealtimeModule` | `/realtime` (WS) | Client registry and broadcast | `RealtimeService`, `JwtService` |
| `RequestLogModule` | `/api/request-log` | Read access to failed gateway calls | `RequestLogRepository` |

Shared code lives under [backend/src/shared/](backend/src/shared/):

- `database/` – `PostgresService` (pool + retry) and `MigrationRunner`.
- `repositories/` – one class per table, hand-written parameterized SQL, snake_case columns aliased to camelCase.
- `services/` – `JwtService`, `PasswordService`, `ApiKeyService`, `IpSyncService`, `CryptoService` (unused).
- `guards/` + `decorators/` – `RolesGuard` (registered globally) and `@Roles()` / `@Authenticated()`.
- `filters/` – `HttpExceptionFilter` turns `HttpException` into `{ statusCode, message }` JSON; `RedirectExceptionFilter` handles `RedirectException`.
- `logger/` – `FileLoggerService`.

The [shared/](shared/) directory at the repository root is imported by both the backend (`@shared/` import map in `backend/deno.json`) and the frontend (`@shared/*` path alias in `client/tsconfig.json`). It holds the DTOs, models and enums, so request/response shapes are defined once.

## 4. Gateway request flow

Implemented in [gateway.service.ts](backend/src/modules/gateway/gateway.service.ts). The controller accepts only `GET` and requires `apiName` (query), `x-api-public-key` and `x-api-signature` (headers); anything missing is a 400.

```
GET /api/gateway?apiName=X&…        headers: x-api-public-key, x-api-signature
        │
        ▼
 1. ApiRepository.findByName(X)                      → 404 if missing
 2. api.publicKey === header                         → 401 if not
 3. HMAC-SHA256(apiName, base64decode(privateKey))   → 401 if signature differs
 4. pick an available IP (see §5)                    → 429 if none
 5. build URL: replace {placeholders}, remaining params → query (GET/DELETE) or JSON body (POST/PUT/PATCH)
 6. fetch() with Deno.createHttpClient({ localAddress: ip })
 7. on success: update ip_usage counter for (ip, api)
 8. return JSON passthrough, or { data: text } for non-JSON
        │
        └─ on any error: insert request_logs row, notify SuperAdmins (RequestError), rethrow
```

Details worth knowing:

- **Signature scheme**: the private key is stored base64-encoded; it is decoded to raw bytes and used as the HMAC key. The message is the UTF-8 `apiName`. The result is base64. Comparison is a plain string equality, so the scheme has no replay protection and is not constant-time.
- **Placeholders**: `{name}` segments in the stored URL are replaced with `encodeURIComponent(param)`. Parameters that match a placeholder are removed from the remaining set.
- **Outbound client**: a fresh `Deno.HttpClient` with `localAddress` is created per attempt and closed in `finally` (the close is wrapped in its own `try` so it cannot mask the original error).
- **Retry**: if the first attempt fails with a broken-connection error (`EPIPE`, `ECONNRESET`, "BrokenPipe", "connection closed", "Connection reset") a second attempt is made with a new client. HTTP errors from the target (non-2xx) are not retried; they are rethrown as `HttpException` with the target's status.
- **Usage accounting happens only on success.** A failed forward does not consume quota.
- **Error logging**: every failure, including 4xx validation failures before an IP was chosen, is written to `request_logs` with whatever `apiId` / `ipId` were known at that point, then a `RequestError` notification (no payload) is pushed to SuperAdmin sockets.

## 5. IP selection and rate limiting

State lives in the `ip_usage` table, one row per `(ip_id, api_id)`:

| Column | Meaning |
|--------|---------|
| `last_used_at` | Epoch ms of the last successful forward |
| `request_limit_counter` | Number of successful forwards in the window that contains `last_used_at` |

Windows are **calendar-aligned** in the server's local time zone: for unit `minute` the window starts at `hh:mm:00`, for `day` at local midnight, and so on (`_getPeriodStart`).

Selection (`_getAvailableIp`):

1. Load all IPs.
2. For each IP load its usage row for this API.
   - No row → available.
   - Row's window is older than the current window → available (counter is stale).
   - Row is in the current window and `counter < requestLimit` → available.
   - Otherwise exhausted; skip.
3. Pick one of the available IPs **uniformly at random**. If none, the gateway answers 429.

Update after success (`_updateIpUsage`): insert `(now, 1)` if there is no row; upsert `(now, 1)` if the stored window is older; otherwise upsert `(now, counter + 1)`.

Consequences:

- Random choice means load is not strictly balanced, but over time each IP gets similar traffic.
- Read-then-write is not atomic. Two concurrent requests can both see `counter = limit - 1` and both go through, overshooting by the degree of concurrency. There is an `incrementCounter` SQL in the repository that would be atomic, but the service does not use it.
- Deleting an IP or API cascades to `ip_usage`, so counters disappear with their parent. `regenerateKeys` deletes and re-creates the API row, which resets all counters for that API and changes its `id`.

## 6. IP binding on the host

[ip-sync.service.ts](backend/src/shared/services/ip-sync.service.ts) makes the operating system own the addresses that the gateway later binds to.

- **Interface detection** (Linux): `ip route show default` → regex `dev <iface>`, cached for the process lifetime; fallback `eth0`. On Windows the interface is hard-coded to `Loopback Pseudo-Interface 1`.
- **Add**: `ip addr add <ip>/32 dev <iface>`, for IPv6 `<ip>/128` (Windows: `netsh interface ip add address <iface> <ip> 255.255.255.255`). "File exists" / "Address already assigned" is treated as success with status `already-exists`.
- **Remove**: `ip addr del <ip>/32 dev <iface>`, for IPv6 `<ip>/128`; "Cannot assign requested address" counts as already removed.
- **Sync all** (`syncIpsToNetwork`): adds every IP from the database sequentially, then **verifies** by parsing `ip -o addr show` and marking each result `verified: true|false` (`null` on Windows or if the listing fails). A result counts as failed if the add failed or verification is false. This catches silent failures such as a missing `NET_ADMIN` capability. The same routine runs at startup and behind `POST /api/ip-manager/sync` (the **Re-sync** button on the IPs page).
- **Lifecycle hooks**: `IpManagerService` calls add on create, remove+add on update when the address changes, and remove on delete. The database write happens regardless of whether the OS command succeeded.

Binding an address to the interface is enough for `Deno.createHttpClient({ localAddress })` to send from it, provided the provider routes return traffic for that address to this host. Policy routing (`ip rule` / separate route tables) was tried and removed as unnecessary.

Because of this feature the container needs `network_mode: host` (so the addresses land on the real interface) and `cap_add: [NET_ADMIN]` (so `ip addr` is permitted). The Dockerfile installs `iproute2` and runs as root.

## 7. Realtime channel

Endpoint: WebSocket at `/realtime`. Message envelope in both directions: `{ "topic": RealtimeTopic, "data": any }`.

| Topic | Direction | Payload | Emitted by |
|-------|-----------|---------|------------|
| `Subscribe` | client → server | `{ token }` (JWT) | Client right after `onopen` |
| `ConsoleLog` | server → SuperAdmin | `LogEntry { id, timestamp, level, message }` | `FileLoggerService` for every `console.*` call |
| `RequestError` | server → SuperAdmin | none | `GatewayService` on any failed forward |
| `MemoryUsage` | server → SuperAdmin | heap/RSS plus estimates | `RealtimeService._startMemoryBroadcast` (never started, see [Known gaps](#known-gaps)) |

Server side (`RealtimeService`) keeps `Map<userId, Set<{ socket, userRole }>>`. Three send primitives exist: `notifyClients(userId, …)`, `notifyByRole(role, …)`, `broadcast(…)`. Sockets are removed on `close`. If the `Subscribe` token is missing or invalid the socket is closed with code 4001 / 4002.

Client side (`client/src/app/services/realtime.service.ts`) is a single root-provided service with topic listeners, reconnect after 3 s on close, and a `WebSocket` URL derived from `window.location` (`ws:` or `wss:`). Pages that need it (`/admin/logs`, `/admin/request-errors`, `/admin/memory`) call `connect()` in `ngOnInit` and `disconnect()` in `ngOnDestroy`.

`RequestError` is deliberately notify-only: the request-errors page reacts by fetching the latest 50 rows over REST and merging unseen ids into its list (capped at 500), which keeps the socket payload tiny and the data source single.

## 8. Logging

`FileLoggerService` is constructed before `.env` is loaded and before Danet starts. It replaces `console.log/info/warn/debug/error` with wrappers that:

1. call the original method,
2. append `[ISO timestamp] [LEVEL] message` to `logs/app-YYYY-MM-DD.log` (errors also to `logs/error-YYYY-MM-DD.log`),
3. push a `LogEntry` into an in-memory ring of the last 100 entries,
4. broadcast it to SuperAdmin sockets as `ConsoleLog` once the realtime service is attached.

File names are computed once at construction, so a long-running process keeps writing to the start day's file. The in-memory buffer is not exposed over HTTP; the logs page only sees lines emitted after it connected.

## 9. Persistence

### Pool and retries

`PostgresService` wraps a `@db/postgres` `Pool` (size `DB_POOL_SIZE`, default 10) and exposes `query`, `queryOne`, `execute` and `transaction`. Every call goes through `_withRetry`: a pooled client is taken, the callback runs, the client is released. If the first attempt fails with a broken-connection error (`EPIPE`, `ECONNRESET`, "BrokenPipe", "Connection closed", "connection is closed") it is retried once with a fresh client. This recovers from idle connections that the server or a NAT closed.

### Migrations

`MigrationRunner` reads every `*.sql` and `*.ts` file in [backend/src/shared/database/migrations/](backend/src/shared/database/migrations/), sorts by file name, and runs each one that is not yet recorded in the `migrations` table for the current `APP_NAME`. A `.ts` migration default-exports `async (client) => void` and is used when SQL alone is not enough (environment variables, bcrypt hashing). Each migration runs inside a transaction together with its bookkeeping insert; a migration that throws is rolled back, stays pending, and stops the runner so later migrations wait for it. There is no down migration.

`011_seed_initial_superadmin.ts` creates the first SuperAdmin from `INITIAL_SUPERADMIN_USERNAME` / `_EMAIL` / `_PASSWORD` when no `superadmin` user exists, validating the password with `PasswordService`. If a SuperAdmin already exists it does nothing.

### Schema

```
users          id UUID PK · username UNIQUE · email UNIQUE · password (bcrypt)
               user_role VARCHAR DEFAULT 'User' · access_token TEXT · created_at · updated_at (trigger)

apis           id UUID PK · name UNIQUE · api_url VARCHAR(2048) · method VARCHAR(10) DEFAULT 'GET'
               public_key VARCHAR(512) · private_key VARCHAR(512)
               request_limit INT · request_limit_unit ENUM(second|minute|hour|day)

ips            id UUID PK · ip VARCHAR(45)

ip_usage       id UUID PK · ip_id → ips (CASCADE) · api_id → apis (CASCADE)
               last_used_at BIGINT (epoch ms) · request_limit_counter INT DEFAULT 0
               UNIQUE (ip_id, api_id)

config         key VARCHAR PK · value TEXT            (seeded: enableRegistration = 'true')

request_logs   id UUID PK · api_id → apis (SET NULL) · ip_id → ips (SET NULL)
               error_message TEXT · status_code INT · occurred_at BIGINT (epoch ms), indexed DESC

migrations     id · app · name · executed_at · UNIQUE (app, name)
```

Notes:

- The `users.user_role` column default is the capitalized `'User'`, but the application enum uses lowercase values and `UserRepository.create` always writes `'user'` explicitly, so rows created through the app are consistent. Manual inserts should use lowercase.
- `ips.ip` is not unique at the database level; uniqueness is enforced in `IpManagerService` before insert.
- `users.access_token` exists in the schema and repository but no code path sets it.
- Timestamps that the application compares (`last_used_at`, `occurred_at`) are epoch milliseconds stored as `BIGINT`; the driver returns them as `bigint`, which is why the service wraps them in `Number()`.

## 10. Authentication and authorization

### Users

- Passwords are hashed with bcrypt (10 rounds). Registration validates length ≥ 6, lowercase, uppercase, digit and special character; error strings are i18n keys (`Auth.Validation.*`) that the frontend translates.
- `POST /api/auth/login` returns `{ success, token, user }` with `password` and `email` blanked on the user object. The JWT (HS256, `@cross/jwt`) carries `userId`, `userRole`, `email`, `iat`, `exp` and expires after 24 hours. There is no refresh flow; the client logs in again.
- Registration is gated by the `enableRegistration` config row (403 when disabled).
- `AuthService` throws `HttpError` from an old Oak module (fetched from a raw GitHub URL) rather than Danet's `HttpException`. The `HttpExceptionFilter` therefore does not format these; they still produce the right status because the thrown object carries `status`.

### Role-based access

`@Roles(...)` writes a `roles` metadata key onto a handler or controller class; `@Authenticated()` is shorthand for all roles (any logged-in user). `RolesGuard` is registered as `GLOBAL_GUARD` in `AppModule`, so Danet runs it before every route. It looks up roles on the handler first, then on the class. With no roles it allows the request. Otherwise it validates the Bearer token (missing or invalid token: 401), attaches `request.user`, and compares the role (mismatch: 403). On WebSocket connect Danet calls the global guard without a handler, and the guard treats that as public; `/realtime` authenticates through its own `Subscribe` message.

Routes are public by default, so a new admin endpoint without `@Roles` / `@Authenticated` is exposed.

### External API clients

Authentication is per API definition: public key equality plus HMAC-SHA256 over the API name with the private key (§4). Keys are 32 random bytes each, base64-encoded, generated by `ApiKeyService.generateKeyPair()`. Regeneration replaces both keys.

### Frontend

`AuthGuard` checks for a stored token, `RoleGuard` checks `route.data.roles` against the cached user, `DefaultRouteGuard` sends SuperAdmins to `/admin/logs` and everyone else to `/dashboard`. `JwtInterceptor` adds the Bearer header to every request whose URL starts with `/api/`. The token is kept in `localStorage` under `authToken`; the user object is held in memory by `UserManager`, so a page reload keeps the token but loses the user until the next login (role-gated pages then redirect).

## 11. Frontend architecture

Angular 20 with standalone components, lazy-loaded routes and `OnPush` change detection everywhere. UI kit is Nebular (theme `cyberpunk`) with Eva icons. Translations are loaded from `assets/i18n/{en,hu}.json` via ngx-translate.

Layers under [client/src/app/](client/src/app/):

- `modules/api/` – a small HTTP framework: `ApiClientService` (typed GET/POST/PUT/PATCH/DELETE/blob/file helpers), `ApiRequestDecoratorService` (progress indicator, toast messages, error mapping via `config/api-message-exceptions.ts`), `ApiStatesService` and `ApiProgressIndicator*`. Everything is bound through injection tokens in `app.config.ts` so implementations can be swapped (there is a stub client for tests).
- `managers/` – feature-level services that pages talk to: `AuthManager`, `UserManager`, `ApiManagerService`, `IpManagerService`, `ConfigManagerService` (+ states), `RequestLogManagerService`. They wrap the API client and hold state (ngx-states / signals).
- `pages/` – route components. Notable ones: `apis/` with an editor dialog and a code-example dialog (Python and Rust templates rendered as Angular templates), `ips/` with editor and the re-sync action that displays per-IP `verified` status, `admin/logs` and `admin/request-errors` as live-updating lists, `admin/memory` for the (currently silent) memory feed.
- `layout/` – Nebular sidebar + menu, built dynamically from the current user's role.
- `guards/`, `interceptors/`, `validators/` – routing and HTTP cross-cutting concerns.

`APP_INITIALIZER` loads `/api/config` before the first route renders so the register link can be hidden when registration is disabled. A service worker (`ngsw-config.json`) is registered in production builds only.

Development proxy (`proxy.config.json`) forwards `/api` and `/realtime` (with WebSocket upgrade) to `localhost:3000`.

## 12. Deployment

The [Dockerfile](Dockerfile) is a two-stage build:

1. `node:22-alpine` installs client dependencies and runs `ng build`.
2. `denoland/deno:2.6.3` installs `iproute2`, copies `backend/`, `shared/` and the root `deno.json`, copies the built frontend to `/app/public`, caches dependencies and runs `deno task start` from `/app/backend` as root with `DENO_ENV=production`.

[docker-compose.yml](docker-compose.yml) runs that image with host networking, `NET_ADMIN`, the environment passed through from `.env`, a bind mount for `backend/logs`, `restart: unless-stopped` and a Coolify label (TLS termination is expected from the surrounding reverse proxy).

Because the container shares the host network namespace, the port the backend listens on is directly the host port, and `ip addr add` modifies the host's interface.

## 13. Resilience and failure modes

| Situation | Behaviour |
|-----------|-----------|
| Database unreachable at startup | Migrations fail, warning logged, server still starts; every later query will error |
| Stale pooled connection | One automatic retry with a new client |
| Stale keep-alive towards target API | One automatic retry with a new `HttpClient` |
| Target API returns 4xx/5xx | Same status returned to caller, logged to `request_logs`, no retry, no quota consumed |
| `ip addr add` fails (for example no `NET_ADMIN`) | IP row is still saved; sync result reports `failed` / `verified: false`; forwards from that IP fail with "Cannot assign requested address" |
| All IPs exhausted | 429 until the next calendar window |
| WebSocket drops | Client reconnects every 3 s and re-subscribes with the stored token |
| Log file not writable | Error printed with the original console method, application continues |

## Known gaps

These are verified against the current code and should be addressed before relying on the system in a hostile environment.

1. **Memory feed never starts.** `_startMemoryBroadcast` is private and has no caller; `setTelegramStatsProvider` / `setDbConnectionCount` are leftovers from the Telegram bot project the service was copied from. Either call the broadcast from the constructor or remove the memory page.
2. **Rate limiting is best-effort under concurrency** (§5). Switching the success path to the existing atomic `incrementCounter` SQL, or doing the check-and-increment in one statement, would close the race.
3. **Static signature.** The HMAC covers only the API name, so a captured header pair can be replayed indefinitely. Adding a timestamp or nonce to the signed message, and using a constant-time comparison, would strengthen it.
4. **Verbose gateway logging** prints the received public key and signature on every call, which ends up in log files and on the admin log stream.
5. **`regenerateKeys` changes the API id** and drops usage counters because it deletes and re-inserts rather than updating the key columns.
6. **Leftovers and dead code**: `CryptoService` and `ENCRYPTION_SECRET` are unused; `users.access_token` is never written; the backend package is named `@telegrambot/backend`; `APP_NAME` defaults to `telegrambot`; the root task `dev:production:debug` references a missing npm script; `AuthService` depends on an Oak `HttpError` fetched from a raw GitHub URL instead of Danet's `HttpException`.
7. **Log file date is fixed at startup**; a process that runs across midnight keeps appending to the previous day's file.
