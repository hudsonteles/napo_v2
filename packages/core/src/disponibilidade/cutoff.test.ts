import { describe, expect, it } from 'vitest';

import { calcularCutoff } from './cutoff';
import type { Snapshot } from './tipos';

/** Segunda 2026-08-10, 09h em Brasília. A sexta seguinte é 2026-08-14. */
const AGORA = new Date('2026-08-10T12:00:00Z');

function snapshot(excecoes: Snapshot['excecoes'] = []): Snapshot {
  return {
    agora: AGORA,
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
    diasEntrega: [
      { diaSemana: 5, entrega: true, janelaInicio: '17:00', janelaFim: '21:00' },
    ],
    diasProducao: [1, 2, 3, 4, 5].map((d) => ({
      diaSemana: d as 1 | 2 | 3 | 4 | 5,
      produz: true,
    })),
    excecoes,
    produtos: [],
    lotes: [],
    producaoPlanejada: [],
    consumos: [],
  };
}

describe('calcularCutoff', () => {
  it('T3 — deriva o cutoff da janela de entrega menos o preparo', () => {
    // Sexta 17h − 48h = quarta 17h (20h UTC).
    expect(calcularCutoff('2026-08-14', snapshot())).toEqual(
      new Date('2026-08-12T20:00:00Z'),
    );
  });

  it('T4 — recua ao cair em dia sem produção, nunca avança', () => {
    const comFeriado = snapshot([{ data: '2026-08-12', tipo: 'sem_producao' }]);
    const cutoff = calcularCutoff('2026-08-14', comFeriado);

    // Terça 17h — recuou um dia, mantendo o horário.
    expect(cutoff).toEqual(new Date('2026-08-11T20:00:00Z'));
    expect(cutoff.getTime()).toBeLessThan(new Date('2026-08-12T20:00:00Z').getTime());
  });

  it('T4 — recua sobre o fim de semana, que não é dia de produção', () => {
    // Entrega na terça: terça 17h − 48h = domingo 17h, que não produz.
    const comTerca = snapshot();
    comTerca.diasEntrega.push({
      diaSemana: 2,
      entrega: true,
      janelaInicio: '17:00',
      janelaFim: '21:00',
    });

    // Recua de domingo para a sexta anterior (sábado também não produz).
    expect(calcularCutoff('2026-08-18', comTerca)).toEqual(
      new Date('2026-08-14T20:00:00Z'),
    );
  });

  it('T5 — o resultado independe do fuso do processo', () => {
    // O instante é absoluto (UTC). Se o cálculo usasse a data da máquina, um
    // processo em UTC produziria 17:00Z em vez de 20:00Z.
    const cutoff = calcularCutoff('2026-08-14', snapshot());
    expect(cutoff.toISOString()).toBe('2026-08-12T20:00:00.000Z');
  });
});
