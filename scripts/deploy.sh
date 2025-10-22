#!/bin/sh
set -euo pipefail

echo "[deploy] placeholder script"
echo "This script currently builds and starts the stack locally via docker compose."

docker compose up -d --build
