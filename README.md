# Vrumm

Ride-hailing **learning project** inspired by Rapido, modelled on Mumbai.
It is **not legally authorised for commercial transport**. Live rides, real payments and real payouts are off, and the app refuses to start if you turn them on. Having a setting or field in the code does not mean the product is legally compliant.

## Status

| Phase  | Scope                                      | State            |
| ------ | ------------------------------------------ | ---------------- |
| 1      | Foundation                                 | Done (this repo) |
| 2      | Auth, sessions, RBAC, audit, rate limiting | Next             |
| 3 to 9 | See the build prompt                       | Not started      |

## Layout

```
apps/api                 Express API (modular monolith)
packages/contracts       Error codes, response envelopes, socket event names
packages/validation      Shared Zod schemas (paise, GeoJSON point, ids, pagination)
packages/ui-tokens       Placeholder only
docs/api-reference.md    Endpoint reference
```

Inside `apps/api/src`: `config/` (env, logger), `db/` (Mongo), `middleware/`, `shared/` (AppError, respond), `modules/<name>/` (routes, controller, service; repositories and schemas arrive with the first module that needs them).

## Setup (npm + MongoDB Atlas)

1. Install Node 22.12 or newer.
2. Create a free Atlas cluster. Add a database user. Allow your current IP only (avoid `0.0.0.0/0`). Copy the SRV connection string. Atlas clusters are replica sets, so transactions work.
3. Run:
   ```
   npm install
   cp apps/api/.env.example apps/api/.env   # then edit MONGODB_URI
   npm run dev
   ```
4. Check: `curl localhost:4000/api/v1/health` and `curl localhost:4000/api/v1/health/ready`

## Commands

| Command                           | What it does                             |
| --------------------------------- | ---------------------------------------- |
| `npm run dev`                     | Start API with file watching             |
| `npm start`                       | Start API                                |
| `npm run lint`                    | ESLint                                   |
| `npm run format` / `format:check` | Prettier                                 |
| `npm test`                        | All workspace tests (Vitest + Supertest) |
| `npm run check`                   | Lint + format check + tests              |

## Environment variables (`apps/api/.env`)

| Name                    | Default               | Notes                                                                 |
| ----------------------- | --------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`              | development           | development, test or production                                       |
| `PORT`                  | 4000                  |                                                                       |
| `LOG_LEVEL`             | info                  |                                                                       |
| `MONGODB_URI`           | none, required        | `mongodb://` or `mongodb+srv://`. Never logged.                       |
| `MONGODB_DB_NAME`       | vrumm                 |                                                                       |
| `CORS_ORIGINS`          | http://localhost:3000 | Comma-separated exact origins. No wildcard. https only in production. |
| `LIVE_RIDES_ENABLED`    | false                 | Must stay false                                                       |
| `REAL_PAYMENTS_ENABLED` | false                 | Must stay false                                                       |
| `REAL_PAYOUTS_ENABLED`  | false                 | Must stay false                                                       |

The app checks all of these at startup and exits with a clear message if something is wrong. The message names the variable, never the value.

## Versions used (installed in Phase 1)

Node 22, Express 5.3, Mongoose 9.11, Zod 4.6, Helmet 8.3, cors 2.8, Pino 10.4, Vitest 5.0, Supertest 7.3, ESLint 10, Prettier 3.9.

## Conventions

- Success: `{ "success": true, "data": ..., "meta"?: ..., "requestId": "..." }`
- Error: `{ "success": false, "error": { "code", "message", "details"? }, "requestId": "..." }`
- Clients switch on `error.code`. Codes and statuses live in `packages/contracts`.
- Status codes: 400 bad input, 401 not logged in, 403 not allowed, 404 missing, 409 conflicting state, 413 body too large, 422 business-rule violation, 429 rate limited, 503 not ready.
- Every response has an `X-Request-Id` header. A client id is accepted only if it matches `[A-Za-z0-9._-]{8,64}`.
- Money is integer paise. Dates are UTC. GeoJSON is `[longitude, latitude]`.
- Logs are JSON, one line per request. Query strings are never logged. Authorization headers, cookies and fields named password, pin, token, secret or otp are redacted.

## Assumptions made in Phase 1

- Atlas replaces the Docker Compose replica set in the spec. A compose file can be added later if you want offline dev.
- JavaScript with ES modules, npm workspaces, Vitest.
- `.env` is loaded with Node's built-in `process.loadEnvFile` (no dotenv package).
- Body limit is 100 KB. The Razorpay webhook route (Phase 7) must be mounted before the JSON parser with a raw-body parser.
- Rate limiting, auth and RBAC are Phase 2, so nothing here is protected yet. Do not deploy this.

## Not done yet (planned in Phase 9)

Backup and recovery notes, data retention and deletion policy, security review, full API docs.
