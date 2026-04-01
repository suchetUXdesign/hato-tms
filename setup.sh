#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Prerequisites ──────────────────────────────────────────────
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1  || error "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
command -v node   >/dev/null 2>&1  || error "Node.js is not installed. Install it from https://nodejs.org/"
command -v npm    >/dev/null 2>&1  || error "npm is not installed. It should come with Node.js."

info "Docker  : $(docker --version)"
info "Node.js : $(node --version)"
info "npm     : $(npm --version)"

# ── Environment ────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "Copying .env.example -> .env"
  cp .env.example .env
else
  warn ".env already exists, skipping copy"
fi

# ── Docker services ────────────────────────────────────────────
info "Starting Docker services (Postgres + Redis)..."
docker compose up -d

info "Waiting for Postgres to be ready..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U hato -d hato_tms >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    error "Postgres did not become ready in time."
  fi
  sleep 1
done
info "Postgres is ready."

# ── Dependencies ───────────────────────────────────────────────
info "Installing npm dependencies..."
npm install

# ── Database ───────────────────────────────────────────────────
info "Generating Prisma client..."
npm run db:generate

info "Running database migrations..."
npm run db:migrate

info "Seeding database..."
npm run db:seed

# ── Done ───────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Hato TMS setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Start developing:"
echo "  npm run dev:api   # API server on http://localhost:4000"
echo "  npm run dev:web   # Web UI on http://localhost:3000"
echo ""
echo "Or run both at once:"
echo "  make dev"
echo ""
