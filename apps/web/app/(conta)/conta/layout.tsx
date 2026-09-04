import type { ReactNode } from 'react';

import { CabecalhoSite } from '@napo/ui/patterns/cabecalho-site';
import { RodapeSite } from '@napo/ui/patterns/rodape-site';

import { exigirAcesso } from '@/features/auth';
import { AcessoConta } from '@/features/auth/components/acesso-conta';
import { NavegacaoConta } from '@/features/auth/components/navegacao-conta';
import { AcessoCarrinhoAoVivo } from '@/features/pedidos/components/acesso-carrinho-ao-vivo';

// O guarda consulta o banco a cada navegação protegida — decisão do design §5:
// claim de papel em JWT fica velha até o refresh e barraria quem acabou de
// validar o telefone.
export const dynamic = 'force-dynamic';

/**
 * Guarda e moldura da área do cliente (RN2, RN3).
 *
 * Usa **o mesmo cabeçalho do site**, e não um próprio: a conta é parte da loja,
 * não um sistema à parte. Com um cabeçalho exclusivo, quem entrava no perfil
 * perdia a volta para a vitrine, o acesso à sacola e o menu da própria conta —
 * três becos criados por uma moldura que existia só aqui.
 *
 * A navegação secundária diz onde a pessoa está **dentro** da conta, e por isso
 * é ilha cliente: o destaque da seção ativa depende da rota corrente.
 */

export default async function ContaLayout({ children }: { children: ReactNode }) {
  await exigirAcesso('conta');

  return (
    <>
      <CabecalhoSite acessoConta={<AcessoConta />} acessoCarrinho={<AcessoCarrinhoAoVivo />} />

      <NavegacaoConta />

      {children}
      <RodapeSite />
    </>
  );
}
