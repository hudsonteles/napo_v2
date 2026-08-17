import { precoEfetivoCentavos } from './preco';
import type { FaixaPreco, ProdutoCatalogo } from './tipos';

/** Disponibilidade no vocabulário do schema.org (RN9). */
export type DisponibilidadeJsonLd = 'InStock' | 'OutOfStock';

export interface EntradaJsonLdProduto {
  produto: ProdutoCatalogo;
  faixa: FaixaPreco;
  /** URL canônica da página do produto. */
  url: string;
  imagemUrl?: string;
  disponibilidade: DisponibilidadeJsonLd;
}

/**
 * schema.org `Product` + `Offer` por página de produto (RN9). Preço e
 * disponibilidade saem das MESMAS fontes puras que a tela usa
 * (`precoEfetivoCentavos` e o mesmo valor de disponibilidade), então marcação e
 * página não divergem — divergência é motivo de penalização, não de ranking
 * (RN9/T25). Preço em reais com ponto decimal, como o schema.org exige.
 */
export function jsonLdProduto(entrada: EntradaJsonLdProduto): Record<string, unknown> {
  const centavos = precoEfetivoCentavos(entrada.produto, entrada.faixa);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: entrada.produto.nome,
    description: entrada.produto.descricao ?? entrada.produto.denominacaoVenda ?? undefined,
    ...(entrada.imagemUrl ? { image: entrada.imagemUrl } : {}),
    offers: {
      '@type': 'Offer',
      price: (centavos / 100).toFixed(2),
      priceCurrency: 'BRL',
      availability: `https://schema.org/${entrada.disponibilidade}`,
      url: entrada.url,
    },
  };
}
