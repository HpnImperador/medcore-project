#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
START_DB="${START_DB:-1}"

info() { echo "[INFO] $1"; }
ok() { echo "[OK] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

if [[ "$START_DB" == "1" ]]; then
  info "Subindo Postgres (serviço alloydb) via docker compose..."
  docker compose -f "$REPO_ROOT/docker-compose.yml" up -d alloydb >/dev/null
  ok "Postgres pronto (alloydb)."
fi

info "Aplicando migrações pendentes (prisma:deploy)..."
(
  cd "$BACKEND_DIR"
  npm run prisma:deploy >/dev/null
)
ok "Migrações aplicadas."

info "Executando seed idempotente..."
(
  cd "$BACKEND_DIR"
  npm run prisma:seed >/dev/null
)
ok "Seed concluído."

info "Validando se backend está acessível em $BASE_URL..."
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api" || true)"
if [[ "$HTTP_CODE" != "200" ]]; then
  fail "Backend indisponível em $BASE_URL (HTTP $HTTP_CODE). Inicie com: ./scripts/start_backend_safe.sh"
fi
ok "Backend acessível."

info "Executando bateria de API..."
BASE_URL="$BASE_URL" "$REPO_ROOT/scripts/bateria_api_backend.sh"
ok "Validação fim a fim concluída."
