#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
PORT="${PORT:-3000}"

kill_port_process() {
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  fi

  if [[ -z "$pids" ]] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser -n tcp "$PORT" 2>/dev/null || true)"
  fi

  if [[ -z "$pids" ]] && command -v ss >/dev/null 2>&1; then
    pids="$(ss -ltnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $NF}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)"
  fi

  if [[ -n "$pids" ]]; then
    echo "[INFO] Encerrando processo(s) na porta $PORT: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

kill_port_process

cd "$BACKEND_DIR"
echo "[INFO] Subindo backend em modo watch na porta $PORT..."
exec npm run start:dev
