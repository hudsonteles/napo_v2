import type { ReactNode } from 'react';
import Link from 'next/link';
import { MapPin, ReceiptText, UserRound } from 'lucide-react';

import { CabecalhoSite } from '@napo/ui/patterns/cabecalho-site';
import { RodapeSite } from '@napo/ui/patterns/rodape-site';

import { exigirAcesso } from '@/features/auth';
import { AcessoConta } from '@/features/auth/components/acesso-conta';
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
 * A navegação abaixo é secundária: diz onde a pessoa está **dentro** da conta.
 */
const SECOES = [
  { href: '/conta', rotulo: 'Perfil', Icone: UserRound },
  { href: '/conta/enderecos', rotulo: 'Endereços', Icone: MapPin },
  // Pedidos ainda não tem tela própria (NAPO-007); aponta para o painel, onde
  // está o aviso. Link para rota inexistente seria pior que link nenhum.
  { href: '/conta', rotulo: 'Pedidos', Icone: ReceiptText },
];

export default async function ContaLayout({ children }: { children: ReactNode }) {
  await exigirAcesso('conta');

  return (
    <>
      <CabecalhoSite acessoConta={<AcessoConta />} acessoCarrinho={<AcessoCarrinhoAoVivo />} />

      {/* Markup cru consciente: pílula de navegação não é <Button> — não é ação,
          é destino, e virar botão daria a ela o peso visual de um CTA
          (AGENTS.md §2.11c). */}
      <nav className="border-b border-borda bg-superficie/40">
        <div className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-5 py-2.5 text-sm sm:px-8">
          {SECOES.map(({ href, rotulo, Icone }) => (
            <Link
              key={rotulo}
              href={href}
              className="flex shrink-0 items-center gap-2 rounded-campo px-3 py-2 text-texto-suave transition hover:bg-superficie-alta hover:text-branco"
            >
              <Icone className="h-4 w-4" /> {rotulo}
            </Link>
          ))}
        </div>
      </nav>

      {children}
      <RodapeSite />
    </>
  );
}
