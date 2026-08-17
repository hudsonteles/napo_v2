/**
 * Resolução da foto do produto (RN11). As fotos são servidas de `/public/produtos`
 * por `<img>` sem `next/image` — pré-otimizadas, custo zero por visita (design §5).
 *
 * Os três sabores ainda não fotografados (NAPO-020) devolvem `null`, e a tela
 * mostra o disco placeholder na MESMA proporção — sem salto de layout quando a
 * foto real chegar. O conjunto é conhecido e some quando o ensaio completar.
 */
const SEM_FOTO = new Set(['lombo-canadense', 'massa-salgada', 'massa-doce']);

/** Caminho da foto do produto, ou `null` quando ainda é placeholder. */
export function fotoDoProduto(slug: string): string | null {
  return SEM_FOTO.has(slug) ? null : `/produtos/${slug}.jpeg`;
}
