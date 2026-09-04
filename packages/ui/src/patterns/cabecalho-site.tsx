import type { ReactNode } from 'react';

import { Marca } from '../components/marca';

/**
 * Cabeçalho compartilhado por todas as rotas de `(site)`. Estrutura aprovada no
 * Gate Visual A. Usa `<a>` e não `next/link` porque `packages/ui` não depende do
 * Next (ARCHITECTURE §3.2); num site SSG servido do CDN a navegação de página
 * inteira é aceitável.
 *
 * Carrinho e conta entram como **slots** (NAPO-006): quem conta os itens e quem
 * sabe da sessão são ilhas cliente do app, e um pattern do catálogo não pode
 * conhecer o estado de uma feature. Sem os slots, o cabeçalho continua servindo
 * às páginas que não têm nem carrinho nem sessão.
 */
export function CabecalhoSite({
  acessoCarrinho,
  acessoConta,
}: { acessoCarrinho?: ReactNode; acessoConta?: ReactNode } = {}) {
  return (
    <header className="sticky top-0 z-50 border-b border-borda bg-preto/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="/" aria-label="Napo — início">
          <Marca className="h-8" />
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="/sabores"
            className="rounded-campo px-3 py-2 text-sm text-texto-suave transition hover:bg-superficie-alta hover:text-branco"
          >
            Sabores
          </a>
          <a
            href="/eventos"
            className="hidden rounded-campo px-3 py-2 text-sm text-texto-suave transition hover:bg-superficie-alta hover:text-branco sm:block"
          >
            Eventos
          </a>
          <a
            href="/como-aquecer"
            className="hidden rounded-campo px-3 py-2 text-sm text-texto-suave transition hover:bg-superficie-alta hover:text-branco sm:block"
          >
            Como aquecer
          </a>
          {acessoConta}
          {acessoCarrinho}
        </nav>
      </div>
    </header>
  );
}
