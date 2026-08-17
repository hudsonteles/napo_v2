import type { ProdutoCatalogo } from './tipos';

/**
 * Rotulagem obrigatória para publicar (RN2), espelhando o CHECK do banco (0010).
 * O banco é a garantia dura; esta função é a mesma regra disponível ao admin
 * (NAPO-008) e à tela, para dizer o que falta ANTES de tentar ativar e tomar um
 * erro de constraint. Fonte única da lista de campos, aqui.
 */
export function camposDeRotulagemFaltantes(produto: ProdutoCatalogo): string[] {
  const faltando: string[] = [];
  if (!produto.denominacaoVenda) faltando.push('denominacaoVenda');
  if (produto.pesoLiquidoG == null) faltando.push('pesoLiquidoG');
  if (produto.validadeDias == null) faltando.push('validadeDias');
  if (!produto.conservacao) faltando.push('conservacao');
  if (!produto.preparo) faltando.push('preparo');
  if (produto.alergenosContem.length === 0) faltando.push('alergenosContem');
  return faltando;
}

/** Verdadeiro quando o produto tem tudo que a RN2 exige para ir ao ar. */
export function rotulagemCompleta(produto: ProdutoCatalogo): boolean {
  return camposDeRotulagemFaltantes(produto).length === 0;
}
