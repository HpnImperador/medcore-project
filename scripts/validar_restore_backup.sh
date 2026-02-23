#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backup}"
BACKUP_FILE="${BACKUP_FILE:-}"
CONTAINER_NAME="${DB_CONTAINER_NAME:-medcore-db}"
DB_USER="${DB_USER:-postgres}"
TEMP_DB_NAME="${TEMP_DB_NAME:-medcore_restore_check}"
KEEP_TEMP_DB="${KEEP_TEMP_DB:-0}"

usage() {
  cat <<USAGE
Uso:
  ./scripts/validar_restore_backup.sh

Variáveis opcionais:
  BACKUP_FILE        Caminho do .sql.gz (default: último backup em backup/)
  DB_CONTAINER_NAME  Nome do container PostgreSQL (default: medcore-db)
  DB_USER            Usuário PostgreSQL (default: postgres)
  TEMP_DB_NAME       Nome da base temporária de validação (default: medcore_restore_check)
  KEEP_TEMP_DB       1 para não remover base temporária ao final (default: 0)
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ -z "$BACKUP_FILE" ]]; then
  BACKUP_FILE="$(ls -1t "$BACKUP_DIR"/medcore_db_*.sql.gz 2>/dev/null | head -n1 || true)"
fi

if [[ -z "$BACKUP_FILE" ]]; then
  echo "[FAIL] Nenhum backup encontrado em $BACKUP_DIR"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[FAIL] Arquivo de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[FAIL] docker não encontrado no PATH."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[FAIL] container '${CONTAINER_NAME}' não está em execução."
  exit 1
fi

echo "[INFO] Validando restore com backup: $BACKUP_FILE"
echo "[INFO] Base temporária: $TEMP_DB_NAME"

cleanup() {
  if [[ "$KEEP_TEMP_DB" == "1" ]]; then
    echo "[INFO] KEEP_TEMP_DB=1 -> base temporária mantida: $TEMP_DB_NAME"
    return 0
  fi

  docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$TEMP_DB_NAME\";" >/dev/null
  echo "[INFO] Base temporária removida: $TEMP_DB_NAME"
}
trap cleanup EXIT

docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$TEMP_DB_NAME\";" >/dev/null

docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres \
  -c "CREATE DATABASE \"$TEMP_DB_NAME\";" >/dev/null

echo "[INFO] Restaurando dump na base temporária..."
gzip -dc "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$TEMP_DB_NAME" >/dev/null

MISSING_TABLES="$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$TEMP_DB_NAME" -tA -c "
WITH expected(table_name) AS (
  VALUES
    ('organizations'),
    ('branches'),
    ('users'),
    ('user_branches'),
    ('patients'),
    ('appointments'),
    ('refresh_tokens')
)
SELECT COALESCE(string_agg(e.table_name, ','), '')
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema='public' AND t.table_name=e.table_name
WHERE t.table_name IS NULL;
")"

if [[ -n "$MISSING_TABLES" ]]; then
  echo "[FAIL] Restore inválido: tabelas críticas ausentes: $MISSING_TABLES"
  exit 1
fi

TABLE_COUNT="$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$TEMP_DB_NAME" -tA -c "
SELECT count(*)::text
FROM information_schema.tables
WHERE table_schema='public';
")"

echo "[OK] Restore validado com sucesso."
echo "[OK] Total de tabelas no schema public: ${TABLE_COUNT:-0}"
