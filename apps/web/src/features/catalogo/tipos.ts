import type { Categoria, FaixaPreco, ProdutoCatalogo } from '@napo/core';

/** Produto pronto para a vitrine: domínio + preço resolvido + foto + contexto. */
export interface ProdutoVitrine {
  produto: ProdutoCatalogo;
  faixa: FaixaPreco;
  categoria: Categoria;
  /** Já resolvido (override vence a faixa, RN5) para a tela não recalcular. */
  precoEfetivoCentavos: number;
  /** `null` = ainda sem ensaio; a tela mostra o disco placeholder (RN11). */
  fotoUrl: string | null;
}

export interface CatalogoLido {
  categorias: Categoria[];
  produtos: ProdutoVitrine[];
}
