import { ShoppingBag } from 'lucide-react';

import { Marca } from '../components/marca';

/**
 * Cabeçalho compartilhado por todas as rotas de `(site)`. Estrutura aprovada no
 * Gate Visual A. Usa `<a>` e não `next/link` porque `packages/ui` não depende do
 * Next (ARCHITECTURE §3.2); num site SSG servido do CDN a navegação de página
 * inteira é aceitável. O carrinho nasce desabilitado — o canal de compra abre no
 * NAPO-006 (RN da tela: CTA presente e honesto sobre o canal ainda não aberto).
 */
export function CabecalhoSite() {
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
          <button
            disabled
            title="O carrinho abre com o pedido online, em breve"
            className="ml-1 flex cursor-not-allowed items-center gap-2 rounded-campo bg-superficie-alta px-4 py-2 text-sm font-semibold text-neutral-500"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho</span>
            <span className="rounded-full bg-borda px-1.5 text-[11px]">0</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
