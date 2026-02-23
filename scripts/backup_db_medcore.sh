#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backup}"
CONTAINER_NAME="${DB_CONTAINER_NAME:-medcore-db}"
DB_NAME="${DB_NAME:-medcore_db}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-15}"
TIMESTAMP="$(date -u +'%Y%m%d_%H%M%S')"
OUT_FILE="$BACKUP_DIR/medcore_db_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[FAIL] docker não encontrado no PATH."
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[FAIL] container '${CONTAINER_NAME}' não está em execução."
  exit 1
fi

echo "[INFO] Gerando backup em: $OUT_FILE"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$OUT_FILE"

echo "[INFO] Aplicando retenção: ${RETENTION_DAYS} dia(s)."
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'medcore_db_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "[OK] Backup concluído: $OUT_FILE"
