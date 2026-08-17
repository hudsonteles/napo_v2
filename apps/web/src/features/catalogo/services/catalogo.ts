import 'server-only';

import { precoEfetivoCentavos } from '@napo/core';

import { createSupabaseAnonClient } from '@/lib/supabase/anon';

import { fotoDoProduto } from '../fotos';
import type { CatalogoLido, ProdutoVitrine } from '../tipos';
import { mapearCategoria, mapearFaixa, mapearProduto } from './mapear';

/**
 * Lê o catálogo público direto pelo client Supabase no servidor (SSG) — sem
 * endpoint `GET /api/produtos`: criar rota para a própria página consumir seria
 * um salto de rede sem consumidor externo (design §3.1). A RLS anônima já
 * devolve só o ativo (RN1/RN12), então a página não filtra `ativo` de novo.
 *
 * Reordena por categoria e depois por `ordem`: a query traz `ordem` por
 * categoria (1..n em cada uma), então ordenar só por ela interleavaria as seções.
 */
export async function lerCatalogo(): Promise<CatalogoLido> {
  const supabase = createSupabaseAnonClient();

  const [cats, fxs, prods] = await Promise.all([
    supabase.from('categorias').select('*').order('ordem'),
    supabase.from('faixas_preco').select('*'),
    supabase.from('produtos').select('*').order('ordem'),
  ]);

  if (cats.error) throw cats.error;
  if (fxs.error) throw fxs.error;
  if (prods.error) throw prods.error;

  const categorias = (cats.data ?? []).map(mapearCategoria);
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const rankCategoria = new Map(categorias.map((c, i) => [c.id, i]));
  const faixaPorId = new Map(
    (fxs.data ?? []).map((f) => {
      const faixa = mapearFaixa(f);
      return [faixa.id, faixa];
    }),
  );

  const produtos: ProdutoVitrine[] = (prods.data ?? [])
    .map(mapearProduto)
    .map((produto) => {
      const faixa = faixaPorId.get(produto.faixaPrecoId);
      const categoria = categoriaPorId.get(produto.categoriaId);
      if (!faixa || !categoria) {
        throw new Error(`Produto ${produto.slug} sem faixa ou categoria — catálogo inconsistente`);
      }
      return {
        produto,
        faixa,
        categoria,
        precoEfetivoCentavos: precoEfetivoCentavos(produto, faixa),
        fotoUrl: fotoDoProduto(produto.slug),
      };
    })
    .sort((a, b) => {
      const rankA = rankCategoria.get(a.categoria.id) ?? 0;
      const rankB = rankCategoria.get(b.categoria.id) ?? 0;
      return rankA - rankB || a.produto.ordem - b.produto.ordem;
    });

  return { categorias, produtos };
}

/**
 * Slugs dos produtos ativos, para `generateStaticParams` (design §5). A RLS
 * anônima já exclui o inativo, então sua página nunca é gerada e o slug cai em
 * 404 por `dynamicParams=false` — sem consultar banco (RN1/RN8/T9).
 */
export async function lerSlugsAtivos(): Promise<string[]> {
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.from('produtos').select('slug');
  if (error) throw error;
  return (data ?? []).map((r) => r.slug);
}

/**
 * Um produto pela URL permanente (RN8), com faixa e categoria. `null` quando não
 * existe OU está inativo (a RLS o esconde) — a página traduz isso em 404 (T9).
 */
export async function lerProdutoPorSlug(slug: string): Promise<ProdutoVitrine | null> {
  const supabase = createSupabaseAnonClient();

  const { data: linha, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!linha) return null;

  const produto = mapearProduto(linha);
  const [faixaRes, categoriaRes] = await Promise.all([
    supabase.from('faixas_preco').select('*').eq('id', produto.faixaPrecoId).single(),
    supabase.from('categorias').select('*').eq('id', produto.categoriaId).single(),
  ]);
  if (faixaRes.error) throw faixaRes.error;
  if (categoriaRes.error) throw categoriaRes.error;

  return {
    produto,
    faixa: mapearFaixa(faixaRes.data),
    categoria: mapearCategoria(categoriaRes.data),
    precoEfetivoCentavos: precoEfetivoCentavos(produto, mapearFaixa(faixaRes.data)),
    fotoUrl: fotoDoProduto(produto.slug),
  };
}
