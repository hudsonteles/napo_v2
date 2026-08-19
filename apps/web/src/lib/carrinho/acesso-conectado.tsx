'use client';

import { AcessoCarrinho } from '@napo/ui/patterns/acesso-carrinho';

import { useCarrinho } from './provider';

/**
 * Ponte entre o carrinho do app (`useCarrinho`, que lê `localStorage`) e o
 * `<AcessoCarrinho>` presentacional do catálogo. Existe porque o cabeçalho mora
 * em `packages/ui` e não pode importar uma feature do app: o app injeta esta
 * ilha já ligada no slot do cabeçalho (design §4.4.3). Precisa estar sob o
 * `<CarrinhoProvider>`.
 */
export function AcessoCarrinhoConectado() {
  const { totalUnidades, pronto } = useCarrinho();
  return <AcessoCarrinho totalUnidades={totalUnidades} pronto={pronto} />;
}
