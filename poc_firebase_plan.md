# PoC Plan: Hato TMS v2 — Firebase Stack (Updated)

## ✅ Decisions Made

| Decision | Choice | เหตุผล |
|---|---|---|
| **Language** | **TypeScript** | strict mode, type safety ทั้ง monorepo |
| **Database** | **Firestore** | compound query ได้, ไม่ใช่ Realtime DB |
| **DB Portability** | **Repository Pattern** | swap Firestore → SQL ได้โดยไม่แตะ routes |
| **Auth** | **Firebase Auth** | แทน JWT — ID Token verify ใน Functions |
| **API Style** | **Express on Firebase Functions** | port จากเดิมได้, familiar pattern |
| **Build Order** | **`packages/firebase` → `apps/functions` → `apps/web-v2`** | dependency ไหลจาก bottom-up |

---

## Stack

| Layer | Technology |
|---|---|
| **Language** | TypeScript (strict) |
| **Frontend** | React 19 + Vite + TanStack Router |
| **UI Components** | shadcn/ui (Radix UI + Tailwind CSS) |
| **Validation** | Valibot |
| **Architecture (FE)** | Feature-Sliced Design (FSD) |
| **Database** | Firestore |
| **DB Abstraction** | Repository Pattern (`IKeyRepository`) |
| **API Layer** | Firebase Functions v2 + Express |
| **Auth** | Firebase Auth (Email/Password) |
| **Hosting** | Firebase Hosting (static SPA) |
| **Monorepo** | Turborepo |

---

## โครงสร้าง Monorepo

```
hato-tms/
├── apps/
│   ├── web/              ← (เดิม) คงไว้ — production ยังใช้
│   ├── web-v2/           ← (NEW) React + Vite + TanStack Router + FSD
│   ├── functions/        ← (NEW) Firebase Functions + Express
│   └── figma-plugin/     ← ไม่ต้องเปลี่ยน
├── packages/
│   ├── shared/           ← (เดิม) enums, DTOs, validators — ใช้ร่วมได้เลย
│   ├── firebase/         ← (NEW) Firestore collections + converters + Repository interfaces
│   ├── db/               ← (เดิม) Prisma — คงไว้จน migrate เสร็จ
│   └── cli/              ← ปรับทีหลัง
├── firebase.json         ← (NEW)
├── .firebaserc           ← (NEW)
└── turbo.json            ← เพิ่ม pipeline: functions build/deploy
```

---

## Architecture: Request Flow

```
Browser (web-v2)
    │
    │  HTTPS
    ▼
Firebase Hosting  ──── static files (React SPA)
    │
    │  /api/v1/**  → rewrite
    ▼
Firebase Functions
    └── Express App
            ├── middleware/auth.ts     ← verifyIdToken (Firebase Admin)
            ├── routes/keys.ts         ← business logic (DB-agnostic)
            ├── routes/namespaces.ts
            ├── routes/changeRequests.ts
            ├── routes/importExport.ts
            ├── routes/coverage.ts
            └── routes/users.ts
                    │
                    │  getKeyRepository()  ← DI ตาม DB_DRIVER env
                    ▼
            ┌───────────────────────────┐
            │   IKeyRepository          │  ← interface (ไม่เปลี่ยน)
            ├───────────────────────────┤
            │ FirestoreKeyRepository    │  ← PoC (DB_DRIVER=firestore)
            │ PrismaKeyRepository       │  ← อนาคต (DB_DRIVER=sql)
            └───────────────────────────┘
                    │
                    ▼
            Firestore  /  PostgreSQL
```

---

## Repository Pattern (DB Portability)

### Interface (ไม่เปลี่ยนเมื่อ swap DB)

```typescript
// packages/firebase/src/repositories/IKeyRepository.ts

import type { TranslationKeyDTO, SearchParams, CreateKeyInput, UpdateKeyInput } from '@hato-tms/shared'

export interface IKeyRepository {
  findMany(params: SearchParams): Promise<{ data: TranslationKeyDTO[]; total: number }>
  findById(id: string): Promise<TranslationKeyDTO | null>
  create(data: CreateKeyInput, actorId: string): Promise<TranslationKeyDTO>
  update(id: string, data: UpdateKeyInput, actorId: string): Promise<TranslationKeyDTO>
  updateValues(id: string, locale: string, value: string, actorId: string): Promise<void>
  softDelete(id: string): Promise<void>
  bulkDelete(ids: string[]): Promise<void>
}
```

### Firestore Implementation (PoC)

```typescript
// apps/functions/src/repositories/key.firestore.ts

export class FirestoreKeyRepository implements IKeyRepository {
  async findMany(params: SearchParams) {
    let q = query(translationKeysCol, where('deletedAt', '==', null))
    if (params.status)    q = query(q, where('status', '==', params.status))
    if (params.namespace) q = query(q, where('namespaceId', '==', params.namespace))
    // ...
    const snap = await getDocs(q)
    return { data: snap.docs.map(d => d.data()), total: snap.size }
  }
}
```

### Route (ไม่รู้จัก DB — ไม่ต้องแก้เมื่อ swap)

```typescript
// apps/functions/src/routes/keys.ts

router.get('/', async (req, res) => {
  const repo = container.get<IKeyRepository>('KeyRepository')
  const result = await repo.findMany(req.query as SearchParams)
  res.json(result)
})
```

### Swap DB: เปลี่ยนแค่ 2 จุด

```typescript
// apps/functions/src/container.ts

export function bindRepositories() {
  if (process.env.DB_DRIVER === 'firestore') {
    container.bind('KeyRepository',       new FirestoreKeyRepository())
    container.bind('NamespaceRepository', new FirestoreNamespaceRepository())
    // ...
  } else {
    container.bind('KeyRepository',       new PrismaKeyRepository())
    container.bind('NamespaceRepository', new PrismaNamespaceRepository())
    // ...
  }
}
```

---

## Phase 1: `packages/firebase`

```
packages/firebase/
├── src/
│   ├── app.ts                    ← initializeApp (singleton, reuse across Functions)
│   ├── repositories/
│   │   ├── IKeyRepository.ts     ← interface
│   │   ├── INamespaceRepository.ts
│   │   ├── IChangeRequestRepository.ts
│   │   ├── IUserRepository.ts
│   │   └── IAuditRepository.ts
│   ├── collections/
│   │   ├── translationKeys.ts    ← collection ref + converter
│   │   ├── namespaces.ts
│   │   ├── changeRequests.ts
│   │   ├── users.ts
│   │   └── auditLogs.ts
│   ├── schema/                   ← Firestore document types (ไม่ใช่ DTO)
│   │   └── firestore.types.ts
│   └── index.ts
└── package.json
```

### Firestore Data Model

```
/namespaces/{nsId}
  path: string              // "liff.dinein.menu"
  description: string | null
  platforms: string[]       // Platform[]
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp

/translationKeys/{keyId}
  namespaceId: string
  namespacePath: string     // denormalized — ไม่ต้อง join
  keyName: string
  fullKey: string           // "liff.dinein.menu.confirmButton"
  description: string | null
  tags: string[]
  status: string            // KeyStatus
  platforms: string[]
  values: {                 // denormalized — ไม่ต้อง subcollection
    TH: { value: string; version: number; updatedById: string | null; updatedAt: Timestamp }
    EN: { value: string; version: number; updatedById: string | null; updatedAt: Timestamp }
  }
  createdById: string | null
  createdByName: string | null  // denormalized
  deletedAt: Timestamp | null   // soft delete
  createdAt: Timestamp
  updatedAt: Timestamp

/changeRequests/{crId}
  title: string
  status: string            // CRStatus
  authorId: string
  authorName: string        // denormalized
  reviewers: Array<{ id: string; name: string; approved: boolean }>
  items: Array<CRItem>      // embed (< 1MB ต่อ doc ปกติ)
  createdAt: Timestamp
  updatedAt: Timestamp

/users/{uid}               // uid จาก Firebase Auth
  email: string
  name: string
  role: string             // UserRole
  isActive: boolean
  apiToken: string | null
  createdAt: Timestamp
  updatedAt: Timestamp

/auditLogs/{logId}         // append-only
  action: string           // AuditAction
  entityType: string
  entityId: string
  actorId: string
  actorName: string        // denormalized
  diff: Record<string, unknown> | null
  createdAt: Timestamp
```

---

## Phase 2: `apps/functions`

```
apps/functions/
├── src/
│   ├── index.ts                  ← export const api = onRequest(app)
│   ├── app.ts                    ← Express app setup + routes mount
│   ├── container.ts              ← DI: bind repositories
│   ├── middleware/
│   │   ├── auth.ts               ← admin.auth().verifyIdToken()
│   │   └── error.ts
│   ├── routes/                   ← port จาก apps/api/src/routes (แก้น้อยมาก)
│   │   ├── keys.ts
│   │   ├── namespaces.ts
│   │   ├── changeRequests.ts
│   │   ├── importExport.ts       ← server-only (heavy logic)
│   │   ├── coverage.ts
│   │   └── users.ts
│   └── repositories/             ← Firestore implementations
│       ├── key.firestore.ts
│       ├── namespace.firestore.ts
│       ├── changeRequest.firestore.ts
│       ├── user.firestore.ts
│       └── audit.firestore.ts
├── package.json
└── tsconfig.json
```

### Auth Middleware (Firebase แทน JWT)

```typescript
// apps/functions/src/middleware/auth.ts

import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
    ?? req.headers['x-api-token']  // รองรับ CLI / Figma plugin เดิม

  const decoded = await getAuth().verifyIdToken(token)
  const userDoc  = await getFirestore().collection('users').doc(decoded.uid).get()

  req.user = { id: decoded.uid, role: userDoc.data()?.role, ...decoded }
  next()
}
```

---

## Phase 3: `apps/web-v2` (FSD)

```
apps/web-v2/
├── src/
│   ├── app/                      ← App layer
│   │   ├── providers/
│   │   │   ├── QueryProvider.tsx
│   │   │   ├── AuthProvider.tsx   ← Firebase Auth context
│   │   │   └── ThemeProvider.tsx
│   │   ├── router.tsx             ← TanStack Router (createRouter)
│   │   └── main.tsx
│   │
│   ├── pages/                    ← thin — compose features
│   │   ├── keys/
│   │   ├── change-requests/
│   │   ├── coverage/
│   │   ├── import-export/
│   │   ├── users/
│   │   └── login/
│   │
│   ├── widgets/                  ← complex UI blocks
│   │   ├── sidebar/
│   │   ├── key-table/
│   │   └── cr-reviewer-panel/
│   │
│   ├── features/                 ← business actions
│   │   ├── auth/
│   │   ├── create-key/
│   │   ├── update-translation/
│   │   ├── create-change-request/
│   │   ├── review-change-request/
│   │   ├── import-translations/
│   │   └── export-translations/
│   │
│   ├── entities/                 ← domain models
│   │   ├── translation-key/
│   │   │   ├── ui/               ← KeyStatusBadge, KeyCard
│   │   │   ├── model/            ← types, hooks
│   │   │   └── api/              ← useKeys(), useKey()
│   │   ├── namespace/
│   │   ├── change-request/
│   │   └── user/
│   │
│   └── shared/                   ← Shared layer
│       ├── api/
│       │   └── client.ts         ← axios instance (base URL = /api/v1)
│       ├── ui/                   ← shadcn/ui re-exports
│       ├── lib/
│       │   ├── valibot/           ← shared Valibot schemas
│       │   └── utils.ts
│       └── config/
│           └── routes.ts          ← route path constants
```

### Valibot Schema (แทน Zod)

```typescript
// src/shared/lib/valibot/key.schema.ts
import * as v from 'valibot'
import { Platform } from '@hato-tms/shared'

export const CreateKeySchema = v.object({
  namespacePath: v.pipe(v.string(), v.minLength(1, 'Required')),
  keyName:       v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9]*$/, 'camelCase only')),
  thValue:       v.pipe(v.string(), v.minLength(1, 'Required')),
  enValue:       v.pipe(v.string(), v.minLength(1, 'Required')),
  description:   v.optional(v.string()),
  tags:          v.optional(v.array(v.string())),
  platforms:     v.optional(v.array(v.enum(Platform))),
})

export type CreateKeyInput = v.InferOutput<typeof CreateKeySchema>
```

### TanStack Router

```typescript
// src/app/router.tsx
import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router'

const rootRoute     = createRootRoute({ component: RootLayout })
const keysRoute     = createRoute({ getParentRoute: () => rootRoute, path: '/keys' })
const keyDetailRoute = createRoute({ getParentRoute: () => keysRoute, path: '$keyId' })
const crsRoute      = createRoute({ getParentRoute: () => rootRoute, path: '/change-requests' })
const crDetailRoute = createRoute({ getParentRoute: () => crsRoute, path: '$crId' })

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    keysRoute.addChildren([keyDetailRoute]),
    crsRoute.addChildren([crDetailRoute]),
  ]),
})
```

---

## Phase 4: Firebase Config

```json
// firebase.json
{
  "hosting": {
    "public": "apps/web-v2/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/v1/**", "function": "api" },
      { "source": "**",        "destination": "/index.html" }
    ]
  },
  "functions": [{
    "source": "apps/functions",
    "codebase": "hato-tms",
    "ignore": ["node_modules", ".git"]
  }]
}
```

---

## Turbo Pipeline (เพิ่ม)

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "lib/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "deploy": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

---

## ลำดับการสร้าง PoC

```
Step 1 ── packages/firebase
          │  Repository interfaces (IKeyRepository, ...)
          │  Firestore collections + converters
          └─ Firestore document types

Step 2 ── apps/functions
          │  Firebase Functions + Express setup
          │  middleware/auth.ts (Firebase Admin)
          │  Firestore repository implementations
          └─ Port route: keys.ts ก่อน (core feature)

Step 3 ── apps/web-v2 scaffold
          │  Vite + React + shadcn/ui init
          │  TanStack Router setup
          │  FSD folder structure
          └─ Firebase Auth login page

Step 4 ── Feature: Translation Keys (end-to-end)
          │  entities/translation-key (model + api)
          │  features/create-key
          └─ ทดสอบ: web-v2 → functions → firestore

Step 5 ── Feature: Change Requests
Step 6 ── Feature: Import/Export
Step 7 ── Firebase Emulator → staging → production deploy
```

---

## Swap to SQL — checklist (อนาคต)

เมื่อต้องการเปลี่ยนเป็น PostgreSQL/Prisma:

- [ ] สร้าง `apps/functions/src/repositories/*.prisma.ts`
- [ ] เพิ่ม Prisma schema ใน `packages/db`
- [ ] เปลี่ยน `DB_DRIVER=sql` ใน env
- [ ] ไม่ต้องแตะ routes, interfaces, หรือ web-v2 เลย

---

## Known Gotchas

> [!WARNING]
> **Firestore unique constraint ไม่มี native** — ใช้ Firestore Transaction ตรวจก่อน write
> `[namespaceId + keyName]` ต้อง check เองใน `FirestoreKeyRepository.create()`

> [!WARNING]
> **Firebase Functions cold start** — Gen 2 + `minInstances: 1` ถ้า latency สำคัญ

> [!NOTE]
> **`@hato-tms/shared`** — enums, DTOs, validators ใช้ได้ทั้งใน `functions` และ `web-v2` ทันที
> ไม่ต้องเขียนใหม่

> [!TIP]
> **เริ่มด้วย Firebase Emulator** — `firebase emulators:start`
> รัน Firestore + Functions + Hosting locally โดยไม่ต้องสร้าง project จริง
