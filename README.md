# Vrumm Backend

Monorepo scaffold for the Vrumm ride-hailing platform (Phase 1).

## Workspace layout

```
Vrummm-Backend/
├── apps/
│   └── api/          — Express REST + Socket.IO server
└── packages/
    ├── contracts/    — shared error codes, socket events, API shapes
    ├── validation/   — shared Zod schemas
    └── ui-tokens/    — design tokens placeholder
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | LTS recommended |
| npm | 9+ | workspaces support required |
| MongoDB | 6+ | must run as a **replica set** (transactions) |
| MinIO | latest | S3-compatible local object storage |

---

## 1 — MongoDB replica set initialisation

Vrumm uses MongoDB **transactions**, which require a replica set even in local development.

```bash
# Start mongod with replica set config (first time only)
mongod --replSet rs0 --dbpath ./data/db --port 27017 --bind_ip 127.0.0.1

# In another terminal, initialise the replica set
mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"

# Verify
mongosh --eval "rs.status()"
```

> **Tip:** Once initialised, a plain `mongod --replSet rs0` is sufficient on subsequent starts.

---

## 2 — MinIO setup

```bash
# macOS/Linux
minio server ./data/minio --console-address ":9001"

# Windows (PowerShell)
minio.exe server .\data\minio --console-address ":9001"
```

Create the required bucket (one-time):

```bash
# Using mc (MinIO Client)
mc alias set local http://127.0.0.1:9000 minioadmin minioadmin
mc mb local/vrumm-documents
```

---

## 3 — Environment variables

```bash
cp .env.example .env
# Edit .env with your values (JWT secrets etc.)
```

---

## 4 — Install dependencies

```bash
npm install
```

This installs dependencies for all workspaces in one command.

---

## 5 — Run the API server

```bash
# Development (auto-reload)
npm run dev --workspace=apps/api

# Production
npm start --workspace=apps/api
```

---

## 6 — Lint & format

```bash
npm run lint        # ESLint across all workspaces
npm run format      # Prettier across all workspaces
```

---

## 7 — Tests

```bash
npm test            # Runs tests in all workspaces
```

---

## Environment variable reference

See [.env.example](.env.example) for the full list with descriptions.

---

## Architecture notes

- **Storage provider** — swap `STORAGE_PROVIDER=local` for dev without MinIO.  
- **Maps provider** — `MAPS_PROVIDER=mock` returns deterministic fake data for Mumbai coordinates.  
- **Money** — all monetary values are stored and computed in integer **paise** (1 INR = 100 paise). Helper functions are in `apps/api/src/utils/money.js`.
