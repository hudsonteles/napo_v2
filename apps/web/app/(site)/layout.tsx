import type { ReactNode } from 'react';
import { CabecalhoSite } from '@napo/ui/patterns/cabecalho-site';
import { RodapeSite } from '@napo/ui/patterns/rodape-site';

import { AcessoCarrinhoConectado } from '@/lib/carrinho/acesso-conectado';
import { CarrinhoProvider } from '@/lib/carrinho/provider';
import { publicEnv } from '@/lib/env';

/**
 * `Restaurant` do schema.org no site público (RN9). Alimenta as features locais
 * do buscador; o resultado de e-commerce com preço e disponibilidade vem do
 * `Product`+`Offer` de cada página de produto. Estático — identidade da casa.
 */
const jsonLdRestaurant = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: 'Napo',
  description: 'Pizza napolitana congelada, assada na pedra, com entrega em Brasília.',
  servesCuisine: 'Pizza napolitana',
  priceRange: 'R$$',
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Brasília',
    addressRegion: 'DF',
    addressCountry: 'BR',
  },
  areaServed: { '@type': 'City', name: 'Brasília' },
};

/**
 * Shell do site público (`(site)`): cabeçalho e rodapé em volta de toda rota do
 * grupo. `html`/`body`/fonte/Toaster vêm do layout raiz — aqui só a moldura de
 * navegação e o JSON-LD `Restaurant`.
 *
 * O `<CarrinhoProvider>` (ilha cliente, design §5 decisão 8) envolve o grupo
 * para o contador do cabeçalho e o "Adicionar" das páginas de produto lerem o
 * mesmo carrinho. Os filhos continuam Server Components / SSG: só o provider é a
 * fronteira de cliente. O carrinho atravessa a navegação de página inteira pelo
 * `localStorage`, então cada grupo tem sua instância sem perder o estado.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <CarrinhoProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdRestaurant) }}
      />
      <CabecalhoSite acessoCarrinho={<AcessoCarrinhoConectado />} />
      {children}
      <RodapeSite />
    </CarrinhoProvider>
  );
}
