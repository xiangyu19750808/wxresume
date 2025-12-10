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

# Ensure Playwright browsers are available for PDF rendering during tests when possible
if [ "${E2E_SKIP_PLAYWRIGHT_INSTALL:-}" = "1" ] || [ "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" = "1" ]; then
  echo "[info] Skipping Playwright Chromium installation step." >&2
else
  if ! pnpm --filter @wxresume/api exec playwright install chromium; then
    echo "[warn] Unable to install Playwright Chromium binary. Continuing with fallback renderer." >&2
  fi
fi

# Run end-to-end tests with Node's built-in test runner
mapfile -t E2E_SPECS < <(find tests/e2e -name '*.spec.js' -print)

if [ "${#E2E_SPECS[@]}" -eq 0 ]; then
  echo "[warn] No end-to-end spec files located under tests/e2e." >&2
else
  node --test "${E2E_SPECS[@]}"
fi
