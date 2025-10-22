#!/bin/sh
set -euo pipefail

if [ -z "${JWT_SECRET:-}" ]; then
  echo "[entrypoint] JWT_SECRET environment variable is required" >&2
  exit 1
fi

if [ "${SKIP_DB_MIGRATE:-0}" != "1" ]; then
  echo "[entrypoint] applying database migrations"
  if ! pnpm exec prisma migrate deploy --schema prisma/schema.prisma; then
    echo "[entrypoint] migrate deploy failed, attempting prisma db push" >&2
    pnpm exec prisma db push --schema prisma/schema.prisma
  fi
fi

exec node src/server.js
