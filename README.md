# Hato TMS — Translation Management System

Centralized bilingual (TH/EN) translation management for Hato Hub products. Includes a Web UI, REST API, CLI tool, and Figma plugin.

## Quick Start

```bash
git clone <repo-url>
cd hato-tms
chmod +x setup.sh
./setup.sh
```

Then, in separate terminals:

```bash
npm run dev:api   # API on http://localhost:4000
npm run dev:web   # Web on http://localhost:3000
```

The `setup.sh` script handles everything: prerequisite checks, Docker services, npm install, Prisma client generation, database migrations, and seeding.

## Architecture

```
hato-tms/                         (npm workspaces monorepo)
├── apps/
│   ├── api/                      Express + TypeScript REST API (port 4000)
│   ├── web/                      React + Ant Design 5 + Vite (port 3000)
│   └── figma-plugin/             Figma Plugin (esbuild)
├── packages/
│   ├── cli/                      hato-tms CLI (Commander.js)
│   ├── db/                       Prisma schema + PostgreSQL
│   └── shared/                   Shared types, enums, validation
├── docker-compose.yml            PostgreSQL 16 + Redis 7
├── setup.sh                      One-command project setup
└── package.json                  Workspace root
```

## Prerequisites

| Tool              | Version   |
| ----------------- | --------- |
| Node.js           | 18+       |
| npm               | 10+       |
| Docker            | Latest    |
| Docker Compose    | v2+       |

## Environment Variables

Copy the example and adjust as needed:

```bash
cp .env.example .env
```

| Variable        | Default                                              | Description               |
| --------------- | ---------------------------------------------------- | ------------------------- |
| `DATABASE_URL`  | `postgresql://hato:hato_dev@localhost:5432/hato_tms`  | PostgreSQL connection     |
| `REDIS_URL`     | `redis://localhost:6379`                              | Redis connection          |
| `JWT_SECRET`    | `change-me-in-production`                            | JWT signing secret        |
| `API_PORT`      | `4000`                                               | API server port           |

## Development

### Running Services

```bash
# Start Docker services (Postgres + Redis)
docker compose up -d

# Start API server (with hot reload via tsx watch)
npm run dev:api

# Start Web UI (Vite dev server, proxies /api to :4000)
npm run dev:web

# Or run everything with Turbo
npm run dev
```

### Database Commands

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Run pending migrations
npm run db:migrate

# Seed the database with sample data (65+ keys, 11 namespaces, 4 users)
npm run db:seed

# Open Prisma Studio (visual DB browser)
npm run db:studio

# Reset database (drop, recreate, migrate, seed)
npx prisma migrate reset --schema packages/db/prisma/schema.prisma
```

## API Endpoints

Base URL: `http://localhost:4000/api/v1`

Authentication: pass an `Authorization: Bearer <token>` header or `x-api-token` header.

### Auth

| Method | Path            | Description                |
| ------ | --------------- | -------------------------- |
| POST   | `/auth/login`   | Login with email/password  |
| GET    | `/auth/me`      | Get current user           |
| POST   | `/auth/token`   | Generate API token         |

### Translation Keys

| Method | Path                  | Description                          |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/keys`               | List/search keys (paginated, filterable) |
| POST   | `/keys`               | Create a new translation key         |
| GET    | `/keys/duplicates`    | Find duplicate values across keys    |
| GET    | `/keys/:id`           | Get a single key with all values     |
| PUT    | `/keys/:id`           | Update key metadata                  |
| PUT    | `/keys/:id/values`    | Update a translation value (TH/EN)   |
| DELETE | `/keys/:id`           | Soft-delete a key                    |
| POST   | `/keys/bulk`          | Bulk operations on keys              |

### Namespaces

| Method | Path                    | Description                   |
| ------ | ----------------------- | ----------------------------- |
| GET    | `/namespaces`           | List all namespaces           |
| POST   | `/namespaces`           | Create a namespace            |
| PUT    | `/namespaces/:id`       | Update a namespace            |
| GET    | `/namespaces/:id/keys`  | List keys in a namespace      |

### Import / Export

| Method | Path                        | Description                   |
| ------ | --------------------------- | ----------------------------- |
| POST   | `/import-export/import/json`| Import keys from JSON         |
| POST   | `/import-export/import/csv` | Import keys from CSV          |
| GET    | `/import-export/export/json`| Export keys as JSON (nested or flat) |
| GET    | `/import-export/export/csv` | Export keys as CSV            |

### Change Requests

| Method | Path                              | Description                   |
| ------ | --------------------------------- | ----------------------------- |
| GET    | `/change-requests`                | List change requests          |
| POST   | `/change-requests`                | Create a change request       |
| GET    | `/change-requests/:id`            | Get change request details    |
| PUT    | `/change-requests/:id/review`     | Approve or reject a CR        |
| PUT    | `/change-requests/:id/publish`    | Publish an approved CR        |

### Coverage

| Method | Path                  | Description                          |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/coverage`           | Translation coverage stats per namespace |
| GET    | `/coverage/missing`   | List keys with missing translations  |

## Default Test Accounts

After running `npm run db:seed`, the following accounts are available:

| Email               | Role       | API Token                                                          |
| ------------------- | ---------- | ------------------------------------------------------------------ |
| `admin@hato.co`     | Admin      | `99d88fc14da8263c5cfbc14ad665ff16189da44b7d890efec945331e2bf45d97` |
| `dev1@hato.co`      | Developer  | _(use login endpoint)_                                             |
| `dev2@hato.co`      | Developer  | _(use login endpoint)_                                             |
| `reviewer@hato.co`  | Reviewer   | _(use login endpoint)_                                             |

Quick test:

```bash
curl http://localhost:4000/api/v1/keys \
  -H "x-api-token: 99d88fc14da8263c5cfbc14ad665ff16189da44b7d890efec945331e2bf45d97"
```

## Figma Plugin Setup

1. Open Figma Desktop.
2. Go to **Plugins > Development > Import plugin from manifest...**
3. Select the `apps/figma-plugin/manifest.json` file.
4. The plugin will appear under **Plugins > Development > Hato TMS**.

For development:

```bash
cd apps/figma-plugin
npm run dev    # Rebuilds on file changes via esbuild
```

The plugin connects to the API at `http://localhost:4000` during development.

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Monorepo       | npm workspaces + Turborepo          |
| API            | Express, TypeScript, tsx (watch)     |
| Web UI         | React 18, Ant Design 5, Vite        |
| Database       | PostgreSQL 16, Prisma ORM           |
| Cache          | Redis 7                             |
| CLI            | Commander.js                        |
| Figma Plugin   | Figma Plugin API, esbuild           |
| Language       | TypeScript (strict in most packages) |

## Supported Platforms

The system manages translations across these Hato Hub platforms:

- **HS** — Hato Storefront
- **HH** — Hato Hub
- **LIFF** — LINE LIFF apps
- **Merchant** — Merchant portal
- **Flex** — LINE Flex messages
- **Common** — Shared across platforms

## Key Concepts

- **Namespace**: Logical grouping for translation keys (e.g., `common.buttons`, `hs.checkout`). Uses dot notation.
- **Translation Key**: A named entry with TH and EN values, belonging to a namespace.
- **Change Request (CR)**: A batch of proposed translation changes that goes through a review/approval workflow before publishing.
- **Coverage**: Percentage of keys that have both TH and EN translations per namespace.
