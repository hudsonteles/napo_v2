'use client';

import { MapPin, ReceiptText, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@napo/ui/lib/cn';

/**
 * Navegação secundária da área do cliente.
 *
 * Ilha cliente porque saber a seção ativa exige `usePathname` — e é o destaque
 * que responde "onde eu estou", a pergunta que o menu existe para responder.
 */
const SECOES = [
  { href: '/conta', rotulo: 'Perfil', Icone: UserRound },
  { href: '/conta/enderecos', rotulo: 'Endereços', Icone: MapPin },
  { href: '/conta/pedidos', rotulo: 'Pedidos', Icone: ReceiptText },
];

export function NavegacaoConta() {
  const caminho = usePathname();

  return (
    // Markup cru consciente: pílula de navegação não é <Button> — não é ação, é
    // destino, e virar botão daria a ela o peso visual de um CTA (AGENTS §2.11c).
    <nav className="border-b border-borda bg-superficie/40">
      <div className="mx-auto flex max-w-4xl items-center gap-1 overflow-x-auto px-5 sm:px-8">
        {SECOES.map(({ href, rotulo, Icone }) => {
          // `/conta` casaria com tudo por prefixo: a raiz compara exato, as
          // demais aceitam as telas filhas (um endereço aberto ainda é Endereços).
          const ativa = href === '/conta' ? caminho === href : caminho.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={ativa ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition',
                ativa
                  ? 'border-amarelo font-medium text-branco'
                  : 'border-transparent text-texto-suave hover:border-borda-forte hover:text-branco',
              )}
            >
              <Icone className="h-4 w-4" /> {rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
