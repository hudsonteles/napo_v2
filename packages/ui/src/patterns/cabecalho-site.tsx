import { ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';

import { Marca } from '../components/marca';

/**
 * Cabeçalho compartilhado pelas rotas de `(site)` e `(loja)`. Estrutura aprovada
 * no Gate Visual A. Usa `<a>` e não `next/link` porque `packages/ui` não depende
 * do Next (ARCHITECTURE §3.2); num site SSG servido do CDN a navegação de página
 * inteira é aceitável.
 *
 * O acesso ao carrinho entra por `acessoCarrinho` (design §4.4.3: o cabeçalho
 * RECEBE o `<AcessoCarrinho>`). O contador lê `localStorage`, que só existe no
 * app — o cabeçalho continua sem importar estado de cliente, e é o app quem
 * injeta a ilha já ligada. Sem a prop, cai num link simples (sem contador).
 */
export function CabecalhoSite({ acessoCarrinho }: { acessoCarrinho?: ReactNode }) {
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
          {acessoCarrinho ?? (
            <a
              href="/carrinho"
              aria-label="Carrinho"
              className="ml-1 flex h-11 w-11 items-center justify-center rounded-campo text-branco transition hover:bg-superficie-alta"
            >
              <ShoppingBag className="h-5 w-5" />
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
