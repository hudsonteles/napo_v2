#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Aplica migrations novas automaticamente após um `git pull`.
#
# Chamado pelos hooks .githooks/post-merge (pull normal) e post-rewrite (pull
# --rebase). Desenvolvimento em duas máquinas: puxou migration nova, o banco
# local se sincroniza sozinho — sem depender de lembrar de rodar à mão.
#
# Comportamento:
#   • Só arquivos NOVOS em supabase/migrations/  → migration up + regenera tipos.
#   • Migration existente MODIFICADA/REMOVIDA    → avisa e sugere db:reset
#     (migration up não reaplica o que já foi aplicado).
#   • Supabase local desligado                   → avisa, não trava o pull.
#   • Nada mudou em migrations/                  → silêncio total.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Referência anterior confiável: ORIG_HEAD (pull/rebase o define) com fallback.
prev="$(git rev-parse --verify --quiet ORIG_HEAD || true)"
if [[ -z "$prev" ]]; then
  prev="$(git rev-parse --verify --quiet 'HEAD@{1}' || true)"
fi
curr="$(git rev-parse HEAD)"

# Sem referência anterior ou nada avançou → nada a fazer.
[[ -z "$prev" || "$prev" == "$curr" ]] && exit 0

# O que mudou em supabase/migrations/ neste intervalo.
changes="$(git diff --name-status "$prev" "$curr" -- supabase/migrations/ 2>/dev/null || true)"
[[ -z "$changes" ]] && exit 0

echo ""
echo "🐘 [napo] Migrations mudaram neste pull:"
echo "$changes" | sed 's/^/    /'

# Migration já aplicada foi reescrita/removida/renomeada → migration up não basta.
if echo "$changes" | grep -qE '^(M|D|R)'; then
  echo "⚠️  Uma migration existente foi modificada/removida — 'migration up' não reaplica o que já rodou."
  echo "    Rode:  pnpm db:reset   (recria o banco do zero a partir das migrations + seed; apaga dados locais de dev)"
  exit 0
fi

# Caminho feliz (apenas arquivos novos): precisa do Supabase local de pé.
if ! pnpm exec supabase status >/dev/null 2>&1; then
  echo "ℹ️  Supabase local está desligado — nada foi aplicado agora."
  echo "    Suba com  pnpm db:start  (ou  pnpm db:migrate  se já estiver rodando) para aplicar."
  exit 0
fi

echo "→ Aplicando migrations pendentes (supabase migration up)…"
pnpm exec supabase migration up --local

echo "→ Regenerando os tipos do banco (RN9)…"
pnpm exec supabase gen types typescript --local 2>/dev/null | sed 's/\r$//' > packages/db/src/types.generated.ts

echo "✅ [napo] Banco local sincronizado com as migrations."
