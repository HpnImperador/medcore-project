#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backup}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"
MAX_RESTORE_CHECK_AGE_DAYS="${MAX_RESTORE_CHECK_AGE_DAYS:-8}"
RESTORE_LOG_FILE="${RESTORE_LOG_FILE:-$BACKUP_DIR/restore_check_cron.log}"
NOW_EPOCH="$(date +%s)"

status="ok"
issues=()

latest_backup="$(ls -1t "$BACKUP_DIR"/medcore_db_*.sql.gz 2>/dev/null | head -n1 || true)"
if [[ -z "$latest_backup" ]]; then
  status="error"
  issues+=("backup_nao_encontrado")
else
  backup_mtime="$(stat -c %Y "$latest_backup")"
  backup_age_hours="$(( (NOW_EPOCH - backup_mtime) / 3600 ))"
  if (( backup_age_hours > MAX_BACKUP_AGE_HOURS )); then
    status="degraded"
    issues+=("backup_antigo_${backup_age_hours}h")
  fi
fi

if [[ ! -f "$RESTORE_LOG_FILE" ]]; then
  status="degraded"
  issues+=("restore_log_ausente")
else
  restore_mtime="$(stat -c %Y "$RESTORE_LOG_FILE")"
  restore_age_days="$(( (NOW_EPOCH - restore_mtime) / 86400 ))"
  if (( restore_age_days > MAX_RESTORE_CHECK_AGE_DAYS )); then
    status="degraded"
    issues+=("restore_check_antigo_${restore_age_days}d")
  fi
fi

if [[ ${#issues[@]} -eq 0 ]]; then
  issues+=("none")
fi

printf '{"status":"%s","latest_backup":"%s","issues":"%s","timestamp":"%s"}\n' \
  "$status" \
  "${latest_backup:-null}" \
  "$(IFS=,; echo "${issues[*]}")" \
  "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

if [[ "$status" == "error" ]]; then
  exit 2
fi
if [[ "$status" == "degraded" ]]; then
  exit 1
fi
exit 0
