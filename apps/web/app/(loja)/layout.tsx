import type { ReactNode } from 'react';
import { CabecalhoSite } from '@napo/ui/patterns/cabecalho-site';
import { RodapeSite } from '@napo/ui/patterns/rodape-site';

import { AcessoConta } from '@/features/auth/components/acesso-conta';
import { AcessoCarrinhoAoVivo } from '@/features/pedidos/components/acesso-carrinho-ao-vivo';

/**
 * Shell da loja (`(loja)`): carrinho, checkout e pedido.
 *
 * Grupo separado do `(site)` porque aqui nada é estático — todas as telas leem
 * carrinho, sessão ou pedido. A moldura é a mesma do site de propósito: sair da
 * vitrine para a sacola não pode parecer sair da Napo.
 */
export default function LojaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CabecalhoSite acessoConta={<AcessoConta />} acessoCarrinho={<AcessoCarrinhoAoVivo />} />
      {children}
      <RodapeSite />
    </>
  );
}
