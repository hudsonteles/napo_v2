/**
 * Contrato do catálogo (NAPO-003) no núcleo puro.
 *
 * O núcleo não conhece Supabase: recebe o produto já mapeado do banco e decide
 * preço, completude de rotulagem e a marcação para o buscador. É a fronteira que
 * mantém "quanto o cliente paga" testável sem banco (ARCHITECTURE §3.1/§3.2).
 */

/** Preço sempre em centavos inteiros — float erra centavo em soma (design §2.1). */
export type Centavos = number;

/** Alérgenos declaráveis. Espelha o enum `public.alergeno` do banco (0010). */
export type Alergeno =
  | 'gluten'
  | 'leite'
  | 'ovos'
  | 'soja'
  | 'amendoim'
  | 'castanhas'
  | 'avela'
  | 'peixe'
  | 'crustaceos';

export interface FaixaPreco {
  id: string;
  nome: string;
  precoCentavos: Centavos;
}

export interface Categoria {
  id: string;
  nome: string;
  slug: string;
  /** O sub-teto de massa (NAPO-004) vale para a categoria inteira. */
  ehMassa: boolean;
}

/** Produto do catálogo — a forma pura, já mapeada da linha do banco. */
export interface ProdutoCatalogo {
  id: string;
  /** Endereço permanente (RN8): não muda quando o nome comercial muda. */
  slug: string;
  nome: string;
  categoriaId: string;
  faixaPrecoId: string;

  // Rotulagem obrigatória para publicar (RN2). Nula enquanto o produto é rascunho.
  denominacaoVenda: string | null;
  descricao: string | null;
  pesoLiquidoG: number | null;
  validadeDias: number | null;
  conservacao: string | null;
  preparo: string | null;

  diametroCm: number | null;
  porcoes: number | null;

  /** Vence a faixa quando presente (RN5). */
  precoOverrideCentavos: Centavos | null;

  /** Composição (contém) × risco de contato (pode conter) — distintos (RN4). */
  alergenosContem: Alergeno[];
  alergenosPodeConter: Alergeno[];

  /** 1 | 2 | 3 · null. Ordem factual das mais pedidas na home. */
  rankingMaisPedidas: number | null;
  ordem: number;
  ativo: boolean;
}
