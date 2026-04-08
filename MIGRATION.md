# Hato TMS — Firebase Migration Handoff Document

> **Last updated:** 2026-04-08
> **Status:** Ready to begin — service layer extraction complete

---

## Table of Contents

1. [Migration Overview](#1-migration-overview)
2. [Prerequisites](#2-prerequisites)
3. [Step-by-Step Migration Guide](#3-step-by-step-migration-guide)
4. [Critical Rules (Must Not Break)](#4-critical-rules-must-not-break)
5. [Firestore Data Model](#5-firestore-data-model)
6. [Testing Checklist](#6-testing-checklist)
7. [Rollback Plan](#7-rollback-plan)
8. [Environment Variables Reference](#8-environment-variables-reference)

---

## 1. Migration Overview

### What We Are Migrating

| Layer | Current | Target |
|---|---|---|
| Database | PostgreSQL (Supabase hosted) via Prisma ORM | Firestore (Firebase) |
| Authentication | JWT (`jsonwebtoken`) + `X-API-Token` header | Firebase Auth (Google Sign-In) + custom API tokens in Firestore |
| Caching | Redis (ioredis) via `REDIS_URL` | Firebase in-memory TTL / no-op fallback (Redis removed) |
| Hosting | Vercel (serverless Functions) | Firebase Hosting + Cloud Functions |
| ORM / SDK | Prisma 6 (`@prisma/client`) | Firebase Admin SDK (`firebase-admin`) |

### Current State

The service layer extraction is **complete**. All Prisma calls have been moved out of route handlers into dedicated service files. Route files contain zero `prisma` imports.

**Service files ready to swap (one file = one migration unit):**

```
apps/api/src/services/
├── keyService.ts           ← TranslationKey + TranslationValue CRUD
├── changeRequestService.ts ← ChangeRequest + CRReviewer + CRItem
├── namespaceService.ts     ← Namespace CRUD
├── authService.ts          ← User lookup, API token management
├── userService.ts          ← User list, invite, update, deactivate
├── coverageService.ts      ← Coverage stats + missing key report
├── importExportService.ts  ← Bulk import/export queries
├── auditService.ts         ← AuditLog writes (still uses Prisma — swap last)
└── cacheService.ts         ← Redis cache (replace with no-op in Phase 3)
```

**Also requires updating:**
```
apps/api/src/middleware/auth.ts   ← Still imports prisma directly for token/user lookup
```

### Why This Approach Works

Route files (`apps/api/src/routes/*.ts`) do not need to change during the database migration. They call service functions that return plain JavaScript objects. Swap the service implementation; the API behavior stays identical.

---

## 2. Prerequisites

### 2.1 Firebase Project Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `hato-tms-prod`
3. Disable Google Analytics (not needed)
4. Once created, go to **Project Settings**

**Enable required Firebase services:**

| Service | Where to enable |
|---|---|
| Firestore | Build → Firestore Database → Create database → Start in **production mode** |
| Firebase Auth | Build → Authentication → Get started → Enable **Google** provider |
| Firebase Hosting | Build → Hosting → Get started |
| Cloud Functions | Build → Functions → Get started (requires Blaze pay-as-you-go plan) |

> ⚠️ **คำเตือน:** Firestore ต้องเลือก region ก่อนสร้าง และ **ไม่สามารถเปลี่ยน region ได้ภายหลัง**
> Choose `asia-southeast1` (Singapore) for lowest latency to Thai users.

### 2.2 Required Credentials

**A. Firebase Web Config** — Project Settings → General → Your apps → Add app → Web

**B. Service Account Key JSON** — Project Settings → Service accounts → Generate new private key → save as `apps/api/service-account.json`

> ⚠️ **อย่า commit ไฟล์นี้เด็ดขาด** — Add `service-account.json` to `.gitignore` immediately.

### 2.3 CLI Tools Required

```bash
npm install -g firebase-tools@^13.0.0
firebase --version   # must be >= 13.0.0
firebase login
firebase use hato-tms-prod
```

Node.js >= 18 required for Cloud Functions.

### 2.4 New Environment Variables

See [Section 8](#8-environment-variables-reference) for full before/after comparison.

---

## 3. Step-by-Step Migration Guide

> **Strategy:** Migrate one phase at a time. Each phase is independently testable. Do not start Phase N+1 until Phase N passes its test checklist.

---

### Phase 1: Firebase Setup & Dependencies

```bash
npm install firebase-admin --workspace=apps/api
npm install firebase --workspace=apps/web
firebase init   # select: Firestore, Functions (TypeScript), Hosting, Emulators
```

**Create `apps/api/src/lib/firebase.ts`:**

```typescript
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initializeApp({
    credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json"),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export const db = getFirestore();
export const adminAuth = getAuth();
```

**Verify:** `npm run dev:api` starts without errors. No Firebase calls yet.

---

### Phase 2: Google Authentication (Replace JWT)

> ⚠️ **Phase 2 breaks the frontend login flow.** Complete the web client update in the same phase.

#### 2a. Update `apps/api/src/middleware/auth.ts`

Replace JWT-based `resolveUser` with Firebase ID token verification. Keep `X-API-Token` support:

```typescript
import { db, adminAuth } from "../lib/firebase";

async function resolveUser(req: Request): Promise<AuthUser | null> {
  // 1. X-API-Token (CLI / Figma / programmatic)
  const apiToken = req.headers["x-api-token"] as string | undefined;
  if (apiToken) {
    const snapshot = await db.collection("users")
      .where("apiToken", "==", apiToken)
      .where("isActive", "==", true)
      .limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return { id: doc.id, email: data.email, name: data.name, role: data.role };
  }

  // 2. Firebase ID Token (Bearer)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const idToken = authHeader.slice(7);
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      if (!userDoc.exists) return null;
      const data = userDoc.data()!;
      if (!data.isActive) return null;
      return { id: decoded.uid, email: decoded.email!, name: data.name, role: data.role };
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }
  }
  return null;
}
```

Remove: `generateToken`, `generateRefreshToken`, `verifyRefreshToken` exports.
Remove: `jsonwebtoken` and `@types/jsonwebtoken` from `apps/api/package.json`.

#### 2b. Update `apps/web` — Replace JWT login with Firebase Auth

**Create `apps/web/src/lib/firebase.ts`:**

```typescript
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

**Update axios request interceptor in `apps/web/src/services/api.ts`:**

```typescript
import { auth } from "../lib/firebase";

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(); // Firebase handles refresh automatically
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### 2c. Add `/auth/provision` endpoint

Replace `POST /auth/login` with a provisioning endpoint called after first Google Sign-In:

```typescript
router.post("/provision", authMiddleware, async (req, res, next) => {
  try {
    const { id, email } = req.user!;
    const userDoc = await db.collection("users").doc(id).get();
    if (!userDoc.exists) {
      await db.collection("users").doc(id).set({
        email, name: email.split("@")[0], role: "VIEWER",
        isActive: true, apiToken: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
    const doc = await db.collection("users").doc(id).get();
    res.json({ user: { id: doc.id, ...doc.data() } });
  } catch (err) { next(err); }
});
```

Remove: `POST /login`, `POST /refresh` (Firebase handles token refresh client-side).

---

### Phase 3: Firestore Migration (Service File by Service File)

**Migration order (simplest → most complex):**
1. `auditService.ts` — no relations, write-only
2. `userService.ts` — simple CRUD
3. `namespaceService.ts` — simple CRUD + key count
4. `coverageService.ts` — read-heavy aggregation
5. `importExportService.ts` — bulk reads/writes
6. `keyService.ts` — complex, append-only values
7. `changeRequestService.ts` — sub-collections, transactions

**Shared helper `apps/api/src/lib/firestore.ts`:**

```typescript
export function docToObject<T>(doc: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as T;
}
export const now = () => new Date().toISOString();
```

#### Key pattern — auditService.ts

```typescript
import { db } from "../lib/firebase";
import { now } from "../lib/firestore";

export async function logAudit(action, entityType, entityId, actorId, diff?) {
  try {
    await db.collection("audit_logs").add({
      action, entityType, entityId, actorId, diff: diff ?? null, createdAt: now(),
    });
  } catch (err) {
    console.error("[AuditService] Failed to write audit log:", err);
  }
}
```

#### Key pattern — append-only TranslationValues (keyService.ts)

> ⚠️ **กฎเหล็ก:** `translation_values` เป็น append-only เท่านั้น — ห้าม `.update()` หรือ `.set()` บน document เดิม

```typescript
// ✅ Always add a new document
const existing = await db.collection("translation_values")
  .where("keyId", "==", keyId).where("locale", "==", locale)
  .orderBy("version", "desc").limit(1).get();

const nextVersion = existing.empty ? 1 : existing.docs[0].data().version + 1;
await db.collection("translation_values").add({
  keyId, locale, value, version: nextVersion, updatedById, createdAt: now(),
});

// ❌ Never do this
await db.collection("translation_values").doc(id).update({ value: newValue });
```

#### Key pattern — changeRequestService.ts (transactions + sub-collections)

```typescript
const crRef = db.collection("change_requests").doc();
await db.runTransaction(async (t) => {
  t.set(crRef, { title, status: "PENDING", authorId, createdAt: now(), updatedAt: now() });
  for (const item of items) {
    t.set(crRef.collection("items").doc(), item);
  }
  for (const userId of reviewerIds) {
    t.set(crRef.collection("reviewers").doc(), { userId, approved: false });
  }
});
```

#### Firestore `in` query limit

> ⚠️ **ข้อจำกัด:** `where("field", "in", array)` รองรับสูงสุด **30 ค่า** เท่านั้น

Always batch in chunks of 30:
```typescript
for (let i = 0; i < ids.length; i += 30) {
  const snap = await db.collection("...").where("keyId", "in", ids.slice(i, i + 30)).get();
  // merge results
}
```

#### Replace cacheService.ts with no-op

```typescript
export async function get<T = unknown>(_key: string): Promise<T | null> { return null; }
export async function set(_key: string, _value: unknown, _ttl?: number): Promise<void> {}
export async function del(_key: string): Promise<void> {}
export async function invalidatePattern(_pattern: string): Promise<void> {}
```

Then remove `ioredis` from `apps/api/package.json`.

---

### Phase 4: Firebase Hosting (Replace Vercel)

```typescript
// functions/src/index.ts
import * as functions from "firebase-functions/v2";
import app from "../../apps/api/src/index";

export const api = functions.https.onRequest(
  { region: "asia-southeast1", memory: "256MiB" },
  app
);
```

**`firebase.json`:**
```json
{
  "hosting": {
    "public": "apps/web/dist",
    "rewrites": [
      { "source": "/api/**", "destination": "/api" },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "functions": { "source": "functions", "runtime": "nodejs18" }
}
```

```bash
npm run build --workspace=apps/web
firebase deploy
```

---

### Phase 5: Cleanup (Remove Prisma, Supabase, Old Auth)

Only run after all previous phases are verified stable in production.

```bash
npm uninstall prisma --save-dev
npm uninstall @prisma/client --workspace=packages/db
npm uninstall jsonwebtoken --workspace=apps/api
npm uninstall @types/jsonwebtoken --workspace=apps/api
npm uninstall ioredis --workspace=apps/api
rm -rf packages/db
```

Remove from root `package.json`: `db:generate`, `db:migrate`, `db:seed`, `db:studio` scripts, Prisma from postinstall.

---

## 4. Critical Rules (Must Not Break)

### Rule 1: `translation_values` is APPEND-ONLY

> ⚠️ **ห้ามอัพเดทค่าเก่าโดยเด็ดขาด — ให้เพิ่ม document ใหม่เสมอ**

Every value change = new row with `version + 1`. The entire edit history depends on this.

### Rule 2: `audit_logs` is PERMANENT

> ⚠️ **ห้ามลบ audit log เด็ดขาด — รวมถึงใน Firestore security rules**

```
match /audit_logs/{docId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
  allow update, delete: if false;
}
```

### Rule 3: Firestore Collection Naming

| Prisma Model | Firestore Collection |
|---|---|
| `User` | `users` |
| `Namespace` | `namespaces` |
| `TranslationKey` | `translation_keys` |
| `TranslationValue` | `translation_values` |
| `ChangeRequest` | `change_requests` |
| `CRReviewer` | `change_requests/{id}/reviewers` (sub-collection) |
| `CRItem` | `change_requests/{id}/items` (sub-collection) |
| `AuditLog` | `audit_logs` |

### Rule 4: Soft Deletes Stay Soft

`TranslationKey.deletedAt` is a soft delete. Set `deletedAt` to ISO string, never physically delete. All queries must filter `where("deletedAt", "==", null)`.

### Rule 5: Self-Approval Block

A user cannot approve their own change request. This logic is in `routes/changeRequests.ts` and must be preserved regardless of the database layer.

---

## 5. Firestore Data Model

### `users`
```
users/{uid}              ← uid = Firebase Auth UID
  email: string
  name: string
  role: "ADMIN" | "EDITOR" | "TRANSLATOR" | "VIEWER"
  isActive: boolean
  apiToken: string | null
  createdAt: string (ISO)
  updatedAt: string (ISO)
```
Indexes: `email` (single), `apiToken` (single)

### `namespaces`
```
namespaces/{id}
  path: string            ← unique e.g. "liff.dinein.menu"
  description: string | null
  platforms: string[]
  isActive: boolean
  createdAt: string (ISO)
  updatedAt: string (ISO)
```
Indexes: `path` (single), `isActive + path` (composite)

### `translation_keys`
```
translation_keys/{id}
  namespaceId: string
  keyName: string
  description: string | null
  tags: string[]
  status: "TRANSLATED" | "PENDING" | "IN_REVIEW"
  platforms: string[]
  createdById: string | null
  deletedAt: string | null   ← null when active, ISO string when soft-deleted
  createdAt: string (ISO)
  updatedAt: string (ISO)
```
Indexes: `namespaceId + deletedAt` (composite), `status + deletedAt` (composite)

### `translation_values` ← APPEND-ONLY, NEVER UPDATE
```
translation_values/{id}
  keyId: string
  locale: "TH" | "EN"
  value: string
  version: number            ← always incrementing, never reused
  updatedById: string | null
  createdAt: string (ISO)    ← no updatedAt, this doc never changes
```
Indexes: `keyId + locale + version desc` (composite), `keyId + version desc` (composite)

### `change_requests`
```
change_requests/{id}
  title: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "PUBLISHED"
  authorId: string
  createdAt: string (ISO)
  updatedAt: string (ISO)

Sub-collections:
  change_requests/{id}/items/{itemId}
    keyId, locale, oldValue, newValue, comment

  change_requests/{id}/reviewers/{reviewerId}
    userId: string
    approved: boolean
```
Indexes: `status` (single), `authorId` (single)

### `audit_logs` ← PERMANENT, NO DELETES
```
audit_logs/{id}
  action: string
  entityType: string
  entityId: string
  actorId: string
  diff: object | null
  createdAt: string (ISO)
```
Indexes: `entityType + entityId + createdAt desc` (composite)

---

## 6. Testing Checklist

### Phase 1 — Firebase Setup
- [ ] `firebase --version` returns >= 13.0.0
- [ ] `apps/api/src/lib/firebase.ts` initializes without errors
- [ ] No existing functionality broken
- [ ] `service-account.json` is in `.gitignore` and not staged

### Phase 2 — Authentication
- [ ] Web app can sign in with Google via Firebase Auth
- [ ] `GET /api/v1/auth/me` returns user data with valid Firebase ID token
- [ ] `X-API-Token` header still works for CLI authentication
- [ ] `POST /api/v1/auth/provision` creates Firestore user on first sign-in
- [ ] `requireRole("ADMIN")` correctly rejects VIEWER users with 403
- [ ] Expired tokens return 401
- [ ] Self-approval block still works (EC-08)

### Phase 3 — Firestore Migration (per service)
- [ ] List endpoint returns same shape as before
- [ ] Create endpoint creates document with all required fields
- [ ] Update endpoint updates only provided fields (partial update)
- [ ] Delete / deactivate uses soft delete (document not removed)
- [ ] Translation value creation always adds a new document, never updates existing
- [ ] `in` queries are batched in chunks of 30

### Phase 4 — Hosting
- [ ] `firebase deploy --only hosting` serves the web app
- [ ] `/api/v1/keys` responds from Cloud Functions URL
- [ ] CORS headers correct (web app can call the API)

### Phase 5 — Cleanup
- [ ] `npm install` succeeds after removing Prisma/ioredis
- [ ] TypeScript compiles without errors in all packages
- [ ] No references to `prisma`, `@prisma/client`, `jsonwebtoken`, `ioredis` remain

---

## 7. Rollback Plan

### Phase 1
No data changed. Remove packages:
```bash
npm uninstall firebase-admin --workspace=apps/api
npm uninstall firebase --workspace=apps/web
```

### Phase 2
Restore original auth files from git:
```bash
git checkout -- apps/api/src/middleware/auth.ts
git checkout -- apps/api/src/services/authService.ts
git checkout -- apps/api/src/routes/auth.ts
git checkout -- apps/web/src/services/api.ts
```

### Phase 3 (per service)
Each service file is independent. Roll back individually:
```bash
git checkout -- apps/api/src/services/keyService.ts
```

> ⚠️ **ถ้ามีการ write ข้อมูลลง Firestore แล้ว** — data written to Firestore does not auto-rollback. You must restore PostgreSQL as source of truth and discard Firestore data manually.

**Recommended:** Run both Prisma and Firestore implementations in parallel briefly to verify correctness before decommissioning Prisma.

### Phase 4
Re-deploy to Vercel: `vercel --prod`

### Phase 5
> ⚠️ Phase 5 is **irreversible** once committed. Do not run until Phase 4 has been stable in production for at least 2 weeks. Recovery requires restoring `packages/db` from git history.

---

## 8. Environment Variables Reference

### Current (remove after migration)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooled connection for Prisma runtime |
| `DIRECT_URL` | Supabase direct connection for Prisma migrations |
| `JWT_SECRET` | Sign/verify JWT access and refresh tokens |
| `REDIS_URL` | Redis connection for cache (optional) |

### After Migration (add)

| Variable | Location | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `.env` / Functions config | Firebase project identifier |
| `GOOGLE_APPLICATION_CREDENTIALS` | `.env` (dev only) | Path to service account JSON |
| `VITE_FIREBASE_API_KEY` | `apps/web/.env` | Firebase Web SDK config |
| `VITE_FIREBASE_AUTH_DOMAIN` | `apps/web/.env` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | `apps/web/.env` | Firebase project ID (frontend) |
| `VITE_FIREBASE_APP_ID` | `apps/web/.env` | Firebase app identifier |

### Kept (unchanged)

| Variable | Purpose |
|---|---|
| `PORT` | API server port (local dev) |
| `NODE_ENV` | `development` or `production` |
| `HATO_TMS_API_URL` | GitHub Actions sync workflow |
| `HATO_TMS_API_TOKEN` | GitHub Actions sync workflow |

### Service Account Key

The service account JSON (`service-account.json`) is not an env var — it is a file. In production Cloud Functions it is auto-provided by the Firebase runtime. For local dev, place it at `apps/api/service-account.json` and verify it is in `.gitignore`:

```bash
git check-ignore -v apps/api/service-account.json
# Should output: .gitignore:... apps/api/service-account.json
```

---

*End of Migration Handoff Document*
