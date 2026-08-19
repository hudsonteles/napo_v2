import type { ReactNode } from 'react';
import Link from 'next/link';

import { Marca } from '@napo/ui/components/marca';

import { exigirAcesso } from '@/features/auth';

// O guarda consulta o banco a cada navegação protegida — decisão do design §5:
// claim de papel em JWT fica velha até o refresh e barraria quem acabou de
// validar o telefone.
export const dynamic = 'force-dynamic';

/**
 * Guarda da área do cliente (RN2, RN3). Vive no layout do segmento `conta/`, e
 * não no do grupo `(conta)`, porque as telas de auth moram no mesmo grupo e não
 * podem exigir o que estão construindo (design §5).
 */
export default async function ContaLayout({ children }: { children: ReactNode }) {
  await exigirAcesso('conta');

  return (
    <>
      {/* Cabeçalho da área do cliente. Nasce aqui, e não na página de endereços,
          porque §4.1 do design manda reusar "o layout de (conta)" — e duas telas
          desta spec precisam dele. A navegação lista só o que existe: um link
          "Pedidos" morto seria pior que link nenhum (NAPO-007 acrescenta o dele). */}
      <header className="border-b border-borda bg-preto">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Napo — página inicial">
            <Marca className="h-7" />
          </Link>
          {/* Markup cru consciente: pílula de navegação não é <Button> — não é
              ação, é destino, e virar botão daria a ela o peso visual de um CTA
              dentro do próprio cabeçalho. Fora do catálogo por decisão, não por
              esquecimento (AGENTS.md §2.11c). */}
          <nav className="flex items-center gap-1 text-sm">
            <Link
              className="rounded-campo bg-superficie-alta px-3 py-2 font-medium text-branco"
              href="/conta/enderecos"
            >
              Endereços
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
