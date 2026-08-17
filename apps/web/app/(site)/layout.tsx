import type { ReactNode } from 'react';
import { CabecalhoSite } from '@napo/ui/patterns/cabecalho-site';
import { RodapeSite } from '@napo/ui/patterns/rodape-site';

/**
 * Shell do site público (`(site)`): cabeçalho e rodapé em volta de toda rota do
 * grupo. `html`/`body`/fonte/Toaster vêm do layout raiz — aqui só a moldura de
 * navegação. Metadata por página é responsabilidade do bloco de SEO.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CabecalhoSite />
      {children}
      <RodapeSite />
    </>
  );
}
