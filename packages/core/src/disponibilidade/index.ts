/**
 * Motor de disponibilidade (NAPO-004) — o que pode ser vendido, quando.
 *
 * Recebe um snapshot já lido do banco e devolve a decisão. Nenhuma consulta,
 * nenhum fuso implícito: erro aqui vende pizza que não existe.
 */
export { calcularCutoff, janelaInicioDe, produzEm } from './cutoff';
export { diasDeEntregaDoHorizonte, ehDiaDeEntrega } from './janela';
export { calcularDisponibilidade, capacidadeRestante, proximoDiaComVaga } from './capacidade';
export type {
  ConfigOperacao,
  ConsumoDia,
  DataCalendario,
  DiaEntregaConfig,
  DiaProducaoConfig,
  DiaSemana,
  DisponibilidadeDia,
  DisponibilidadeProduto,
  ExcecaoCalendario,
  Lote,
  ModoPromessa,
  ProducaoPlanejada,
  Produto,
  Snapshot,
  TipoExcecao,
} from './tipos';
