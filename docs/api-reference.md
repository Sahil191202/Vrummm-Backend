# API reference

Base path: `/api/v1`. All responses use the envelopes described in the README.
Phase 1 has two endpoints. Both are public.

## GET /api/v1/health

Liveness. Confirms the process is running. Does not touch the database.

- Auth: none. Permission: none.
- Request: no body, no query.
- Response 200:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "service": "vrumm-api",
      "version": "0.1.0",
      "uptimeSeconds": 12,
      "time": "2026-10-22T11:30:00.000Z"
    },
    "requestId": "..."
  }
  ```
- Errors: none expected.
- Side effects: none.

## GET /api/v1/health/ready

Readiness. Confirms MongoDB answers a ping within 2 seconds.

- Auth: none. Permission: none.
- Response 200: `data: { "status": "ok", "checks": { "database": "up" } }`
- Response 503: `error.code = "SERVICE_UNAVAILABLE"`, `error.details.checks.database = "down"`
- Side effects: one `ping` to MongoDB.

## Errors that can happen on any route

| Status | Code              | When                                                                  |
| ------ | ----------------- | --------------------------------------------------------------------- |
| 400    | BAD_REQUEST       | Body is not valid JSON                                                |
| 400    | VALIDATION_ERROR  | Zod validation failed. `details` is a list of `{ in, path, message }` |
| 404    | NOT_FOUND         | Unknown route                                                         |
| 413    | PAYLOAD_TOO_LARGE | Body over 100 KB                                                      |
| 500    | INTERNAL_ERROR    | Unexpected failure. Generic message, details only in server logs      |

---

## Phase 2: Auth endpoints

All auth endpoints are public (no token required) except where noted.

### POST /api/v1/auth/register

Create a new account. Public callers can only create `CUSTOMER` accounts.
Admin roles can pass any `role` if they include a valid Bearer token.

- Rate limit: 5 requests per IP per hour.
- Request body: `{ email, password, displayName?, phone?, role? }`
  - `email`: valid email address.
  - `password`: 8–72 characters.
  - `phone`: E.164 format, e.g. `+919876543210`.
  - `role`: defaults to `CUSTOMER`. Only admin callers can set other roles.
- Response 201: `data: { userId, email, role }`
- Errors: 400 VALIDATION_ERROR, 409 CONFLICT (email taken), 403 FORBIDDEN (non-admin trying an admin role)

### POST /api/v1/auth/login

- Rate limit: 10 requests per IP per 15 minutes.
- Request body: `{ email, password }`
- Response 200: `data: { accessToken, refreshToken, user: { id, email, role, displayName } }`
- Errors: 401 UNAUTHENTICATED (wrong credentials), 422 BUSINESS_RULE_VIOLATION (account locked)
- Account locks for 15 minutes after 5 consecutive failed attempts.

### POST /api/v1/auth/refresh

Exchange a refresh token for a new access+refresh pair (rotation: the old refresh token is immediately revoked).

- Rate limit: 30 requests per IP per 15 minutes.
- Request body: `{ refreshToken }`
- Response 200: `data: { accessToken, refreshToken }`
- Errors: 401 UNAUTHENTICATED

### POST /api/v1/auth/logout

Revoke the current session. Requires Bearer token.

- Auth: required.
- Response 200: `data: { message }`

### POST /api/v1/auth/logout-all

Revoke all sessions for the current user. Requires Bearer token.

- Auth: required.
- Response 200: `data: { message }`

### GET /api/v1/auth/me

Return the current user's profile.

- Auth: required.
- Response 200: `data: { _id, email, role, displayName, phone, isActive, createdAt }`
- Errors: 401 UNAUTHENTICATED, 404 NOT_FOUND

---

## Seed accounts (development only)

Default password for all seed accounts: `Vrumm@Dev2026!` — change before any shared deployment.

| Email                | Role        |
| -------------------- | ----------- |
| superadmin@vrumm.dev | SUPER_ADMIN |
| ops@vrumm.dev        | OPERATIONS  |
| support@vrumm.dev    | SUPPORT     |
| finance@vrumm.dev    | FINANCE     |
| marketing@vrumm.dev  | MARKETING   |
| compliance@vrumm.dev | COMPLIANCE  |
| customer1@vrumm.dev  | CUSTOMER    |
| captain1@vrumm.dev   | CAPTAIN     |

Run seed once: `node apps/api/src/modules/auth/seed.js`
