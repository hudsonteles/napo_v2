import type { Produto } from '@napo/core';

import { createSupabaseAnonClient } from '@/lib/supabase/anon';

/**
 * Lista de produtos ativos derivada do catálogo (NAPO-003). É a fonte da flag
 * `ehMassa` — que vem da categoria (o sub-teto de massa vale para a categoria
 * inteira, RN8). A RLS anônima já devolve só o ativo (RN1). Substitui a query
 * string quando ela não vem; o modo por `?produtos=` fica para o contrato que o
 * NAPO-004 já entregou.
 */
export async function produtosAtivosDoCatalogo(): Promise<Produto[]> {
  const supabase = createSupabaseAnonClient();
  const [prods, cats] = await Promise.all([
    supabase.from('produtos').select('id, categoria_id'),
    supabase.from('categorias').select('id, eh_massa'),
  ]);
  if (prods.error) throw prods.error;
  if (cats.error) throw cats.error;

  const ehMassaPorCategoria = new Map((cats.data ?? []).map((c) => [c.id, c.eh_massa]));
  return (prods.data ?? []).map((p) => ({
    id: p.id,
    ehMassa: ehMassaPorCategoria.get(p.categoria_id) ?? false,
  }));
}

/**
 * Lista de produtos a consultar, vinda da query string (contrato do NAPO-004).
 * Preservada para não quebrar quem já chama `?produtos=id,id&massas=id`.
 *
 * @example produtosDaQuery('a,b', 'b') // [{id:'a',ehMassa:false},{id:'b',ehMassa:true}]
 */
export function produtosDaQuery(produtos: string | null, massas: string | null): Produto[] {
  const idsMassa = new Set(separar(massas));
  return separar(produtos).map((id) => ({ id, ehMassa: idsMassa.has(id) }));
}

function separar(valor: string | null): string[] {
  if (!valor) return [];
  return valor
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean);
}
