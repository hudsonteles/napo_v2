import type { Centavos, FaixaPreco, ProdutoCatalogo } from './tipos';

/**
 * Preço que o cliente paga (RN5): o override vence quando presente, senão vale o
 * preço da faixa. Uma função só decide isso — a tela e o JSON-LD leem daqui, e
 * assim marcação e página não têm como divergir (RN9). `??` e não `||`: override
 * de zero é um preço, não "ausente".
 */
export function precoEfetivoCentavos(
  produto: Pick<ProdutoCatalogo, 'precoOverrideCentavos'>,
  faixa: Pick<FaixaPreco, 'precoCentavos'>,
): Centavos {
  return produto.precoOverrideCentavos ?? faixa.precoCentavos;
}

/** Centavos → "39,90" (sem símbolo). O card exibe o número em fonte técnica. */
export function centavosParaReais(centavos: Centavos): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/** Centavos → "R$ 39,90". O site sempre deixa claro que o preço não inclui frete (RN5). */
export function formatarReais(centavos: Centavos): string {
  return `R$ ${centavosParaReais(centavos)}`;
}
