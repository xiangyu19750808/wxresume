#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

: "${DB_URL:=file:./prisma/dev.db}"

export DB_URL
export NODE_ENV="test"
export JWT_SECRET="${JWT_SECRET:-test-secret}"
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING="${PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING:-1}"
export E2E_LIGHT="1"

# Ensure Prisma client is generated and the SQLite database schema exists
pnpm --filter @wxresume/api run pretest

# Playwright binaries are optional; htmlToPDFBuffer() will fall back to a stub when
# the runtime is unavailable, so we skip browser installation in offline CI.

# Run end-to-end tests with Node's built-in test runner
node --test tests/e2e/core-flow.spec.js
