#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backup}"
CONTAINER_NAME="${DB_CONTAINER_NAME:-medcore-db}"
DB_NAME="${DB_NAME:-medcore_db}"
DB_USER="${DB_USER:-postgres}"
BACKUP_FILE="${BACKUP_FILE:-}"
CONFIRM_RESTORE="${CONFIRM_RESTORE:-no}"

usage() {
  cat <<USAGE
Uso:
  BACKUP_FILE=/home/sppro/medcore-project/backup/medcore_db_YYYYMMDD_HHMMSS.sql.gz \
  CONFIRM_RESTORE=yes \
  ./scripts/restore_db_medcore.sh

Variáveis opcionais:
  DB_CONTAINER_NAME (default: medcore-db)
  DB_NAME          (default: medcore_db)
  DB_USER          (default: postgres)
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ -z "$BACKUP_FILE" ]]; then
  echo "[FAIL] Informe BACKUP_FILE com o caminho do arquivo .sql.gz"
  usage
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[FAIL] Arquivo de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

if [[ "$CONFIRM_RESTORE" != "yes" ]]; then
  echo "[FAIL] Operação destrutiva bloqueada. Defina CONFIRM_RESTORE=yes para continuar."
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

echo "[INFO] Restore iniciado para base '$DB_NAME' usando '$BACKUP_FILE'"

echo "[INFO] Recriando schema public..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

echo "[INFO] Restaurando dump..."
gzip -dc "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo "[OK] Restore concluído com sucesso."
