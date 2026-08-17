/**
 * Feature de disponibilidade — a ponte entre o banco e o núcleo puro.
 *
 * Expõe apenas o que as rotas consomem: o resto é interno (ARCHITECTURE §3.2).
 */
export { carregarSnapshot, createSupabaseAdminClient } from './services/snapshot';
export { produtosAtivosDoCatalogo, produtosDaQuery } from './services/produtos';
export { temEstoqueNoHorizonte } from './services/estoque';
