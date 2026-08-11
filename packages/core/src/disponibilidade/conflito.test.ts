import { describe, expect, it } from 'vitest';

import { avaliarViabilidade, devolucaoPorCancelamento } from './conflito';
import type { DiaSemana, Snapshot } from './tipos';

const MARGHERITA = 'p-margherita';

function snapshot(agora: Date, parcial: Partial<Snapshot> = {}): Snapshot {
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
    diasEntrega: [{ diaSemana: 5, entrega: true, janelaInicio: '17:00', janelaFim: '21:00' }],
    diasProducao: [1, 2, 3, 4, 5].map((d) => ({ diaSemana: d as DiaSemana, produz: true })),
    excecoes: [],
    produtos: [{ id: MARGHERITA, ehMassa: false }],
    lotes: [],
    producaoPlanejada: [],
    consumos: [],
    ...parcial,
  };
}

describe('avaliarViabilidade', () => {
  it('T20 — cutoff vencido sem lote pronto é reportado, não resolvido', () => {
    // Quinta 13/08: o cutoff da sexta (quarta 17h) já passou e não há lote.
    const veredito = avaliarViabilidade(
      '2026-08-14',
      MARGHERITA,
      1,
      snapshot(new Date('2026-08-13T12:00:00Z')),
    );
    expect(veredito).toBe('cutoff_vencido');
  });

  it('T20 — cutoff vencido com lote pronto continua viável', () => {
    const comLote = snapshot(new Date('2026-08-13T12:00:00Z'), {
      lotes: [
        {
          produtoId: MARGHERITA,
          quantidade: 3,
          validade: '2026-09-01',
          diaEntregaAlocado: '2026-08-14',
        },
      ],
    });
    expect(avaliarViabilidade('2026-08-14', MARGHERITA, 2, comLote)).toBe('viavel');
  });

  it('T20 — antes do cutoff, faltar vaga é sem_vaga e não cutoff_vencido', () => {
    const lotado = snapshot(new Date('2026-08-10T12:00:00Z'), {
      consumos: [{ diaEntrega: '2026-08-14', produtoId: MARGHERITA, quantidade: 999 }],
    });
    expect(avaliarViabilidade('2026-08-14', MARGHERITA, 1, lotado)).toBe('sem_vaga');
  });

  it('T20 — dentro da capacidade, antes do cutoff, é viável', () => {
    expect(
      avaliarViabilidade('2026-08-14', MARGHERITA, 5, snapshot(new Date('2026-08-10T12:00:00Z'))),
    ).toBe('viavel');
  });
});

describe('devolucaoPorCancelamento', () => {
  it('T21 — antes do cutoff devolve capacidade: nada foi produzido', () => {
    expect(devolucaoPorCancelamento('2026-08-14', snapshot(new Date('2026-08-10T12:00:00Z')))).toBe(
      'capacidade',
    );
  });

  it('T21 — depois do cutoff devolve lote: a pizza já existe', () => {
    expect(devolucaoPorCancelamento('2026-08-14', snapshot(new Date('2026-08-13T12:00:00Z')))).toBe(
      'lote',
    );
  });
});
