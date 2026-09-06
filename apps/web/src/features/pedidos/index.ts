/**
 * Superfície de servidor da feature de pedidos (NAPO-006).
 *
 * Expõe o orquestrador, o repositório e os schemas — o que as rotas consomem.
 * Quem monta as fontes é a camada `app`: catálogo, disponibilidade e endereços
 * são outras features, e feature não importa de feature (ARCHITECTURE §3.2).
 */
export { criarPedido } from './services/criar-pedido';
export type {
  DependenciasDoPedido,
  EnderecoDoPedido,
  FalhaDoPedido,
  FontesDoPedido,
  PedidoCriado,
  PrecoDeProduto,
  ResultadoCriacao,
} from './services/criar-pedido';
export { processarNotificacao, reconciliarPedido } from './services/confirmar-pagamento';
export type {
  DependenciasDaConfirmacao,
  RespostaDaConfirmacao,
  ResultadoDaConfirmacao,
} from './services/confirmar-pagamento';
export { dependenciasDaConfirmacao } from './services/dependencias';
export type { FerramentasDeViabilidade } from './services/dependencias';
export { repositorioDePedidos } from './services/pedidos-repo';
export type {
  EventoDePagamento,
  PedidoLido,
  RepositorioDePedidos,
  SituacaoPagamento,
} from './services/pedidos-repo';
export { repositorioDeCobrancas } from './services/cobrancas-repo';
export type {
  CobrancaLida,
  InstrumentoCobranca,
  RepositorioDeCobrancas,
  SituacaoCobranca,
} from './services/cobrancas-repo';
export { criarCobranca } from './services/criar-cobranca';
export type {
  CobrancaAberta,
  DependenciasDaCobranca,
  EntradaPagamento,
  FalhaDaCobranca,
  ResultadoDaCobranca,
} from './services/criar-cobranca';
export { esquemaCriarPagamento, esquemaCriarPedido, esquemaValidarCarrinho } from './schema';
export type {
  EntradaCriarPagamento,
  EntradaCriarPedido,
  EntradaValidarCarrinho,
} from './schema';
