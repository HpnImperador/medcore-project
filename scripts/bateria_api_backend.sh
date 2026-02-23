#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TEST_BRANCH_ID="${TEST_BRANCH_ID:-}"
TEST_PATIENT_ID="${TEST_PATIENT_ID:-}"
TEST_DOCTOR_ID="${TEST_DOCTOR_ID:-}"

ok() { echo "[OK] $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

http_code() {
  local method="$1"; shift
  local url="$1"; shift
  curl -s -o /tmp/medcore_bateria_body.json -w "%{http_code}" -X "$method" "$url" "$@"
}

extract_json_field() {
  local field="$1"
  node -e "const fs=require('fs');const o=JSON.parse(fs.readFileSync('/tmp/medcore_bateria_body.json','utf8'));console.log((o${field}) ?? '')"
}

echo "== Bateria API MedCore =="
echo "BASE_URL: $BASE_URL"

CODE=$(http_code GET "$BASE_URL/api")
if [[ "$CODE" != "200" ]]; then
  fail "Swagger indisponível em $BASE_URL/api (HTTP $CODE)."
fi
ok "Swagger acessível (HTTP 200)."

if [[ -z "$TEST_EMAIL" || -z "$TEST_PASSWORD" ]]; then
  warn "TEST_EMAIL/TEST_PASSWORD não informados. Pulando testes autenticados."
  echo "Bateria finalizada parcialmente."
  exit 0
fi

LOGIN_PAYLOAD=$(cat <<JSON
{"email":"$TEST_EMAIL","password":"$TEST_PASSWORD"}
JSON
)

CODE=$(http_code POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_PAYLOAD")
if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Login falhou (HTTP $CODE)."
fi

TOKEN=$(extract_json_field "?.access_token")
if [[ -z "$TOKEN" || "$TOKEN" == "undefined" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Login não retornou access_token."
fi
ok "Login JWT válido."

CODE=$(http_code GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /users/me falhou (HTTP $CODE)."
fi
ok "Endpoint /users/me validado."

if [[ -z "$TEST_BRANCH_ID" || -z "$TEST_PATIENT_ID" || -z "$TEST_DOCTOR_ID" ]]; then
  warn "IDs de agendamento não informados. Pulando testes de /appointments."
  echo "Bateria finalizada com sucesso (auth + users)."
  exit 0
fi

SCHEDULED_AT=$(date -u -d '+2 hours' +"%Y-%m-%dT%H:%M:%S.000Z")
CREATE_APPT_PAYLOAD=$(cat <<JSON
{
  "branch_id": "$TEST_BRANCH_ID",
  "patient_id": "$TEST_PATIENT_ID",
  "doctor_id": "$TEST_DOCTOR_ID",
  "scheduled_at": "$SCHEDULED_AT",
  "notes": "Bateria automatizada"
}
JSON
)

CODE=$(http_code POST "$BASE_URL/appointments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_APPT_PAYLOAD")
if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "POST /appointments falhou (HTTP $CODE)."
fi

APPOINTMENT_ID=$(extract_json_field "?.id")
if [[ -z "$APPOINTMENT_ID" || "$APPOINTMENT_ID" == "undefined" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Criação de agendamento sem id no retorno."
fi
ok "Criação de agendamento validada (id=$APPOINTMENT_ID)."

CODE=$(http_code GET "$BASE_URL/appointments" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /appointments falhou (HTTP $CODE)."
fi
ok "Listagem de agendamentos validada."

CODE=$(http_code PATCH "$BASE_URL/appointments/$APPOINTMENT_ID/complete" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "PATCH /appointments/:id/complete falhou (HTTP $CODE)."
fi
ok "Conclusão de agendamento validada."

echo "Bateria finalizada com sucesso (auth + users + appointments)."
