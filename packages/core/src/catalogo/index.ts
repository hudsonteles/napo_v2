/**
 * Catálogo (NAPO-003) — regras puras de preço, rotulagem, conteúdo regulado e
 * marcação para o buscador. Sem Supabase, sem React: recebe o produto já mapeado
 * e decide. É o que mantém "quanto o cliente paga" e "o que o Google lê" numa
 * fonte só (RN5/RN9), testável sem banco.
 */
export { centavosParaReais, formatarReais, precoEfetivoCentavos } from './preco';
export { camposDeRotulagemFaltantes, rotulagemCompleta } from './rotulagem';
export { alegacoesDeSaudeEncontradas, contémAlegacaoDeSaude } from './conteudo';
export { jsonLdProduto } from './jsonld';
export type { DisponibilidadeJsonLd, EntradaJsonLdProduto } from './jsonld';
export type { Alergeno, Categoria, Centavos, FaixaPreco, ProdutoCatalogo } from './tipos';
