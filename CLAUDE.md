# Hato TMS — AI Context File

> Read this file before touching any code. It covers everything you need to vibe code immediately.

---

## What This Project Is

A **Translation Management System** for Hato Hub (Thai fintech). It manages TH/EN translation keys across multiple platforms (LINE Shopping, Line OA, LIFF apps, etc.). Teams create/edit keys in the web UI, review changes via a CR workflow, then export JSON/CSV for each app to consume.

**Users:** Developers (manage keys), Translators (fill values), Admins (manage users, publish CRs).
**Clients of the exported keys:** Mobile apps, LIFF apps, Figma designs (via a plugin).

---

## Monorepo Structure

```
/
├── apps/
│   ├── api/               # Express 4 + TypeScript — REST API
│   │   └── src/
│   │       ├── index.ts           # App entry, route mounts
│   │       ├── middleware/
│   │       │   ├── auth.ts        # JWT verify + X-API-Token + requireRole()
│   │       │   └── errorHandler.ts
│   │       ├── routes/            # Route handlers — business logic lives here
│   │       │   ├── auth.ts        # /api/v1/auth/*
│   │       │   ├── keys.ts        # /api/v1/keys/*
│   │       │   ├── namespaces.ts  # /api/v1/namespaces/*
│   │       │   ├── changeRequests.ts # /api/v1/change-requests/*
│   │       │   ├── coverage.ts    # /api/v1/coverage/*
│   │       │   ├── users.ts       # /api/v1/users/*
│   │       │   └── import-export.ts # /api/v1/import-export/*
│   │       └── services/          # ALL Prisma calls live here (not in routes)
│   │           ├── keyService.ts
│   │           ├── changeRequestService.ts
│   │           ├── namespaceService.ts
│   │           ├── authService.ts
│   │           ├── userService.ts
│   │           ├── coverageService.ts
│   │           ├── importExportService.ts
│   │           ├── auditService.ts  # logAudit() helper
│   │           └── cacheService.ts  # Redis TTL cache (graceful no-op if unavailable)
│   │
│   ├── web/               # React 18 + Vite + Ant Design 5 — SPA
│   │   └── src/
│   │       ├── pages/     # One file per page/drawer
│   │       ├── services/
│   │       │   └── api.ts # All API calls (axios), token management, auto-refresh
│   │       └── main.tsx
│   │
│   └── figma-plugin/      # Figma Plugin (esbuild) — reads keys via X-API-Token
│
├── packages/
│   ├── db/
│   │   └── prisma/schema.prisma  # Source of truth for DB schema
│   ├── shared/
│   │   └── src/index.ts  # DTOs, enums (AuditAction, Platform, KeyStatus, CRStatus)
│   └── cli/              # hato-tms CLI (Commander.js) — push/pull keys via API
│
├── .env.example          # All required env vars documented here
├── MIGRATION.md          # Firebase migration plan (future work)
└── docker-compose.yml    # PostgreSQL + Redis for local dev
```

---

## Tech Stack (exact versions)

| Layer | Tech | Version |
|---|---|---|
| Runtime | Node.js | ≥ 18 |
| API framework | Express | 4.21 |
| ORM | Prisma | 6.3 |
| Database | PostgreSQL (Supabase hosted in prod) | - |
| Cache | Redis via ioredis | 5.4 |
| Auth | JWT (jsonwebtoken) | 9.0 |
| API types | zod | 3.24 |
| Frontend | React | 18.3 |
| UI library | Ant Design | 5.22 |
| Data fetching | TanStack React Query | 5.62 |
| Router | React Router | 7.1 |
| Build (web) | Vite | 6 |
| Build (API) | tsx watch (dev), tsc (prod) | - |
| Test | Vitest | 2.0 |
| Package manager | npm workspaces | npm 10.2 |

---

## How to Run

```bash
# 1. Start database + redis
docker compose up -d

# 2. Install deps (from repo root)
npm install

# 3. Run DB migrations + seed
npx prisma migrate dev --schema packages/db/prisma/schema.prisma
npm run db:seed

# 4. Start API (port 4000)
npm run dev:api

# 5. Start web (port 3000, proxies /api → :4000)
npm run dev:web
```

**Required `.env` file at `apps/api/.env`:**
```
DATABASE_URL=postgresql://hato:hato_dev@localhost:5432/hato_tms
DIRECT_URL=postgresql://hato:hato_dev@localhost:5432/hato_tms
JWT_SECRET=any-long-random-string-here
REDIS_URL=redis://localhost:6379
PORT=4000
NODE_ENV=development
```

> If Redis is unavailable, the app continues without caching — it degrades gracefully.
> `JWT_SECRET` is required at startup; the API will throw and refuse to start without it.

---

## Architecture: The Service Layer Pattern

**Rule:** Route files contain business logic. Service files contain Prisma calls. Never the other way around.

```
routes/keys.ts          — pagination logic, diff computation, response shaping
    ↓ calls
services/keyService.ts  — prisma.translationKey.findMany(...), etc.
```

**Why this matters:** The service files are the only thing that needs to change in a database migration (e.g., to Firestore). Route files stay untouched.

**All 7 service files are complete.** Zero `prisma` imports exist in any route file.

> **Exception:** `middleware/auth.ts` still imports `prisma` directly for API token lookup and user resolution — it is not a route file and predates the service layer. `services/auditService.ts` also imports `prisma` directly (it is itself a service). Both are acceptable.

When adding a new feature:
1. Add the Prisma query to the relevant service file as an exported async function
2. Call it from the route file
3. Never write `prisma.` directly in a route file

---

## Database Schema (Summary)

See `packages/db/prisma/schema.prisma` for full schema.

**8 models:**

| Model | Table | Notes |
|---|---|---|
| `User` | `users` | roles: ADMIN, EDITOR, TRANSLATOR, VIEWER |
| `Namespace` | `namespaces` | dot-notation path e.g. `liff.dinein.menu` |
| `TranslationKey` | `translation_keys` | soft-deleted via `deletedAt` |
| `TranslationValue` | `translation_values` | **append-only** — see critical rules |
| `ChangeRequest` | `change_requests` | statuses: PENDING→APPROVED/REJECTED→PUBLISHED (DRAFT exists in schema but API always creates as PENDING) |
| `CRReviewer` | `cr_reviewers` | join table: CR ↔ User, has `approved: boolean` |
| `CRItem` | `cr_items` | each item = one locale change on one key |
| `AuditLog` | `audit_logs` | permanent, write-only |

**Full key identifier:** `{namespace.path}.{translationKey.keyName}` — built with `buildFullKey()` from `@hato-tms/shared`

---

## Critical Business Rules

### 1. TranslationValues are APPEND-ONLY

When a translation value changes, **always create a new row** with `version + 1`. Never update an existing `translation_values` row.

```typescript
// ✅ Correct
const current = key.values.find(v => v.locale === locale);
const nextVersion = current ? current.version + 1 : 1;
await keyService.createTranslationValue({ keyId, locale, value, version: nextVersion, updatedById });

// ❌ Wrong — never do this
await prisma.translationValue.update({ where: { id }, data: { value } });
```

"Latest" value for a key+locale = `values.find()` after sorting by `version DESC` (already done by service functions that include `orderBy: { version: "desc" }`).

### 2. TranslationKeys use soft delete

Never call `delete()` on a key. Use the service function:
```typescript
await keyService.softDeleteKey(id);  // sets deletedAt: new Date()
```

All list queries must filter `where: { deletedAt: null }`. This is already handled inside the service functions — don't add it again in route files.

### 3. AuditLogs are permanent

Never delete audit logs. Use `logAudit()` from `services/auditService.ts` after every significant state change. It never throws — failures are silently logged.

### 4. Self-approval is blocked

In the CR review flow, a user cannot approve their own change request. Enforced in `routes/changeRequests.ts`:
```typescript
if (cr.authorId === req.user!.id && body.action === "approve") {
  throw new AppError("Cannot approve your own change request", 403);
}
```

### 5. Status auto-calculation

A `TranslationKey` status is derived (not manually set by users) after each value write:
- Both TH + EN present → `TRANSLATED`
- Either missing → `PENDING`

This logic lives in route handlers (not services) because it's business logic.

---

## API Routes Reference

Base URL: `http://localhost:4000/api/v1`

### Auth (`/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | None | Email-only login → returns JWT + refresh token |
| POST | `/auth/refresh` | None | Refresh access token |
| GET | `/auth/me` | Bearer | Current user (auto-generates apiToken if missing) |
| POST | `/auth/token` | Bearer | Generate API token (returns 201) |
| POST | `/auth/token/regenerate` | Bearer | Regenerate API token |
| GET | `/auth/users` | Bearer | List all users (for reviewer picker) |

### Keys (`/keys`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/keys` | Bearer | List + filter (query, namespace, status, platform, tags, page, pageSize) |
| POST | `/keys` | Bearer | Create key + initial TH/EN values |
| GET | `/keys/:id` | Bearer | Single key with full value history |
| PATCH | `/keys/:id` | Bearer | Update metadata (description, tags, platforms) |
| PUT | `/keys/:id/values` | Bearer | Update translation values (creates new versions) |
| PUT | `/keys/:id/save` | Bearer | Atomic save: update TH, EN, tags in one call |
| GET | `/keys/:id/history` | Bearer | Audit log for this key |
| DELETE | `/keys/:id` | Bearer | Soft delete |
| POST | `/keys/bulk/tag` | Bearer | Bulk add tags |
| POST | `/keys/bulk/move` | Bearer | Bulk move to namespace |
| POST | `/keys/bulk/delete` | Bearer | Bulk soft delete |

### Namespaces (`/namespaces`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/namespaces` | Bearer | List with key counts |
| POST | `/namespaces` | Bearer | Create |
| PUT | `/namespaces/:id` | Bearer | Update path/description/platforms |
| GET | `/namespaces/:id/keys` | Bearer | All keys in namespace |

### Change Requests (`/change-requests`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/change-requests` | Bearer | List (filter by status) |
| POST | `/change-requests` | Bearer | Create CR with items + reviewers |
| GET | `/change-requests/:id` | Bearer | Single CR with items |
| PUT | `/change-requests/:id/review` | Bearer | Approve / reject / request-changes |
| PUT | `/change-requests/:id/publish` | Bearer | Apply values + mark PUBLISHED |

### Other
| Method | Path | Description |
|---|---|---|
| GET | `/coverage` | Per-namespace TH/EN coverage % |
| GET | `/coverage/missing` | Keys missing TH or EN |
| POST | `/import-export/import/json` | Import JSON (preview or confirm) |
| POST | `/import-export/import/csv` | Import CSV (preview or confirm) |
| GET | `/import-export/export/json` | Export JSON (nested or flat, per locale) |
| GET | `/import-export/export/csv` | Export CSV |
| GET | `/users` | List users (ADMIN only) |
| POST | `/users/invite` | Create user (ADMIN only) |
| PUT | `/users/:id` | Update user (ADMIN only) |
| DELETE | `/users/:id` | Deactivate user (ADMIN only) |

---

## Authentication Flow

Two mechanisms coexist:

**1. JWT Bearer token (web UI)**
- Login: `POST /auth/login` with `{ email }` → receives `token` (8h) + `refreshToken` (7d)
- All requests: `Authorization: Bearer <token>`
- Auto-refresh: `apps/web/src/services/api.ts` schedules refresh 5 min before expiry, retries on 401

**2. X-API-Token header (CLI / Figma plugin / CI)**
- Stored in `users.apiToken` (random 64-char hex)
- All requests: `X-API-Token: <token>`
- Regenerate via: `POST /auth/token/regenerate`

`authMiddleware` in `apps/api/src/middleware/auth.ts` checks X-API-Token first, then Bearer JWT.

---

## Web Pages

| Page | File | Route |
|---|---|---|
| Login | `LoginPage.tsx` | `/login` |
| Key list | `KeyListPage.tsx` | `/keys` |
| Key detail | `KeyDetailDrawer.tsx` | Drawer (no route) |
| Coverage | `CoveragePage.tsx` | `/coverage` |
| Import/Export | `ImportExportPage.tsx` | `/import-export` |
| Change Requests | `ChangeRequestsPage.tsx` | `/change-requests` |
| CR Detail | `ChangeRequestDetailPage.tsx` | `/change-requests/:id` |
| Create CR | `CreateChangeRequestPage.tsx` | `/change-requests/new` |
| Users (Admin) | `UsersPage.tsx` | `/users` |
| Connections | `ConnectionsPage.tsx` | `/connections` |

Frontend data fetching: TanStack React Query. All API calls go through `apps/web/src/services/api.ts`.

---

## Shared Package (`@hato-tms/shared`)

Key exports from `packages/shared/src/index.ts`:

- **`AuditAction`** enum — all audit event strings (use this, never raw strings)
- **`buildFullKey(namespacePath, keyName)`** — returns `"liff.dinein.menu.addButton"`
- **`validateNamespacePath(path)`** — dot-separated lowercase only
- **`validateKeyName(name)`** — camelCase only
- **DTOs:** `TranslationKeyDTO`, `NamespaceDTO`, `ChangeRequestDTO`, `UserDTO`, `CoverageStats`
- **Request types:** `CreateKeyRequest`, `UpdateKeyRequest`, `ImportRequest`, `SearchParams`

---

## Key Conventions

**TypeScript config:** `strict: false` in `apps/api/tsconfig.json` — intentional, due to Express query param types (`string | string[] | undefined`).

**Error handling:** Throw `new AppError(message, statusCode)` from `middleware/errorHandler.ts` — the global error handler catches and formats it as `{ error: { message } }`.

**Zod validation:** Every POST/PUT route validates the body with a `z.object()` schema defined at the top of the route file. Zod parse errors bubble up through the error handler automatically.

**Pagination:** Consistent shape for list endpoints:
```typescript
{ data: T[], total: number, page: number, pageSize: number, totalPages: number }
```

**Platform enum:** `["HS", "HH", "LIFF", "MERCHANT", "FLEX", "COMMON"]` — used on both Namespace and TranslationKey.

**Timestamps:** All ISO strings in API responses (`.toISOString()`). Never raw `Date` objects.

---

## Current State (as of 2026-04-08)

### Done ✅
- Full Express API with all 7 resource types
- Service layer extraction complete — all `prisma.*` calls are in `services/`, zero in `routes/`
- JWT auth + X-API-Token dual auth
- Append-only versioning on TranslationValues
- Soft delete on TranslationKeys
- Audit logging on all mutations
- Redis caching with graceful no-op fallback
- React web UI with all pages
- Figma plugin
- CLI (`hato-tms push/pull`)
- Import/Export (JSON nested, JSON flat, CSV)
- Change request workflow (create → review → publish)
- Coverage stats + missing key report
- Vitest configured (no test files yet)
- Firebase migration plan documented in `MIGRATION.md`

### Pending / Known Gaps
- **No test files exist yet** — Vitest is installed but `src/**/*.test.ts` is empty
- **Figma plugin** uses hardcoded prod API URL in `dist/` — needs env config
- **CLI** `hato-tms init` stores config in `~/.hato-tms` — not well tested on Windows
- **`packages/cli/src/api.ts`** still has some direct fetch calls that bypass token refresh
- **Coverage page** doesn't show per-key detail, only namespace aggregates
- **No role-based UI hiding** — VIEWER users see edit buttons, API correctly rejects but UX is poor

---

## Common Gotchas

1. **npm, not pnpm** — This project uses npm workspaces. Do not use pnpm or yarn. Workspace commands: `npm -w @hato-tms/api run dev`.

2. **postinstall runs Prisma generate** — If you add a package with `npm install`, it re-runs `prisma generate`. This is normal.

3. **`DIRECT_URL` vs `DATABASE_URL`** — Supabase requires both: `DATABASE_URL` for the connection pooler (runtime), `DIRECT_URL` for direct connection (migrations only).

4. **Vercel serverless** — `apps/api/src/index.ts` checks `process.env.VERCEL` before calling `app.listen()`. In production it exports `app` for Vercel to handle.

5. **CORS is wide open** — `origin: true` is intentional to support Figma's `null` origin (sandboxed iframes send `Origin: null`).

6. **`@hato-tms/shared` enums** — The DB enums (Prisma) use `SCREAMING_SNAKE_CASE`, but the shared package DTOs/enums use `lowercase`. Both exist; don't mix them in route response shapes. API responses always use the DB enum values (uppercase).

7. **`keys.ts` route is the biggest file** — handles list with complex filtering, create, get, update metadata, update values, bulk operations, and history. Read it fully before touching it.

8. **No migrations in CI** — Migrations are manual. Run `npx prisma migrate dev --schema packages/db/prisma/schema.prisma` locally.
