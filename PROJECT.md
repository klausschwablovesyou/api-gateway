# API Gateway — Project Documentation

## Áttekintés

Kérés-továbbító rendszer, amely HTTP requesteket irányít át elérhető IP-k között, kérés-limite-k (rate limit) betartásával IP/API kombinációnként.

**Stack:**
- **Backend**: Deno + Danet (NestJS-szerű framework)
- **Frontend**: Angular 20 (standalone components, OnPush)
- **Adatbázis**: PostgreSQL (connection pool, automata migrációk)
- **Deploy**: Docker Compose, `network_mode: host`, `CAP_NET_ADMIN`

---

## Könyvtárszerkezet

```
api-gateway/
├── backend/
│   ├── main.ts                          # Bootstrap (migráció, logger, realtime)
│   └── src/
│       ├── app.module.ts                # Gyökér modul
│       ├── modules/
│       │   ├── auth/                    # Bejelentkezés, regisztráció
│       │   ├── gateway/                 # Kérés-továbbítás (fő logika)
│       │   ├── api-manager/             # API CRUD
│       │   ├── ip-manager/              # IP CRUD + hálózati szinkron
│       │   ├── config-manager/          # Alkalmazásbeállítások
│       │   ├── realtime/                # WebSocket szerver
│       │   └── request-log/             # Hibás kérések lekérdezése
│       └── shared/
│           ├── database/
│           │   ├── postgres.service.ts  # Pool + retry logic
│           │   ├── migration-runner.ts  # Automata SQL migrációk
│           │   └── migrations/          # 000–010 SQL fájlok
│           ├── repositories/            # Adatelérési réteg
│           ├── services/                # JwtService, PasswordService, ApiKeyService, IpSyncService
│           ├── guards/                  # RolesGuard (JWT validáció)
│           ├── decorators/              # @Roles()
│           ├── filters/                 # Exception filter
│           └── types/                   # UserRole, HttpMethod, stb.
├── client/
│   └── src/app/
│       ├── pages/                       # Login, Register, Dashboard, Apis, Ips, Admin/*
│       ├── managers/                    # AuthManager, ApiManager, IpManager, stb.
│       ├── modules/api/                 # HTTP kliens framework
│       ├── guards/                      # AuthGuard, RoleGuard
│       ├── interceptors/                # JwtInterceptor
│       └── layout/                      # Sidebar + navigáció
├── shared/                              # Backend + Frontend közös kód
│   ├── dtos/                            # Request/Response DTO-k
│   ├── models/                          # Domain modellek
│   └── types/                           # Közös enum-ok
├── docker-compose.yml
└── .env.example
```

---

## Adatbázis séma

| # | Tábla | Tartalom |
|---|-------|----------|
| 000 | migrations | Futtatott migrációk nyilvántartása |
| 001 | users | Felhasználók (username, email, password hash, role) |
| 002 | ips | IP-cím pool (`ip VARCHAR(45)`) |
| 003 | apis | API definíciók (url, method, limit, limit_unit) |
| 004 | users | `access_token` oszlop hozzáadása |
| 005 | apis | `name`, `public_key`, `private_key` hozzáadása |
| 006 | ip_usage | Kérésszám nyilvántartás IP/API páronként |
| 007 | apis | `method` (HTTP metódus enum) hozzáadása |
| 008 | ip_usage | `request_limit_counter` hozzáadása |
| 009 | config | Kulcs-érték konfig (`enableRegistration`) |
| 010 | request_logs | Hibás gateway kérések naplózása |

**Fontos mezők:**

```sql
-- apis
id UUID, name VARCHAR, api_url VARCHAR(2048), method http_method,
public_key TEXT, private_key TEXT, request_limit INT, request_limit_unit request_limit_unit

-- ip_usage
ip_id UUID → ips.id, api_id UUID → apis.id,
last_used_at BIGINT (ms epoch), request_limit_counter INT

-- request_logs
api_id UUID → apis.id (ON DELETE SET NULL),
ip_id UUID → ips.id (ON DELETE SET NULL),
error_message TEXT, status_code INT, occurred_at BIGINT (ms epoch)
```

---

## Modulok

### Auth (`/api/auth`)
| Végpont | Leírás |
|---------|--------|
| `POST /login` | JWT token generálás (24h lejárat) |
| `POST /register` | Fiók létrehozása (jelszó erősség validáció) |

Jelszó szabályok: min 6 karakter, nagybetű, kisbetű, szám, speciális karakter.

---

### Gateway (`/api/gateway`) — fő logika

**Kérés flow** (`gateway.service.ts`):
1. API keresése névvel → 404 ha nem létezik
2. Public key egyezés ellenőrzése → 401
3. Signature validáció (HMAC-SHA256 of `apiName` with `privateKey`) → 401
4. Elérhető IP kiválasztása (rate limit figyelembevételével)
5. URL összeállítása: `{param}` helyőrzők lecserélése, maradék GET param / body
6. `fetch()` küldése `Deno.createHttpClient({ localAddress })` segítségével
7. Sikernél: IP usage frissítése
8. Hibánál: `request_logs`-ba mentés + SuperAdmin WebSocket értesítés

**IP kiválasztás logika:**
- Lekér minden IP-t a DB-ből
- Minden IP-hez lekéri az `ip_usage` rekordot az adott API-hoz
- Ha az aktuális időszak (second/minute/hour/day) még nem telt el ÉS a counter elérte a limitet → kihagyja
- Az elérhetők közül véletlenszerűen választ

**Retry logic** (BrokenPipe esetén):
- HTTP kérés: max 2 kísérlet, új `Deno.HttpClient`-tel
- DB query: max 2 kísérlet, új pool connection-nel

---

### API Manager (`/api/api-manager`)
| Végpont | Leírás |
|---------|--------|
| `POST /` | Létrehozás, automatikus kulcspár generálás |
| `GET /` | Lista |
| `GET /:id` | Egy API adatai |
| `PUT /:id` | Módosítás |
| `DELETE /:id` | Törlés |
| `POST /:id/regenerate-keys` | Kulcsok újragenerálása |

---

### IP Manager (`/api/ip-manager`) — csak SuperAdmin

| Végpont | Leírás |
|---------|--------|
| `POST /` | IP hozzáadása + `ip addr add <ip>/32 dev <iface>` |
| `GET /` | Lista |
| `PUT /:id` | Módosítás + régi eltávolítás, új hozzáadás |
| `DELETE /:id` | Törlés + `ip addr del <ip>/32 dev <iface>` |
| `POST /sync` | Az összes DB-beli IP újraszinkronizálása (ugyanaz, mint induláskor) + visszaellenőrzés |

**IpSyncService** — induláskor (`SYNC_IPS_ON_STARTUP=true`) az összes DB-beli IP-t hozzáadja a hálózati interfészhez. Ugyanez futtatható bármikor a `POST /api/ip-manager/sync` végponttal (IP-k oldal → „Újraszinkronizálás" gomb).

A szinkron végén `ip -o addr show` alapján visszaellenőrzi, mely címek vannak ténylegesen bindolva (`verified` mező) — így a némán elbukó `ip addr add` (pl. hiányzó `NET_ADMIN`) is látszik.

Hálózati interfész detektálás: `ip route show default` → `dev <iface>` regex. Fallback: `eth0`.

Windows-on: `netsh interface ip add/delete address`.

---

### Config Manager (`/api/config`)
| Végpont | Jogosultság | Leírás |
|---------|-------------|--------|
| `GET /` | Publikus | `enableRegistration` flag |
| `PUT /` | SuperAdmin | Frissítés |

---

### Realtime (`WS /api/realtime`)

WebSocket szerver, JWT-vel hitelesített feliratkozással.

**Témák (RealtimeTopic):**
| Topic | Leírás |
|-------|--------|
| `Subscribe` | Csatlakozáskor küldött JWT token |
| `MemoryUsage` | Szerver memória stats (5s-onként) |
| `ConsoleLog` | Alkalmazás logok (minden szint) |
| `RequestError` | Gateway kérés hibája (notify-only, az adatot a kliens kéri le) |

Broadcast metódusok:
- `notifyClients(userId, topic, data)` — egy felhasználóhoz
- `notifyByRole(role, topic, data)` — szerepkörönként (pl. SuperAdmin)
- `broadcast(topic, data)` — mindenkinek

---

### Request Log (`/api/request-log`) — csak SuperAdmin

`GET /api/request-log?limit=100&offset=0` — hibás kérések lapozva, `occurred_at DESC` sorrendben.

---

## Shared Services

### PostgresService
- `Pool` (default 10 connection)
- `query<T>()`, `queryOne<T>()`, `execute()`, `transaction()`
- BrokenPipe / EPIPE / ECONNRESET esetén automatikus retry (1×)

### JwtService
- `generateToken(payload)` — HS256, 24h lejárat
- `verifyToken(token)` — dekódolás + validáció
- `extractUserFromToken(token)` — userId, userRole, email

### ApiKeyService
- `generateKeyPair()` — véletlenszerű base64 public/private kulcs
- `generateSignature(apiName, privateKey)` — HMAC-SHA256
- `validateSignature(apiName, signature, privateKey)` — ellenőrzés

### IpSyncService
- Platform detektálás (`Deno.build.os === 'windows'`)
- Linux: `ip addr add/del <ip>/32 dev <iface>`
- Windows: `netsh interface ip add/delete address`
- "Already exists" / "Already removed" hibák gracefully kezelve

### FileLoggerService
- `console.*` metódusok felülírása
- Naplófájl: `logs/app-YYYY-MM-DD.log`
- Max 100 bejegyzés buffer (admin UI-hoz)
- SuperAdmin-oknak WebSocket broadcast

---

## Shared Types

| Típus | Értékek |
|-------|---------|
| `UserRole` | `SuperAdmin`, `Admin`, `Moderator`, `User` |
| `HttpMethod` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `RequestLimitUnit` | `second`, `minute`, `hour`, `day` |
| `RealtimeTopic` | `Subscribe`, `MemoryUsage`, `ConsoleLog`, `RequestError` |
| `HttpStatusCode` | Teljes HTTP status kód enum (100–511) |
| `JwtPayload` | `{ userId, userRole, email, iat, exp }` |

---

## Frontend (Angular 20)

**Oldalak:**
| Oldal | Útvonal | Jogosultság |
|-------|---------|-------------|
| Login | `/login` | Publikus |
| Register | `/register` | Publikus (ha engedélyezve) |
| Dashboard | `/dashboard` | User+ |
| APIs | `/apis` | User+ |
| IPs | `/ips` | SuperAdmin |
| Admin Logs | `/admin/logs` | SuperAdmin |
| Admin Request Errors | `/admin/request-errors` | SuperAdmin |
| Admin Config | `/admin/config` | SuperAdmin |
| Admin Memory | `/admin/memory` | SuperAdmin |

**Managerek** (service + HTTP):
- `AuthManager` — token tárolás, login/register/logout
- `ApiManager` — CRUD + kulcs műveletek
- `IpManager` — CRUD
- `ConfigManager` — konfig lekérés/mentés
- `RequestLogManager` — hibánaplók lekérése

**RequestErrorsComponent**: WebSocket `RequestError` topic-ra feliratkozik, értesítéskor GET-el lekéri a legújabb bejegyzéseket, deduplikál id alapján, max 500 elemet tart.

**i18n**: `hu.json` és `en.json` (ngx-translate), a menü és minden form szöveg le van fordítva.

---

## Biztonság

- **JWT**: `Authorization: Bearer <token>` header, `RolesGuard` ellenőrzi minden védett végponton
- **RBAC**: `@Roles(UserRole.SuperAdmin)` decorator a controlleren
- **Jelszó**: bcrypt, 10 kör
- **SQL**: Parameterizált lekérdezések mindenütt (injection-safe)
- **API hitelesítés**: public key + HMAC-SHA256 signature minden gateway hívásnál

---

## Deploy

**docker-compose.yml:**
```yaml
network_mode: host          # Közvetlen hálózati hozzáférés (IP binding miatt)
cap_add: [NET_ADMIN]        # ip addr add/del parancsokhoz
```

**Környezeti változók (.env.example):**

| Változó | Kötelező | Default | Leírás |
|---------|----------|---------|--------|
| `DB_HOST` | ✓ | — | PostgreSQL host |
| `DB_PORT` | ✓ | — | PostgreSQL port |
| `DB_NAME` | ✓ | — | Adatbázis neve |
| `DB_USER` | ✓ | — | DB felhasználó |
| `DB_PASSWORD` | ✓ | — | DB jelszó |
| `JWT_SECRET` | ✓ | — | Min 32 bájt |
| `PORT` | — | 3000 | HTTP szerver port |
| `DB_POOL_SIZE` | — | 10 | Connection pool méret |
| `SYNC_IPS_ON_STARTUP` | — | true | IP-k szinkronizálása induláskor |
| `ENCRYPTION_SECRET` | — | — | Titkosításhoz |

**Deno parancsok:**
```bash
deno task dev          # Fejlesztői mód (watch)
deno task dev:debug    # Inspector-ral
deno task build        # Produkciós build
deno task start        # Produkciós futtatás
```

---

## Ismert problémák / megjegyzések

- **Cloudzy floating IPs**: A `ip addr add` működik, de a kimenő forgalom (SYN) nem kap SYN-ACK visszát — ez provider-szintű routing/filtering probléma, OS-szinten nem javítható. Cloudzy supportot kell értesíteni.
- **Broken pipe retry**: Mind a DB pool, mind a HTTP kliens automatikusan újrapróbálja az idle connection utáni első hibás kérést.
- **Policy routing eltávolítva**: Az `ip rule` / `ip route table` alapú megközelítés feleslegesnek bizonyult, a sima `ip addr add/del` elegendő.
- **HttpException argumentum sorrend** (Danet): `new HttpException(statusCode: number, message: string)` — fordítva nem dobna megfelelő HTTP hibát.
- **`finally` block csapda**: Ha `client.close()` dob egy finally-ban, felülírja az eredeti hibát. Megoldás: `try { client.close(); } catch { }`.
