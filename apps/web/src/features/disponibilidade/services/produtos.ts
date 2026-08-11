import type { Produto } from '@napo/core';

/**
 * Lista de produtos a consultar, vinda da query string.
 *
 * Solução de transição: o catálogo (`produtos`) nasce em NAPO-003 e passa a ser
 * a fonte da flag `ehMassa`. Até lá quem consulta informa os ids, e `massas`
 * marca quais deles disparam o sub-teto da RN8.
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
