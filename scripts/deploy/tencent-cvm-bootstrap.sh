#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/linksoul}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.prod}"
AI_ENV_FILE="${AI_ENV_FILE:-$PROJECT_DIR/ai-services/.env.prod}"

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "[bootstrap] PROJECT_DIR does not exist: $PROJECT_DIR"
  echo "[bootstrap] Clone project first, e.g. git clone <repo> $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[bootstrap] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[bootstrap] Installing Docker Compose plugin..."
  apt-get update
  apt-get install -y docker-compose-plugin
fi

apt-get update
apt-get install -y certbot

mkdir -p /var/www/certbot

if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.prod.example "$ENV_FILE"
  echo "[bootstrap] Created $ENV_FILE from template"
fi

if [[ ! -f "$AI_ENV_FILE" ]]; then
  cp ai-services/.env.prod.example "$AI_ENV_FILE"
  echo "[bootstrap] Created $AI_ENV_FILE from template"
fi

set -a
source "$ENV_FILE"
set +a

required_vars=("APP_DOMAIN" "LETSENCRYPT_EMAIL")
for v in "${required_vars[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "[bootstrap] Missing required variable in .env.prod: $v"
    exit 1
  fi
done

if [[ ! -f "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" ]]; then
  echo "[bootstrap] Requesting Let's Encrypt certificates..."
  certbot certonly --standalone --non-interactive --agree-tos \
    -m "$LETSENCRYPT_EMAIL" \
    -d "$APP_DOMAIN"
else
  echo "[bootstrap] Existing certificate detected, skip issue."
fi

echo "[bootstrap] Running first deploy..."
bash scripts/deploy/tencent-cvm-deploy.sh

echo "[bootstrap] Done."
