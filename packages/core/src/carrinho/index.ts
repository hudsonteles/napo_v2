/**
 * Carrinho e composição do pedido (NAPO-006).
 *
 * Ids e quantidades entram, dinheiro sai. Nenhuma consulta, nenhum React: a
 * regra que decide quanto o cliente paga é testável sem banco e sem navegador.
 */
export {
  aplicarTetos,
  calcularSubtotal,
  conferirPrecos,
  montarTotais,
  normalizarItens,
} from './carrinho';
export { resolverDiaDoPedido } from './dia';
export type { DiaDoPedido } from './dia';
export type {
  AjusteItem,
  CarrinhoAjustado,
  DivergenciaPreco,
  EntradaTotais,
  ItemCarrinho,
  ItemPrecificado,
  PrecoConhecido,
  Totais,
} from './tipos';
