#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TEST_BRANCH_ID="${TEST_BRANCH_ID:-}"
TEST_PATIENT_ID="${TEST_PATIENT_ID:-}"
TEST_DOCTOR_ID="${TEST_DOCTOR_ID:-}"
SEED_ENV_FILE="${SEED_ENV_FILE:-/home/sppro/medcore-project/backend/.seed.env}"

INPUT_TEST_EMAIL="$TEST_EMAIL"
INPUT_TEST_PASSWORD="$TEST_PASSWORD"
INPUT_TEST_BRANCH_ID="$TEST_BRANCH_ID"
INPUT_TEST_PATIENT_ID="$TEST_PATIENT_ID"
INPUT_TEST_DOCTOR_ID="$TEST_DOCTOR_ID"

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
  node -e "const fs=require('fs');const body=JSON.parse(fs.readFileSync('/tmp/medcore_bateria_body.json','utf8'));const data=(body && typeof body==='object' && 'data' in body)?body.data:body;const v=(data && typeof data==='object')?data['$field']:undefined;console.log(v ?? '')"
}

echo "== Bateria API MedCore =="
echo "BASE_URL: $BASE_URL"

if [[ -f "$SEED_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SEED_ENV_FILE"
fi

TEST_EMAIL="${INPUT_TEST_EMAIL:-${TEST_EMAIL:-}}"
TEST_PASSWORD="${INPUT_TEST_PASSWORD:-${TEST_PASSWORD:-}}"
TEST_BRANCH_ID="${INPUT_TEST_BRANCH_ID:-${TEST_BRANCH_ID:-}}"
TEST_PATIENT_ID="${INPUT_TEST_PATIENT_ID:-${TEST_PATIENT_ID:-}}"
TEST_DOCTOR_ID="${INPUT_TEST_DOCTOR_ID:-${TEST_DOCTOR_ID:-}}"

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

TOKEN=$(extract_json_field "access_token")
if [[ -z "$TOKEN" || "$TOKEN" == "undefined" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Login não retornou access_token."
fi

REFRESH_TOKEN=$(extract_json_field "refresh_token")
if [[ -z "$REFRESH_TOKEN" || "$REFRESH_TOKEN" == "undefined" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Login não retornou refresh_token."
fi
ok "Login JWT válido."

CODE=$(http_code GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /users/me falhou (HTTP $CODE)."
fi
ok "Endpoint /users/me validado."

REFRESH_PAYLOAD=$(cat <<JSON
{"refresh_token":"$REFRESH_TOKEN"}
JSON
)

CODE=$(http_code POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "$REFRESH_PAYLOAD")
if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "POST /auth/refresh falhou (HTTP $CODE)."
fi

NEW_TOKEN=$(extract_json_field "access_token")
NEW_REFRESH_TOKEN=$(extract_json_field "refresh_token")
if [[ -z "$NEW_TOKEN" || -z "$NEW_REFRESH_TOKEN" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Refresh não retornou novo par de tokens."
fi
ok "Refresh token rotacionado com sucesso."

LOGOUT_PAYLOAD=$(cat <<JSON
{"refresh_token":"$NEW_REFRESH_TOKEN"}
JSON
)

CODE=$(http_code POST "$BASE_URL/auth/logout" \
  -H "Content-Type: application/json" \
  -d "$LOGOUT_PAYLOAD")
if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "POST /auth/logout falhou (HTTP $CODE)."
fi
ok "Logout por refresh token validado."

CODE=$(http_code POST "$BASE_URL/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "$LOGOUT_PAYLOAD")
if [[ "$CODE" != "401" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Refresh após logout deveria falhar com 401 (HTTP $CODE)."
fi
ok "Refresh revogado corretamente após logout."

CODE=$(http_code POST "$BASE_URL/auth/logout-all" \
  -H "Authorization: Bearer $NEW_TOKEN")
if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "POST /auth/logout-all falhou (HTTP $CODE)."
fi
ok "Logout global validado."

if [[ -z "$TEST_BRANCH_ID" || -z "$TEST_PATIENT_ID" || -z "$TEST_DOCTOR_ID" ]]; then
  warn "IDs de agendamento não informados. Pulando testes de /appointments."
  echo "Bateria finalizada com sucesso (auth + users + sessao)."
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
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_APPT_PAYLOAD")
if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "POST /appointments falhou (HTTP $CODE)."
fi

APPOINTMENT_ID=$(extract_json_field "id")
if [[ -z "$APPOINTMENT_ID" || "$APPOINTMENT_ID" == "undefined" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Criação de agendamento sem id no retorno."
fi
ok "Criação de agendamento validada (id=$APPOINTMENT_ID)."

CODE=$(http_code GET "$BASE_URL/appointments" \
  -H "Authorization: Bearer $NEW_TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /appointments falhou (HTTP $CODE)."
fi
ok "Listagem de agendamentos validada."

CODE=$(http_code PATCH "$BASE_URL/appointments/$APPOINTMENT_ID/complete" \
  -H "Authorization: Bearer $NEW_TOKEN")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "PATCH /appointments/:id/complete falhou (HTTP $CODE)."
fi
ok "Conclusão de agendamento validada."

echo "Bateria finalizada com sucesso (auth + users + sessao + appointments)."
