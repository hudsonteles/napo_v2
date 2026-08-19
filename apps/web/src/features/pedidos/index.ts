/**
 * Superfície de servidor da feature de pedidos (ARCHITECTURE §3.2).
 *
 * Só o que rotas e páginas consomem. Os repositórios (`services/*-repo`) são
 * internos: quem precisa de dado passa pelos serviços, que carregam a regra.
 */
export { criarPedido, revalidarCarrinho } from './services/criar-pedido';
export type { ResultadoCriarPedido, Revalidacao } from './services/criar-pedido';
export { confirmarPeloRetorno, processarNotificacao } from './services/confirmar-pagamento';
export type { ResultadoWebhook } from './services/confirmar-pagamento';
export { cancelarPedidoRpc, expirarPedidosRpc, lerPagamentoMinutos, lerPedidoDoDono } from './services/pedidos-repo';
export type { PedidoDoDono } from './services/pedidos-repo';
export {
  criarPedidoSchema,
  validarCarrinhoSchema,
  notificacaoMpSchema,
} from './schema';
export type {
  EntradaCriarPedido,
  EntradaValidarCarrinho,
  ItemCheckout,
  NotificacaoMp,
} from './schema';
