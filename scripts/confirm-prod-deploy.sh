#!/usr/bin/env bash
# Salvaguarda obrigatória contra deploys acidentais em produção.
# Exige digitação literal do nome do projeto/ambiente alvo antes de prosseguir.
#
# Uso:
#   bash scripts/confirm-prod-deploy.sh <NOME_PROJETO_PROD>
#
# Encadeamento típico (package.json):
#   "deploy:prod": "bash scripts/confirm-prod-deploy.sh meu-projeto-prod && <comando-de-deploy>"
#
# Saída:
#   exit 0 → confirmado, deploy pode prosseguir
#   exit 1 → cancelado, nome não confere ou input vazio

set -e

EXPECTED="$1"

if [ -z "$EXPECTED" ]; then
  echo "❌ Faltou argumento: nome do projeto/ambiente de produção."
  echo "   Uso: bash scripts/confirm-prod-deploy.sh <NOME_PROJETO_PROD>"
  exit 1
fi

echo ""
echo "⚠️  ATENÇÃO — DEPLOY DE PRODUÇÃO"
echo "   Alvo: $EXPECTED"
echo ""
echo "   Para confirmar, digite EXATAMENTE o nome acima:"
printf "   > "
read -r TYPED

if [ "$TYPED" != "$EXPECTED" ]; then
  echo ""
  echo "❌ Nome não confere ('$TYPED' ≠ '$EXPECTED'). Deploy abortado."
  exit 1
fi

echo ""
echo "✅ Confirmado. Prosseguindo com deploy para '$EXPECTED'..."
echo ""
