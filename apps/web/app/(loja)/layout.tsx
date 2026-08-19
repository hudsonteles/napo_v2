import type { ReactNode } from 'react';
import { CabecalhoSite } from '@napo/ui/patterns/cabecalho-site';
import { RodapeSite } from '@napo/ui/patterns/rodape-site';

import { AcessoCarrinhoConectado } from '@/lib/carrinho/acesso-conectado';
import { CarrinhoProvider } from '@/lib/carrinho/provider';

/**
 * Shell da loja (`(loja)`): carrinho, checkout e página do pedido. Mesma moldura
 * do site (cabeçalho + rodapé), com o `<CarrinhoProvider>` por cima — o carrinho
 * montado no site atravessa para cá pelo `localStorage`. Grupo de rota previsto
 * na "Arquitetura de Código" e inexistente até o NAPO-006.
 */
export default function LojaLayout({ children }: { children: ReactNode }) {
  return (
    <CarrinhoProvider>
      <CabecalhoSite acessoCarrinho={<AcessoCarrinhoConectado />} />
      {children}
      <RodapeSite />
    </CarrinhoProvider>
  );
}
