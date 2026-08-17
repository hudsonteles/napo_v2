import { Marca } from '../components/marca';

/**
 * Rodapé compartilhado por `(site)`. Estrutura aprovada no Gate Visual A. Os
 * links legais apontam para rotas com conteúdo provisório (texto real é NAPO-009)
 * — existem para não deixar link quebrado no rodapé.
 */
export function RodapeSite() {
  return (
    <footer className="border-t border-borda">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 lg:flex-row lg:justify-between">
        <div>
          <Marca className="h-7" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-texto-suave">
            Pizza napolitana congelada, assada na pedra. Brasília&nbsp;/&nbsp;DF.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-10 gap-y-6 text-sm">
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-widest text-texto-suave uppercase">Produto</p>
            <a href="/sabores" className="block text-texto-suave transition hover:text-branco">
              Sabores
            </a>
            <a href="/como-aquecer" className="block text-texto-suave transition hover:text-branco">
              Como aquecer
            </a>
            <a href="/eventos" className="block text-texto-suave transition hover:text-branco">
              Eventos
            </a>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium tracking-widest text-texto-suave uppercase">Legal</p>
            <a
              href="/legal/termos"
              className="block text-texto-suave transition hover:text-branco"
            >
              Termos de uso
            </a>
            <a
              href="/legal/privacidade"
              className="block text-texto-suave transition hover:text-branco"
            >
              Privacidade
            </a>
          </div>
        </nav>
      </div>
      <div className="border-t border-borda">
        <p className="mx-auto max-w-6xl px-5 py-6 text-xs text-texto-suave sm:px-8">
          © 2026 Napo · CNPJ 00.000.000/0001-00 · Brasília/DF
        </p>
      </div>
    </footer>
  );
}
