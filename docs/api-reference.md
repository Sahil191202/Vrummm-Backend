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

## Phase 7: Revenue Plans, Payments, Webhooks, Ledger

### Revenue Plans

#### POST /api/v1/revenue-plans

Create a new revenue plan. Admin only (`revenuePlans.write`).

- Request body:
  - `name`: string (2-100 chars)
  - `description?`: string
  - `type`: `COMMISSION` or `SUBSCRIPTION`
  - `commissionBps?`: 300 to 350 (required if COMMISSION, representing 3.00% to 3.50%)
  - `subscriptionPricePaise?`: positive integer (required if SUBSCRIPTION)
  - `subscriptionBillingPeriod?`: `DAILY`, `WEEKLY`, `MONTHLY` (default: `DAILY`)
- Response 201: Created plan document.

#### GET /api/v1/revenue-plans

List revenue plans.

- Query: `type?`, `isActive?`
- Response 200: Array of plans.

#### POST /api/v1/revenue-plans/captains/select

Captain selects or switches active revenue plan. Captain only (`CAPTAIN`).

- Request body: `{ planId, effectiveFrom? }`
- Response 201: Plan assignment record with effective dates.

#### GET /api/v1/revenue-plans/captains/my-plan

Captain views their current active plan and plan history. Captain only (`CAPTAIN`).

- Response 200: `{ currentPlan, history }`.

---

### Payments & Webhooks

#### POST /api/v1/payments/orders

Initiate payment order for a completed ride. Customer only (`CUSTOMER`).

- Authoritative payable amount is calculated server-side from `ride.fareSnapshot.totalPaise`.
- Request body: `{ rideId, provider?, idempotencyKey? }` (`provider`: `MOCK` or `RAZORPAY`)
- Response 201: `{ paymentId, providerOrderId, amountPaise, currency: "INR", keyId, provider }` (never returns secret keys).

#### POST /api/v1/payments/verify

Verify checkout signature and capture payment. Customer only (`CUSTOMER`).

- Validates cryptographic HMAC-SHA256 signature using the provider abstraction.
- On valid signature: atomically sets payment to `CAPTURED`, posts balanced entries to append-only ledger, and credits captain earnings.
- Request body: `{ paymentId, providerPaymentId, providerSignature }`
- Response 200: Captured payment record.

#### POST /api/v1/payments/webhook

Inbound webhook from payment provider.

- Signature validated against unparsed raw request body using provider secret.
- Atomically deduplicates event IDs to prevent duplicate processing.
- Handles `payment.captured`, `order.paid`, and `payment.failed`.
- Response 200: `{ received: true }`.

#### POST /api/v1/payments/:paymentId/refund/simulate

Simulate refund for a captured payment. Admin only (`payments.refund.simulate`).

- No real Razorpay refund API call is made.
- Records `REFUNDED_SIMULATED`, posts adjustment ledger entries, and audit logs the action with required reason.
- Request body: `{ reason }` (minimum 5 chars).
- Response 200: Refunded payment record.

---

### Ledger (Append-Only)

#### GET /api/v1/ledger/entries

Query immutable, append-only financial ledger entries. Admin only (`payments.read`).

- Query: `accountType?`, `accountUserId?`, `rideId?`, `entryType?`, `page`, `limit`
- Response 200: Array of entries with pagination meta.

#### GET /api/v1/ledger/balance

Get aggregated credit/debit balance.

- Captain returns own earnings balance.
- Finance/Admin can pass `accountUserId` and `accountType`.
- Response 200: `{ accountUserId, accountType, balancePaise, balanceRupees }`.

#### POST /api/v1/ledger/adjustments

Post manual adjustment entry. Admin only (`payments.read`).

- Corrections are strictly append-only (never edits or deletes existing entries).
- Request body: `{ accountUserId, accountType, direction, amountPaise, reason, description }`
- Response 201: Created adjustment entry.

#### POST /api/v1/ledger/payouts/simulate

Simulate captain earnings payout withdrawal. Captain only (`CAPTAIN`).

- Checks available balance and posts simulated payout debit.
- Request body: `{ amountPaise, idempotencyKey? }`
- Response 201: Payout ledger entry.

---

## Phase 8: Promotions, Incentives, Safety, and Admin Reports

### Promotions

#### POST /api/v1/promotions/validate

Validate a promo code for a booking. Authenticated customers.

- Request body: `{ code, farePaise, vehicleType? }`
- Response 200: `{ valid: true, discountPaise, finalFarePaise, promotion }`

#### GET /api/v1/promotions

List promotions with pagination. Admin only (`promotions.read`).

- Query: `isActive?`, `page`, `limit`
- Response 200: Paginated list of promotions.

#### POST /api/v1/promotions

Create promotion campaign. Admin only (`promotions.write`).

- Request body: `{ code, title, description?, discountType, discountValue, maxDiscountPaise?, minFarePaise?, usageLimitTotal?, usageLimitPerUser?, isFirstRideOnly?, startsAt, expiresAt }`
- Response 201: Created promotion object.

#### GET /api/v1/promotions/:promotionId

Get promotion details. Admin only (`promotions.read`).

#### PATCH /api/v1/promotions/:promotionId/toggle

Activate or deactivate promotion. Admin only (`promotions.write`).

---

### Incentives

#### GET /api/v1/incentives/my-awards

List captain's earned incentive awards. Captain only.

- Response 200: Array of awards with total earned paise.

#### POST /api/v1/incentives/evaluate

Evaluate captain progress towards an incentive campaign. Captain only.

- Request body: `{ campaignId, completedRidesCount, peakRidesCount?, periodKey }`
- Response 200: `{ qualified, reason, award? }`. If newly qualified, atomically records award with idempotent key and credits captain ledger account.

#### GET /api/v1/incentives

List incentive campaigns. Authenticated users.

- Query: `targetType?`, `isActive?`, `page`, `limit`

#### POST /api/v1/incentives

Create incentive campaign. Admin only (`promotions.write`).

- Request body: `{ title, description?, targetType, rewardPaise, requiredRidesCount, vehicleTypes?, startsAt, expiresAt }`
- Response 201: Created incentive campaign.

#### GET /api/v1/incentives/:campaignId

Get incentive campaign details.

#### PATCH /api/v1/incentives/:campaignId/toggle

Toggle active state. Admin only (`promotions.write`).

---

### Safety & Support

#### GET /api/v1/safety/trip-share/:token

Public real-time trip tracking endpoint. No authentication required.

- Response 200: Sanitized live trip snapshot (status, pickup, drop, driver first name, vehicle details, latest simulated location, share token expiry).

#### POST /api/v1/safety/trip-share

Generate expiring shareable tracking link. Customer only.

- Request body: `{ rideId, expiresInHours? }`
- Response 201: `{ token, shareUrl, expiresAt }`

#### POST /api/v1/safety/sos

Trigger emergency SOS alert. Customer or Captain.

> [!NOTE]
> SOS alerts are strictly **simulated** (`isSimulated: true`). They do not dispatch physical emergency services.

- Request body: `{ rideId, location: [longitude, latitude], reason? }`
- Emits real-time `safety:incident` socket event to ride room and `ops:dashboard`.
- Response 201: Created emergency incident record.

#### POST /api/v1/safety/incidents

Report safety incident. Authenticated users.

- Request body: `{ rideId?, incidentType, severity, description, location? }`
- Response 201: Incident record.

#### GET /api/v1/safety/incidents

List safety incidents. Operations & Support (`incidents.read`).

- Query: `rideId?`, `status?`, `severity?`, `incidentType?`, `page`, `limit`

#### PATCH /api/v1/safety/incidents/:incidentId/resolve

Resolve incident with audit note. Operations & Support (`incidents.resolve`).

- Request body: `{ resolutionNote, status? }`

#### POST /api/v1/safety/tickets

Open support ticket. Authenticated users.

- Request body: `{ category, subject, description, rideId?, priority? }`

#### GET /api/v1/safety/tickets

List tickets. Users see own tickets; Support/Ops view all (`support.read`).

#### POST /api/v1/safety/tickets/:ticketId/messages

Append message to support ticket thread.

#### PATCH /api/v1/safety/tickets/:ticketId/status

Update ticket lifecycle status. Support/Ops (`support.write`).

---

### Admin Reports

#### GET /api/v1/admin/reports/operations

Operational aggregate metrics for ride operations. Admin (`rides.read`).

- Query: `from?`, `to?` (ISO dates)
- Response 200: Total rides, breakdown by status (`COMPLETED`, `CANCELLED`, etc.), completed distance (meters), average ride duration (seconds).

#### GET /api/v1/admin/reports/financial

Financial summary with Gross Booking Value (GBV), commissions, and simulated refunds. Admin (`payments.read`).

- Query: `from?`, `to?` (ISO dates)
- Response 200: Gross booking value (paise/rupees), total platform commission, total captain earnings, simulated refunds, successful payments count.

#### GET /api/v1/admin/reports/captains/leaderboard

Captain performance leaderboard. Admin (`captains.read`).

- Query: `limit?` (1-100)
- Response 200: Top captains ranked by completed rides count.

---

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
