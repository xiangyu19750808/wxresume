#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

: "${DB_URL:=file:./prisma/dev.db}"

export DB_URL
export NODE_ENV="test"
export JWT_SECRET="${JWT_SECRET:-test-secret}"

# Ensure Prisma client is generated and the SQLite database schema exists
pnpm --filter @wxresume/api exec prisma generate --schema prisma/schema.prisma
pnpm --filter @wxresume/api exec prisma db push --schema prisma/schema.prisma --skip-generate

# Ensure Playwright browsers are available for PDF rendering during tests
pnpm --filter @wxresume/api exec playwright install chromium

# Run end-to-end tests with Node's built-in test runner
node --test tests/e2e/**/*.spec.js
