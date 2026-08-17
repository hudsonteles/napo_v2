import type { Alergeno, Categoria, FaixaPreco, ProdutoCatalogo } from '@napo/core';
import type { Database } from '@napo/db';

/**
 * Fronteira banco → domínio. Traduz a linha `snake_case` do Postgres para o tipo
 * puro que o núcleo e a tela raciocinam (`camelCase`). Funções puras, sem
 * Supabase — por isso testáveis sem banco e separadas de `catalogo.ts`, que fala
 * com o servidor.
 */
type ProdutoRow = Database['public']['Tables']['produtos']['Row'];
type CategoriaRow = Database['public']['Tables']['categorias']['Row'];
type FaixaRow = Database['public']['Tables']['faixas_preco']['Row'];

export function mapearProduto(row: ProdutoRow): ProdutoCatalogo {
  return {
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    categoriaId: row.categoria_id,
    faixaPrecoId: row.faixa_preco_id,
    denominacaoVenda: row.denominacao_venda,
    descricao: row.descricao,
    pesoLiquidoG: row.peso_liquido_g,
    validadeDias: row.validade_dias,
    conservacao: row.conservacao,
    preparo: row.preparo,
    diametroCm: row.diametro_cm,
    porcoes: row.porcoes,
    precoOverrideCentavos: row.preco_override_centavos,
    alergenosContem: row.alergenos_contem as Alergeno[],
    alergenosPodeConter: row.alergenos_pode_conter as Alergeno[],
    rankingMaisPedidas: row.ranking_mais_pedidas,
    ordem: row.ordem,
    ativo: row.ativo,
  };
}

export function mapearCategoria(row: CategoriaRow): Categoria {
  return { id: row.id, nome: row.nome, slug: row.slug, ehMassa: row.eh_massa };
}

export function mapearFaixa(row: FaixaRow): FaixaPreco {
  return { id: row.id, nome: row.nome, precoCentavos: row.preco_centavos };
}
