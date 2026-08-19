/**
 * Contrato do carrinho (NAPO-006).
 *
 * O que o navegador guarda é só id e quantidade: preço, disponibilidade e nome
 * são resolvidos pelo servidor a cada leitura (RN3). Um carrinho que carrega o
 * próprio preço é um carrinho que escolhe quanto pagar.
 */

/** O que persiste no navegador. Nada aqui vale dinheiro. */
export interface ItemCarrinho {
  produtoId: string;
  quantidade: number;
}

/** Item já casado com catálogo e fornada pelo servidor. */
export interface ItemPrecificado extends ItemCarrinho {
  nome: string;
  precoUnitarioCentavos: number;
  /** Teto da fornada escolhida para este produto. */
  disponivel: number;
}

/** O que mudou entre o que o cliente via e o que o servidor apurou. */
export type AjusteItem =
  | { produtoId: string; tipo: 'esgotado' }
  | { produtoId: string; tipo: 'reduzido'; de: number; para: number };

export interface CarrinhoAjustado {
  itens: ItemPrecificado[];
  ajustes: AjusteItem[];
  /** Qualquer ajuste exige reconfirmação: seguir calado cobra o que não foi visto. */
  bloqueado: boolean;
}

export interface PrecoConhecido {
  produtoId: string;
  precoUnitarioCentavos: number;
}

export interface DivergenciaPreco {
  produtoId: string;
  deCentavos: number;
  paraCentavos: number;
}

export interface EntradaTotais {
  itens: ItemPrecificado[];
  /** `null` = fora de área (NAPO-005 RN9). Nunca zero por omissão. */
  freteCentavos: number | null;
  freteGratisCentavos: number;
}

export interface Totais {
  subtotalCentavos: number;
  freteCentavos: number | null;
  /** `null` quando o frete é nulo — total sem frete conhecido não é total. */
  totalCentavos: number | null;
  /** `null` quando o piso do frete grátis já foi atingido. */
  faltamParaFreteGratisCentavos: number | null;
}
