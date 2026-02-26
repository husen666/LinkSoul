#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/linksoul}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/infrastructure/docker/docker-compose.prod.yml}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$PROJECT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy] Missing env file: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

BASE_PATH="${PROJECT_BASE_PATH:-/linksoul}"
LOCAL_HTTPS_PORT="${LOCAL_HTTPS_PORT:-8443}"
HEALTHCHECK_HOST="${HEALTHCHECK_HOST:-${APP_DOMAIN}}"
HEALTHCHECK_BASE_URL="${HEALTHCHECK_BASE_URL:-https://127.0.0.1:${LOCAL_HTTPS_PORT}}"

echo "[deploy] Fetching latest code..."
git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[deploy] Building service images..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend admin ai

echo "[deploy] Starting database/cache first..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis

echo "[deploy] Running Prisma migration..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend \
  pnpm --filter @linksoul/backend exec prisma migrate deploy

echo "[deploy] Starting app services..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend ai admin nginx

healthcheck() {
  local url="$1"
  local name="$2"
  local retries=30
  local wait=5
  local i=1
  while [[ $i -le $retries ]]; do
    if curl -k -fsS -H "Host: ${HEALTHCHECK_HOST}" "$url" >/dev/null 2>&1; then
      echo "[deploy] $name is healthy: $url"
      return 0
    fi
    sleep "$wait"
    i=$((i + 1))
  done
  echo "[deploy] $name health check failed: $url"
  return 1
}

echo "[deploy] Health checks..."
healthcheck "${HEALTHCHECK_BASE_URL}${BASE_PATH}/api/v1/health" "Backend API"
healthcheck "${HEALTHCHECK_BASE_URL}${BASE_PATH}/admin/" "Admin"
healthcheck "${HEALTHCHECK_BASE_URL}${BASE_PATH}/mobile/" "Mobile web entry"

echo "[deploy] Deployment completed successfully."
