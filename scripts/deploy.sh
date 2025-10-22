#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] environment file '$ENV_FILE' not found" >&2
  echo "[deploy] create the file or override ENV_FILE before retrying" >&2
  exit 1
fi

set -o allexport
# shellcheck disable=SC1090
. "$ENV_FILE"
set +o allexport

resolve_owner() {
  if [ -n "${REGISTRY_OWNER:-}" ]; then
    printf '%s' "$REGISTRY_OWNER"
    return
  fi

  if git config --get remote.origin.url >/dev/null 2>&1; then
    local remote_url
    remote_url="$(git config --get remote.origin.url)"
    case "$remote_url" in
      *://*)
        remote_url="${remote_url#*://}"
        remote_url="${remote_url#*/}"
        ;;
      *@*)
        remote_url="${remote_url#*:}"
        ;;
    esac
    printf '%s' "${remote_url%%/*}"
    return
  fi

  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    printf '%s' "${GITHUB_REPOSITORY%%/*}"
    return
  fi

  printf '%s' "wxresume"
}

if [ -z "${API_IMAGE:-}" ]; then
  OWNER="$(resolve_owner)"
  OWNER_LOWER="${OWNER,,}"
  IMAGE_TAG="${IMAGE_TAG:-latest}"
  API_IMAGE="ghcr.io/${OWNER_LOWER}/wxresume-api:${IMAGE_TAG}"
fi

export API_IMAGE

echo "[deploy] using compose file: $COMPOSE_FILE"
echo "[deploy] using env file: $ENV_FILE"
echo "[deploy] target image: $API_IMAGE"

compose_cmd=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "[deploy] pulling images"
"${compose_cmd[@]}" pull

echo "[deploy] starting services"
"${compose_cmd[@]}" up -d --remove-orphans

echo "[deploy] deployment completed"
