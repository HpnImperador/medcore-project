#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Erro: execute dentro de um repositório git."
  exit 1
fi

SCOPE="${1:-geral}"
STAMP="$(date '+%Y-%m-%d %H:%M')"
MSG="chore(entrega): ${STAMP} | ${SCOPE}"

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MSG"
  git push
  echo "Push concluído com sucesso."
  echo "Commit: $MSG"
else
  echo "Nenhuma alteração para commit/push."
fi
