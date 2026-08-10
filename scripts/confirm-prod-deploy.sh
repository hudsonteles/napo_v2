#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Salvaguarda contra deploy acidental em produção (ARCHITECTURE §6.4).
#
# Exige a digitação LITERAL do nome do projeto prod antes de prosseguir. Como a
# Vercel publica por git push, o risco real está no BANCO — por isso este script
# é encadeado às migrations de produção:
#
#   "db:push:prod": "bash scripts/confirm-prod-deploy.sh napo-prod && supabase db push --linked"
#
# Escrito agora (NAPO-001) e usado quando o projeto prod existir (NAPO-021).
# NÃO remover.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

esperado="${1:-}"

if [[ -z "$esperado" ]]; then
  echo "ERRO: nome do projeto de produção não informado." >&2
  echo "Uso: bash scripts/confirm-prod-deploy.sh <nome-do-projeto-prod>" >&2
  exit 2
fi

echo "⚠️  Você está prestes a aplicar migrations em PRODUÇÃO: '${esperado}'."
echo "    Isto altera o banco real. Digite o nome do projeto para confirmar."
printf "    Nome do projeto: "
read -r digitado

if [[ "$digitado" != "$esperado" ]]; then
  echo "❌ Abortado: '${digitado}' não confere com '${esperado}'. Nada foi aplicado." >&2
  exit 1
fi

echo "✅ Confirmado. Prosseguindo com o deploy em '${esperado}'."
