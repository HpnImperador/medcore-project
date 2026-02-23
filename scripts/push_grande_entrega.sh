#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Erro: execute dentro de um repositório git."
  exit 1
fi

ensure_ssh_agent() {
  local agent_env="${HOME}/.ssh/agent_env"
  local status=0

  # Prioriza agente já ativo na sessão atual.
  if [[ -n "${SSH_AUTH_SOCK:-}" ]]; then
    if ssh-add -l >/dev/null 2>&1; then
      mkdir -p "${HOME}/.ssh"
      {
        echo "export SSH_AUTH_SOCK='${SSH_AUTH_SOCK}'"
        echo "export SSH_AGENT_PID='${SSH_AGENT_PID:-}'"
      } >"$agent_env"
      chmod 600 "$agent_env"
      return 0
    fi
    status=$?
    if [[ "$status" -eq 2 ]]; then
      unset SSH_AUTH_SOCK SSH_AGENT_PID
    fi
  fi

  if [[ -f "$agent_env" ]]; then
    # shellcheck source=/dev/null
    source "$agent_env"
  fi

  if ssh-add -l >/dev/null 2>&1; then
    status=0
  else
    status=$?
  fi
  if [[ "$status" -eq 2 ]]; then
    mkdir -p "${HOME}/.ssh"
    ssh-agent -s >"$agent_env"
    chmod 600 "$agent_env"
    # shellcheck source=/dev/null
    source "$agent_env"
  fi

  if ssh-add -l >/dev/null 2>&1; then
    status=0
  else
    status=$?
  fi
  if [[ "$status" -eq 2 ]]; then
    echo "Erro: ssh-agent indisponível."
    exit 2
  fi
}

check_ssh_identity_loaded() {
  local status=0
  if ssh-add -l >/dev/null 2>&1; then
    status=0
  else
    status=$?
  fi

  if [[ "$status" -eq 2 ]]; then
    echo "Erro: ssh-agent indisponível."
    exit 2
  fi

  if [[ "$status" -eq 1 ]]; then
    echo "Erro: chave SSH não carregada no agente."
    echo "Execute uma vez no servidor:"
    echo "  ssh-add ~/.ssh/id_ed25519"
    echo "Depois rode novamente este script."
    exit 3
  fi
}

push_with_dns_retry() {
  local attempts=5
  local sleep_seconds=3
  local current_branch
  current_branch="$(git rev-parse --abbrev-ref HEAD)"

  local i
  for i in $(seq 1 "$attempts"); do
    if output="$(git push origin "$current_branch" 2>&1)"; then
      echo "$output"
      return 0
    fi

    echo "$output"

    if grep -Eq "Could not resolve hostname github.com|Temporary failure in name resolution" <<<"$output"; then
      if [[ "$i" -lt "$attempts" ]]; then
        echo "Aviso: falha DNS transitória (tentativa $i/$attempts). Retentando em ${sleep_seconds}s..."
        sleep "$sleep_seconds"
        sleep_seconds=$((sleep_seconds * 2))
        continue
      fi
    fi

    return 1
  done

  return 1
}

SCOPE="${1:-geral}"
STAMP="$(date '+%Y-%m-%d %H:%M')"
MSG="chore(entrega): ${STAMP} | ${SCOPE}"

ensure_ssh_agent
check_ssh_identity_loaded

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "$MSG"
  push_with_dns_retry
  echo "Push concluído com sucesso."
  echo "Commit: $MSG"
else
  echo "Nenhuma alteração para commit/push."
fi
