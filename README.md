# API Gateway

A request-forwarding service that sends incoming calls to a target API from a **source IP chosen from a pool**, while enforcing a configured request limit **per IP / API pair**. It ships with an Angular admin UI for managing APIs, IPs, settings and logs.

Internals, data flows and design notes: [ARCHITECTURE.md](ARCHITECTURE.md)

## What is it for?

When an upstream API limits calls per source IP (for example 10 requests per minute per IP), the gateway spreads traffic across several public IP addresses assigned to the server:

1. In the admin UI you register the target API (URL, HTTP method, limit, time unit). The system generates a **public/private key pair** for it.
2. You add the usable IP addresses. The backend binds them to the network interface with `ip addr add`.
3. Your client calls the gateway with `apiName` + public key + HMAC signature. The gateway picks an IP that has not exhausted its limit, forwards the request from that IP, and returns the response.

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Deno 2.x, [Danet](https://danet.land) (NestJS-style framework on top of Hono) |
| Database | PostgreSQL, automatic migrations (SQL files, plus TypeScript files for logic such as seeding) |
| Frontend | Angular 20 (standalone components, OnPush), Nebular UI, ngx-translate (en/hu), PWA service worker |
| Realtime | WebSocket (Danet `@WebSocketController`) |
| Deploy | Docker (multi-stage), docker-compose, `network_mode: host` + `NET_ADMIN` |

## Repository layout

```
api-gateway/
├── backend/            Deno + Danet backend (entry point: backend/main.ts)
│   └── src/
│       ├── modules/    auth, gateway, api-manager, ip-manager, config-manager, realtime, request-log
│       └── shared/     database (pool, migrations), repositories, services, guards, filters, logger
├── client/             Angular 20 admin UI
├── shared/             DTOs, models and enums used by both backend and frontend
├── deno.json           Root tasks (install, dev, build, start)
├── Dockerfile          Multi-stage build: Angular build → Deno runtime
└── docker-compose.yml  Host networking + NET_ADMIN capability
```

## Prerequisites

- Deno 2.x (the Docker image uses `denoland/deno:2.6.3`)
- Node.js 22 + npm (frontend build only)
- PostgreSQL 13+ (needed for `gen_random_uuid()`)
- Linux with `iproute2` to actually bind IPs to the interface (on Windows `netsh` is used on the loopback interface)

## Quick start (development)

```bash
# 1. Environment variables
cp .env.example .env
#    → fill in DB_*, JWT_SECRET and INITIAL_SUPERADMIN_*

# 2. Dependencies
deno task install          # backend cache + client npm install

# 3. Backend (watch mode, http://localhost:3000)
deno task dev:backend

# 4. Frontend dev server (http://localhost:4200, /api and /realtime proxied to port 3000)
deno task dev:client
```

`deno task dev` starts both. `deno task dev:debug` runs the backend with `--inspect`.

On startup the backend runs database migrations automatically. If migrations fail, the server still starts and only logs a warning.

In development the backend also serves the frontend from `client/dist/client/browser` (if built), so the whole app is reachable on port 3000 without `ng serve`.

> Note: the root task `deno task dev:production:debug` references a non-existent npm script `start:production:debug`, so it currently does not work.

### Creating the first SuperAdmin

The migration `011_seed_initial_superadmin.ts` creates the initial SuperAdmin from environment variables on first startup:

```bash
INITIAL_SUPERADMIN_USERNAME=superadmin        # optional, default: superadmin
INITIAL_SUPERADMIN_EMAIL=admin@example.com
INITIAL_SUPERADMIN_PASSWORD='Change-Me-1!'    # must satisfy the password policy
```

- If a `superadmin` user already exists, the migration does nothing and is marked as applied.
- If none exists and the variables are missing or the password is too weak, the migration fails with an explanatory log line, is **not** marked as applied, and runs again on the next startup. Migrations after it are not run until it passes.
- An existing non-SuperAdmin user with the same username or email is never promoted automatically; the migration fails instead.
- After the first successful start, remove `INITIAL_SUPERADMIN_PASSWORD` from `.env`. Changing it later has no effect.

To promote an existing user by hand instead:

```sql
UPDATE users SET user_role = 'superadmin' WHERE username = '<username>';
```

Role values are lowercase: `superadmin`, `admin`, `moderator`, `user`. Public registration is enabled by default; you can disable it under **Admin → Settings**.

## Running in production

### Docker Compose (recommended)

```bash
cp .env.example .env    # fill in values
docker compose up -d --build
```

The compose file gives the container `network_mode: host` and the `NET_ADMIN` capability. Both are required so that the backend can add IPs to the **host** interface with `ip addr add/del`, and so outgoing `fetch` calls really originate from those IPs. Logs are written to `./backend/logs`. The image contains the pre-built frontend under `/app/public`.

### Manual build

```bash
deno task build          # backend cache + Angular production build
DENO_ENV=production deno task start
```

In production mode (`DENO_ENV=production`) the backend serves static files from `../public`, so copy the Angular build output (`client/dist/client/browser`) there.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | yes | – | PostgreSQL connection |
| `JWT_SECRET` | yes | – | HS256 key, at least 32 bytes |
| `INITIAL_SUPERADMIN_EMAIL`, `INITIAL_SUPERADMIN_PASSWORD` | on first start | – | Credentials of the seeded SuperAdmin (needed only while no SuperAdmin exists) |
| `INITIAL_SUPERADMIN_USERNAME` | no | `superadmin` | Username of the seeded SuperAdmin |
| `PORT` (or `SERVER_PORT`) | no | `3000` | HTTP port, listens on `0.0.0.0` |
| `DENO_ENV` | no | development | With `production` static files are served from `../public` |
| `DB_POOL_SIZE` | no | `10` | Postgres pool size |
| `APP_NAME` | no | `telegrambot` | Name under which applied migrations are recorded in the `migrations` table |
| `SYNC_IPS_ON_STARTUP` | no | `true` | `false` skips binding IPs on startup |
| `ENCRYPTION_SECRET` | no | placeholder | Would be used by `CryptoService`, which nothing currently calls |

The backend loads `.env` from `../.env` relative to the `backend/` directory, so the file must live in the repository root.

## Calling the gateway from a client

Endpoint: `GET /api/gateway`

| What | Where | Value |
|------|-------|-------|
| `apiName` | query | The API name as registered in the admin UI |
| `x-api-public-key` | header | The API's public key |
| `x-api-signature` | header | `base64( HMAC-SHA256( key = base64decode(privateKey), msg = apiName ) )` |
| other query parameters | query | See below |

The signature depends only on `apiName` and the private key, so it is **constant** for a given API; there is no timestamp or nonce.

Handling of the other query parameters:

- If the API URL contains `{name}` placeholders (for example `https://example.com/users/{id}`), the parameter with the same name is URL-encoded and substituted.
- The remaining parameters go into the target URL's query string for `GET`/`DELETE`, and into a JSON body for `POST`/`PUT`/`PATCH`.

Response: if the target API returns `application/json`, you get it back unchanged. Otherwise you get `{ "data": "<raw text>" }`.

Error codes:

| Status | Cause |
|--------|-------|
| 400 | Missing `apiName`, public key or signature |
| 401 | Wrong public key or signature |
| 404 | No API with that name |
| 429 | Every IP has exhausted its limit in the current window (or no IPs are registered) |
| 4xx/5xx | The target API returned this status; message is `Target API returned <status>` |
| 500 | Network error towards the target (even after retry) |

Every failed gateway call is stored in the `request_logs` table and shows up immediately on the **Admin → Request errors** page.

### Example (Python, standard library)

```python
import base64, hashlib, hmac, json, urllib.parse, urllib.request

API_NAME, PUBLIC_KEY, PRIVATE_KEY = "my-api", "<public>", "<private>"
GATEWAY_URL = "https://gateway.example.com/api/gateway"

sig = base64.b64encode(
    hmac.new(base64.b64decode(PRIVATE_KEY), API_NAME.encode(), hashlib.sha256).digest()
).decode()

url = GATEWAY_URL + "?" + urllib.parse.urlencode({"apiName": API_NAME, "id": "42"})
req = urllib.request.Request(url)
req.add_header("x-api-public-key", PUBLIC_KEY)
req.add_header("x-api-signature", sig)
print(json.load(urllib.request.urlopen(req)))
```

Every API in the admin UI has a **Code example** button that produces ready-to-use Python and Rust snippets with the keys filled in.

## HTTP API overview

All endpoints live under the `/api` prefix. Send the JWT in the `Authorization: Bearer <token>` header.

| Path | Methods | Description |
|------|---------|-------------|
| `/api/auth/login`, `/api/auth/register` | POST | Login, registration (if enabled). JWT is valid for 24 hours |
| `/api/gateway` | GET | Request forwarding (see above) |
| `/api/api-manager` | GET, POST; `/:id` GET, PUT, DELETE; `/:id/regenerate-keys` POST | API definitions |
| `/api/ip-manager` | GET, POST; `/:id` GET, PUT, DELETE; `/sync` POST | IP pool + network sync |
| `/api/config` | GET (public), PUT | `enableRegistration` setting |
| `/api/request-log?limit=&offset=` | GET | Failed gateway calls, newest first |
| `/realtime` | WebSocket | Console logs, request-error notifications (JWT-based subscription) |

### Authorization

`RolesGuard` is registered globally (`GLOBAL_GUARD` in `AppModule`) and enforces the `@Roles(...)` metadata on the controller method or class:

| Endpoints | Required |
|-----------|----------|
| `/api/auth/*`, `/api/gateway`, `/api/config` GET | public (the gateway uses its own key + HMAC check) |
| `/api/api-manager/*` | any logged-in user (`@Authenticated()`) |
| `/api/ip-manager/*`, `/api/config` PUT, `/api/request-log` | `superadmin` |

A missing, invalid or expired token returns **401**; a valid token without the required role returns **403**. Routes without `@Roles` / `@Authenticated` are public, so every new admin endpoint must be annotated.

## Admin UI

| Page | Route | Who |
|------|-------|-----|
| Login / Register | `/login`, `/register` | everyone |
| Dashboard | `/dashboard` | logged in |
| APIs | `/apis` | logged in |
| IPs (+ Re-sync button) | `/ips` | SuperAdmin (menu entry shown only to them) |
| Admin → Logs | `/admin/logs` | SuperAdmin |
| Admin → Request errors | `/admin/request-errors` | SuperAdmin |
| Admin → Settings | `/admin/config` | SuperAdmin |
| Admin → Memory | `/admin/memory` | SuperAdmin (currently receives no data, see below) |

Languages: English and Hungarian (`client/public/assets/i18n`). Default: English.

## Logging

The backend patches the `console.*` methods, so every log line goes to the console, to `backend/logs/app-YYYY-MM-DD.log`, for errors additionally to `error-YYYY-MM-DD.log`, and over WebSocket to connected SuperAdmin clients. The gateway writes verbose debug logs for every call, including the incoming public key and signature.

## Useful commands

| Command | What it does |
|---------|--------------|
| `deno task dev` / `dev:backend` / `dev:client` | Development startup |
| `deno task build` | Backend cache + Angular build |
| `deno task start` | Production backend startup |
| `cd backend && deno task kill` | Stops the running `main.ts` process (via `/proc`, Linux only) |
| `deno task test` | All unit tests: `test:backend`, then `test:client` |
| `cd backend && deno task test` | Backend unit tests (`deno test`, files named `*.test.ts`). They need no database or network access to the targets |
| `cd client && npm test` | Angular unit tests in watch mode (Karma + Jasmine, files named `*.spec.ts`) |
| `cd client && npm run test:ci` | Angular unit tests once, in headless Chrome |

Never place a test file in `backend/src/shared/database/migrations/`, because `MigrationRunner` executes every `.ts` file in that directory.

### Post-commit test hook

`.githooks/post-commit` runs `deno task test` after every commit. Enable it once per clone:

```sh
git config core.hooksPath .githooks
```

The hook runs after the commit is created, so a test failure cannot prevent the commit. It prints an error, and the commit has to be amended or reset by hand. The tests run against the working tree, so uncommitted changes affect the result.

## Known issues

- **Memory page is empty**: nothing calls `RealtimeService._startMemoryBroadcast()`, so `MemoryUsage` messages are never sent.
- **Key regeneration = delete + re-create**: the API gets a new `id`, and its `ip_usage` counters are removed by cascade.
- **Rate limiting is not atomic**: the counter is read and written in separate queries, so concurrent calls can exceed the limit.
- **Floating IPs at some providers** (for example Cloudzy): `ip addr add` succeeds but outgoing SYNs get no SYN-ACK; this is provider-side routing. The `verified` field of **IPs → Re-sync** shows which addresses are really bound to the interface.
- **Telegram-bot leftovers**: the backend package name (`@telegrambot/backend`), the `APP_NAME` default and the `CryptoService` salt come from an earlier project; they do not affect behaviour.
