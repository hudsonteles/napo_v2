'use client';

import { AcessoCarrinho } from '@napo/ui/patterns/acesso-carrinho';

import { useCarrinho } from '@/lib/carrinho/provider';

/**
 * Ilha cliente que dá número ao acesso do cabeçalho.
 *
 * O cabeçalho é do catálogo e o carrinho vive no navegador: esta é a ponte, e é
 * o mesmo padrão da disponibilidade ao vivo do NAPO-003 — uma ilha sobre página
 * estática, sem tirar nenhuma rota do SSG (ARCHITECTURE §4.5).
 *
 * Antes da hidratação o contador não aparece: mostrar 0 e trocar por 3 um
 * instante depois é a remonta que o `pronto` existe para evitar.
 */
export function AcessoCarrinhoAoVivo() {
  const { quantidadeTotal, pronto } = useCarrinho();

  return <AcessoCarrinho quantidade={pronto ? quantidadeTotal : 0} />;
}
