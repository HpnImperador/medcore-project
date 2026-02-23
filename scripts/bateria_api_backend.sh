#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PASSWORD="${TEST_PASSWORD:-}"
TEST_BRANCH_ID="${TEST_BRANCH_ID:-}"
TEST_PATIENT_ID="${TEST_PATIENT_ID:-}"
TEST_DOCTOR_ID="${TEST_DOCTOR_ID:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_ENV_FILE="${SEED_ENV_FILE:-$REPO_ROOT/backend/.seed.env}"
ENABLE_BRUTE_FORCE_CHECK="${ENABLE_BRUTE_FORCE_CHECK:-1}"
LOGIN_MAX_FAILED_ATTEMPTS="${LOGIN_MAX_FAILED_ATTEMPTS:-5}"
BRUTE_FORCE_TEST_IP="${BRUTE_FORCE_TEST_IP:-198.51.100.10}"

INPUT_TEST_EMAIL="$TEST_EMAIL"
INPUT_TEST_PASSWORD="$TEST_PASSWORD"
INPUT_TEST_BRANCH_ID="$TEST_BRANCH_ID"
INPUT_TEST_PATIENT_ID="$TEST_PATIENT_ID"
INPUT_TEST_DOCTOR_ID="$TEST_DOCTOR_ID"
INPUT_ADMIN_EMAIL="$ADMIN_EMAIL"
INPUT_ADMIN_PASSWORD="$ADMIN_PASSWORD"

ok() { echo "[OK] $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

http_code() {
  local method="$1"; shift
  local url="$1"; shift
  local code
  if ! code=$(curl -sS -o /tmp/medcore_bateria_body.json -w "%{http_code}" -X "$method" "$url" "$@"); then
    echo "000"
    return 0
  fi

  echo "$code"
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
ADMIN_EMAIL="${INPUT_ADMIN_EMAIL:-${ADMIN_EMAIL:-}}"
ADMIN_PASSWORD="${INPUT_ADMIN_PASSWORD:-${ADMIN_PASSWORD:-}}"

CODE=$(http_code GET "$BASE_URL/api")
if [[ "$CODE" == "000" ]]; then
  fail "Não foi possível conectar em $BASE_URL. Verifique se o backend está rodando."
fi
if [[ "$CODE" != "200" ]]; then
  fail "Swagger indisponível em $BASE_URL/api (HTTP $CODE)."
fi
ok "Swagger acessível (HTTP 200)."

CODE=$(http_code GET "$BASE_URL/health")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /health falhou (HTTP $CODE)."
fi
ok "Health summary validado."

CODE=$(http_code GET "$BASE_URL/health/db")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /health/db falhou (HTTP $CODE)."
fi
ok "Health DB validado."

CODE=$(http_code GET "$BASE_URL/health/metrics")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /health/metrics falhou (HTTP $CODE)."
fi
ok "Health metrics validado."

CODE=$(http_code GET "$BASE_URL/health/alert-check")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /health/alert-check falhou (HTTP $CODE)."
fi
ok "Health alert-check validado."

CODE=$(http_code GET "$BASE_URL/health/alerts?limit=5")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "GET /health/alerts falhou (HTTP $CODE)."
fi
ok "Health alerts history validado."

if [[ -z "$TEST_EMAIL" || -z "$TEST_PASSWORD" ]]; then
  warn "TEST_EMAIL/TEST_PASSWORD não informados. Pulando testes autenticados."
  echo "Bateria finalizada parcialmente."
  exit 0
fi

if [[ "$ENABLE_BRUTE_FORCE_CHECK" == "1" ]]; then
  BRUTE_TEST_EMAIL="bruteforce.$(date +%s)@medcore.local"
  BRUTE_TEST_PASSWORD="senha-invalida"
  LAST_ATTEMPT=$((LOGIN_MAX_FAILED_ATTEMPTS + 1))

  for attempt in $(seq 1 "$LAST_ATTEMPT"); do
    BRUTE_PAYLOAD=$(cat <<JSON
{"email":"$BRUTE_TEST_EMAIL","password":"$BRUTE_TEST_PASSWORD"}
JSON
)
    CODE=$(http_code POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -H "X-Forwarded-For: $BRUTE_FORCE_TEST_IP" \
      -d "$BRUTE_PAYLOAD")

    if [[ "$attempt" -le "$LOGIN_MAX_FAILED_ATTEMPTS" ]]; then
      if [[ "$CODE" != "401" ]]; then
        cat /tmp/medcore_bateria_body.json
        fail "Brute force check falhou na tentativa $attempt (esperado 401, recebido $CODE)."
      fi
      continue
    fi

    if [[ "$CODE" != "429" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "Brute force check falhou no bloqueio (esperado 429, recebido $CODE)."
    fi
  done
  ok "Proteção de brute force validada (401 até limite + 429 no bloqueio)."

  if [[ -n "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]]; then
    ADMIN_LOGIN_PAYLOAD=$(cat <<JSON
{"email":"$ADMIN_EMAIL","password":"$ADMIN_PASSWORD"}
JSON
)
    CODE=$(http_code POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "$ADMIN_LOGIN_PAYLOAD")
    if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "Login admin falhou (HTTP $CODE)."
    fi

    ADMIN_TOKEN=$(extract_json_field "access_token")
    if [[ -z "$ADMIN_TOKEN" || "$ADMIN_TOKEN" == "undefined" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "Login admin não retornou access_token."
    fi

    CODE=$(http_code GET "$BASE_URL/auth/login-lock?email=$BRUTE_TEST_EMAIL&ip=$BRUTE_FORCE_TEST_IP" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    if [[ "$CODE" != "200" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "GET /auth/login-lock falhou (HTTP $CODE)."
    fi

    LOCKED_STATUS=$(extract_json_field "locked")
    if [[ "$LOCKED_STATUS" != "true" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "GET /auth/login-lock deveria retornar locked=true."
    fi

    CLEAR_LOCK_PAYLOAD=$(cat <<JSON
{"email":"$BRUTE_TEST_EMAIL","ip":"$BRUTE_FORCE_TEST_IP"}
JSON
)
    CODE=$(http_code POST "$BASE_URL/auth/login-lock/clear" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$CLEAR_LOCK_PAYLOAD")
    if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "POST /auth/login-lock/clear falhou (HTTP $CODE)."
    fi

    CODE=$(http_code GET "$BASE_URL/auth/login-lock?email=$BRUTE_TEST_EMAIL&ip=$BRUTE_FORCE_TEST_IP" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    if [[ "$CODE" != "200" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "GET /auth/login-lock (pós-clear) falhou (HTTP $CODE)."
    fi

    LOCKED_STATUS=$(extract_json_field "locked")
    if [[ "$LOCKED_STATUS" != "false" ]]; then
      cat /tmp/medcore_bateria_body.json
      fail "Lock deveria estar limpo após /auth/login-lock/clear."
    fi
    ok "Endpoints admin de lock de login validados."
  else
    warn "ADMIN_EMAIL/ADMIN_PASSWORD não informados. Pulando validação dos endpoints admin de lock."
  fi
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

SCHEDULED_AT_2=$(date -u -d '+4 hours' +"%Y-%m-%dT%H:%M:%S.000Z")
CREATE_APPT_PAYLOAD_2=$(cat <<JSON
{
  "branch_id": "$TEST_BRANCH_ID",
  "patient_id": "$TEST_PATIENT_ID",
  "doctor_id": "$TEST_DOCTOR_ID",
  "scheduled_at": "$SCHEDULED_AT_2",
  "notes": "Bateria automatizada - cancel/reagendamento"
}
JSON
)

CODE=$(http_code POST "$BASE_URL/appointments" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_APPT_PAYLOAD_2")
if [[ "$CODE" != "201" && "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "POST /appointments (2) falhou (HTTP $CODE)."
fi

APPOINTMENT_ID_2=$(extract_json_field "id")
if [[ -z "$APPOINTMENT_ID_2" || "$APPOINTMENT_ID_2" == "undefined" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "Criação do segundo agendamento sem id no retorno."
fi
ok "Segundo agendamento criado para validar reagendamento/cancelamento (id=$APPOINTMENT_ID_2)."

RESCHEDULED_AT=$(date -u -d '+6 hours' +"%Y-%m-%dT%H:%M:%S.000Z")
RESCHEDULE_PAYLOAD=$(cat <<JSON
{
  "scheduled_at": "$RESCHEDULED_AT",
  "reason": "Conflito de agenda médica"
}
JSON
)

CODE=$(http_code PATCH "$BASE_URL/appointments/$APPOINTMENT_ID_2/reschedule" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RESCHEDULE_PAYLOAD")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "PATCH /appointments/:id/reschedule falhou (HTTP $CODE)."
fi
ok "Reagendamento validado."

CANCEL_PAYLOAD=$(cat <<JSON
{
  "reason": "Paciente indisposto no dia da consulta"
}
JSON
)

CODE=$(http_code PATCH "$BASE_URL/appointments/$APPOINTMENT_ID_2/cancel" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CANCEL_PAYLOAD")
if [[ "$CODE" != "200" ]]; then
  cat /tmp/medcore_bateria_body.json
  fail "PATCH /appointments/:id/cancel falhou (HTTP $CODE)."
fi
ok "Cancelamento validado."

echo "Bateria finalizada com sucesso (auth + users + sessao + appointments + cancelamento/reagendamento)."
