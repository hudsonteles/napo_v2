/**
 * Destino interno seguro para redirecionamento pós-ação.
 *
 * Mora em `lib` porque três features precisam dele — auth, endereços e pedidos —
 * e feature não importa de feature (ARCHITECTURE §3.2).
 *
 * Recusa tudo que não seja caminho da própria aplicação: `//host` e a barra
 * invertida são as formas clássicas de transformar um "voltar para onde eu
 * estava" em redirect aberto para fora do site.
 */
export function caminhoInternoSeguro(proximo: string | null | undefined): string | null {
  if (!proximo) return null;
  if (!proximo.startsWith('/')) return null;
  if (proximo.startsWith('//')) return null;
  if (proximo.includes('\\')) return null;
  return proximo;
}
