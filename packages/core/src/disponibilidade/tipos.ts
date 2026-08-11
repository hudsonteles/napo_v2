/**
 * Contrato do motor de disponibilidade (NAPO-004).
 *
 * O núcleo não conhece Supabase: recebe um `Snapshot` já montado e devolve a
 * decisão. É essa fronteira que mantém a regra que decide o que pode ser
 * vendido testável sem banco (ARCHITECTURE §3.2).
 */

/** 0=domingo … 6=sábado, igual ao `EXTRACT(DOW)` do Postgres. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Data de calendário em Brasília, `YYYY-MM-DD`. */
export type DataCalendario = string;

export type TipoExcecao = 'sem_producao' | 'sem_entrega' | 'entrega_extra';

/** Antes do cutoff prometemos o que dá para produzir; depois, só o que existe. */
export type ModoPromessa = 'CTP' | 'ATP';

export interface ConfigOperacao {
  tempoPreparoHoras: number;
  tetoFornoDia: number;
  capacidadeFreezer: number;
  subTetoMassaDia: number;
  limiteOcupacaoMassaPct: number;
  bufferCutoffMin: number;
  reservaMinutos: number;
  horizonteSemanas: number;
}

export interface DiaEntregaConfig {
  diaSemana: DiaSemana;
  entrega: boolean;
  /** `HH:MM` — origem do cutoff (RN1). */
  janelaInicio: string;
  janelaFim: string;
}

export interface DiaProducaoConfig {
  diaSemana: DiaSemana;
  produz: boolean;
}

export interface ExcecaoCalendario {
  data: DataCalendario;
  tipo: TipoExcecao;
}

export interface Produto {
  id: string;
  /** Massa consome vaga de forno igual a uma pizza, mas rende bem menos (RN8). */
  ehMassa: boolean;
}

export interface Lote {
  produtoId: string;
  quantidade: number;
  validade: DataCalendario;
  /** Lote já reservado para um dia específico; `null` = livre para alocar. */
  diaEntregaAlocado: DataCalendario | null;
}

export interface ProducaoPlanejada {
  data: DataCalendario;
  produtoId: string;
  quantidade: number;
}

/** Reserva de checkout ainda dentro da validade, ou item já vendido para o dia. */
export interface ConsumoDia {
  diaEntrega: DataCalendario;
  produtoId: string;
  quantidade: number;
}

export interface Snapshot {
  agora: Date;
  config: ConfigOperacao;
  diasEntrega: DiaEntregaConfig[];
  diasProducao: DiaProducaoConfig[];
  excecoes: ExcecaoCalendario[];
  produtos: Produto[];
  lotes: Lote[];
  producaoPlanejada: ProducaoPlanejada[];
  /** Reservas vivas + pedidos pagos: tudo que já tomou vaga do dia. */
  consumos: ConsumoDia[];
}

export interface DisponibilidadeProduto {
  produtoId: string;
  disponivel: number;
}

export interface DisponibilidadeDia {
  data: DataCalendario;
  cutoff: Date;
  modo: ModoPromessa;
  capacidadeRestante: number;
  produtos: DisponibilidadeProduto[];
}
