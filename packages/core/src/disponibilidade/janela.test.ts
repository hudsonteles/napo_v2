import { describe, expect, it } from 'vitest';

import { diasDeEntregaDoHorizonte } from './janela';
import type { DiaSemana, Snapshot } from './tipos';

function snapshot(agora: Date, diasEntrega: DiaSemana[] = [5]): Snapshot {
  return {
    agora,
    config: {
      tempoPreparoHoras: 48,
      tetoFornoDia: 30,
      capacidadeFreezer: 150,
      subTetoMassaDia: 6,
      limiteOcupacaoMassaPct: 80,
      bufferCutoffMin: 15,
      reservaMinutos: 15,
      horizonteSemanas: 2,
    },
    diasEntrega: diasEntrega.map((d) => ({
      diaSemana: d,
      entrega: true,
      janelaInicio: '17:00',
      janelaFim: '21:00',
    })),
    diasProducao: [1, 2, 3, 4, 5].map((d) => ({
      diaSemana: d as DiaSemana,
      produz: true,
    })),
    excecoes: [],
    produtos: [],
    lotes: [],
    producaoPlanejada: [],
    consumos: [],
  };
}

describe('diasDeEntregaDoHorizonte', () => {
  it('T2 — horizonte de 2 semanas com um dia de entrega mostra 2 datas', () => {
    // Terça 2026-08-11, bem antes do cutoff da sexta.
    const dias = diasDeEntregaDoHorizonte(snapshot(new Date('2026-08-11T12:00:00Z')));
    expect(dias).toEqual(['2026-08-14', '2026-08-21']);
  });

  it('T1 — abrir o sábado no calendário passa a oferecê-lo, sem tocar em código', () => {
    const dias = diasDeEntregaDoHorizonte(
      snapshot(new Date('2026-08-11T12:00:00Z'), [5, 6]),
    );
    expect(dias).toEqual(['2026-08-14', '2026-08-15', '2026-08-21', '2026-08-22']);
  });

  it('T7 — o dia sai da vitrine dentro do buffer que antecede o cutoff', () => {
    // Cutoff da sexta 14/08 é quarta 12/08 às 17h (20:00Z). Faltam 10 min.
    const dias = diasDeEntregaDoHorizonte(snapshot(new Date('2026-08-12T19:50:00Z')));
    expect(dias[0]).toBe('2026-08-21');
    expect(dias).not.toContain('2026-08-14');
  });

  it('T7 — fora do buffer, o dia continua sendo oferecido', () => {
    // 20 min antes do cutoff: ainda há folga além dos 15 de buffer.
    const dias = diasDeEntregaDoHorizonte(snapshot(new Date('2026-08-12T19:40:00Z')));
    expect(dias[0]).toBe('2026-08-14');
  });

  it('T1 — exceção sem_entrega remove a data do horizonte', () => {
    const semEntrega = snapshot(new Date('2026-08-11T12:00:00Z'));
    semEntrega.excecoes = [{ data: '2026-08-14', tipo: 'sem_entrega' }];
    expect(diasDeEntregaDoHorizonte(semEntrega)).toEqual(['2026-08-21']);
  });

  it('T1 — exceção entrega_extra adiciona uma data fora do dia de semana', () => {
    const extra = snapshot(new Date('2026-08-11T12:00:00Z'));
    extra.excecoes = [{ data: '2026-08-13', tipo: 'entrega_extra' }];
    expect(diasDeEntregaDoHorizonte(extra)).toContain('2026-08-13');
  });
});
