import { hojeEmBrasilia, instanteEmBrasilia, diaDaSemanaEmBrasilia } from '../tempo';
import type { DataCalendario, Snapshot } from './tipos';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Recuo máximo antes de desistir — duas semanas sem produção não é operação. */
const LIMITE_RECUO_DIAS = 14;

/** O dia produz? Exceção na data vence a regra do dia da semana. */
export function produzEm(dia: DataCalendario, snapshot: Snapshot): boolean {
  if (snapshot.excecoes.some((e) => e.data === dia && e.tipo === 'sem_producao')) {
    return false;
  }
  const diaSemana = diaDaSemanaEmBrasilia(dia);
  return snapshot.diasProducao.some((d) => d.diaSemana === diaSemana && d.produz);
}

/** Início da janela de entrega (`HH:MM`) configurado para o dia da semana. */
export function janelaInicioDe(dia: DataCalendario, snapshot: Snapshot): string | null {
  const diaSemana = diaDaSemanaEmBrasilia(dia);
  return snapshot.diasEntrega.find((d) => d.diaSemana === diaSemana)?.janelaInicio ?? null;
}

/**
 * Cutoff de um dia de entrega (RN1, RN2).
 *
 * Recuar em vez de avançar é o ponto: pode cortar a venda mais cedo, nunca
 * prometer o que não se consegue produzir. Se nem o limite de recuo encontra
 * dia de produção, o cutoff fica no passado — e o dia simplesmente não é
 * oferecido, que é o modo seguro de falhar.
 */
export function calcularCutoff(dataEntrega: DataCalendario, snapshot: Snapshot): Date {
  // Sem janela configurada para o dia da semana, usa a primeira disponível:
  // uma entrega excepcional herda o horário da operação.
  const janelaInicio =
    janelaInicioDe(dataEntrega, snapshot) ?? snapshot.diasEntrega[0]?.janelaInicio ?? '00:00';

  const inicioDaEntrega = instanteEmBrasilia(dataEntrega, janelaInicio);
  let cutoff = new Date(
    inicioDaEntrega.getTime() - snapshot.config.tempoPreparoHoras * 60 * 60 * 1000,
  );

  // Recuo em passos de 24h: o Brasil não tem horário de verão desde 2019, então
  // o horário do dia se preserva sem reconstruir o instante.
  for (let i = 0; i < LIMITE_RECUO_DIAS; i += 1) {
    if (produzEm(hojeEmBrasilia(cutoff), snapshot)) return cutoff;
    cutoff = new Date(cutoff.getTime() - UM_DIA_MS);
  }
  return cutoff;
}
