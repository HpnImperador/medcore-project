#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@medcore.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-123456}"
LIMIT="${LIMIT:-10}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
INCLUDE_FAILED="${INCLUDE_FAILED:-false}"
DRY_RUN="${DRY_RUN:-true}"

ok() { echo "[OK] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

http_code() {
  local method="$1"; shift
  local url="$1"; shift
  local code
  if ! code=$(curl -sS -o /tmp/medcore_outbox_cleanup_body.json -w "%{http_code}" -X "$method" "$url" "$@"); then
    echo "000"
    return 0
  fi
  echo "$code"
}

extract_access_token() {
  node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync('/tmp/medcore_outbox_cleanup_body.json','utf8')); console.log(r?.data?.access_token || '')"
}

echo "== Teste Operacional Outbox Cleanup =="
echo "BASE_URL: $BASE_URL"
echo "ADMIN_EMAIL: $ADMIN_EMAIL"

CODE=$(http_code GET "$BASE_URL/health")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "Backend indisponível (GET /health -> HTTP $CODE)."
fi
ok "Backend acessível."

LOGIN_PAYLOAD=$(cat <<JSON
{"email":"$ADMIN_EMAIL","password":"$ADMIN_PASSWORD"}
JSON
)

CODE=$(http_code POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_PAYLOAD")
if [[ "$CODE" != "200" && "$CODE" != "201" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "Login admin falhou (HTTP $CODE)."
fi

TOKEN="$(extract_access_token)"
if [[ -z "$TOKEN" || "$TOKEN" == "undefined" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "Login admin não retornou access_token."
fi
ok "Login admin validado."

CODE=$(http_code GET "$BASE_URL/outbox/maintenance-audit?limit=$LIMIT" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "GET /outbox/maintenance-audit falhou (HTTP $CODE)."
fi
ok "Consulta inicial de auditoria validada."

CLEANUP_PAYLOAD=$(cat <<JSON
{"retention_days":$RETENTION_DAYS,"include_failed":$INCLUDE_FAILED,"dry_run":$DRY_RUN}
JSON
)

CODE=$(http_code POST "$BASE_URL/outbox/cleanup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CLEANUP_PAYLOAD")
if [[ "$CODE" != "200" && "$CODE" != "201" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "POST /outbox/cleanup falhou (HTTP $CODE)."
fi
ok "Execução de cleanup validada."

CODE=$(http_code GET "$BASE_URL/outbox/maintenance-audit?limit=$LIMIT" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "GET /outbox/maintenance-audit (pós-cleanup) falhou (HTTP $CODE)."
fi
ok "Auditoria pós-cleanup validada."

CODE=$(http_code GET "$BASE_URL/outbox/audit/export?type=maintenance&format=json&limit=$LIMIT" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "GET /outbox/audit/export (json) falhou (HTTP $CODE)."
fi
ok "Export JSON de auditoria validado."

CODE=$(http_code GET "$BASE_URL/outbox/audit/export?type=replay&format=csv&limit=$LIMIT" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "GET /outbox/audit/export (csv) falhou (HTTP $CODE)."
fi
ok "Export CSV de auditoria validado."

AUDIT_CLEANUP_PAYLOAD=$(cat <<JSON
{"retention_days":90,"dry_run":true}
JSON
)
CODE=$(http_code POST "$BASE_URL/outbox/audit/cleanup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$AUDIT_CLEANUP_PAYLOAD")
if [[ "$CODE" != "200" && "$CODE" != "201" ]]; then
  cat /tmp/medcore_outbox_cleanup_body.json
  fail "POST /outbox/audit/cleanup falhou (HTTP $CODE)."
fi
ok "Retenção de auditoria validada."

echo "Teste finalizado com sucesso."
