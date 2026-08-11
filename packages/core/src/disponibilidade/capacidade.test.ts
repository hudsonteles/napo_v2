import { describe, expect, it } from 'vitest';

import { calcularDisponibilidade, capacidadeRestante, proximoDiaComVaga } from './capacidade';
import type { DiaSemana, Snapshot } from './tipos';

const MARGHERITA = 'p-margherita';
const MASSA = 'p-massa';

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
    produtos: [
      { id: MARGHERITA, ehMassa: false },
      { id: MASSA, ehMassa: true },
    ],
    lotes: [],
    producaoPlanejada: [],
    consumos: [],
    ...parcial,
  };
}

describe('capacidadeRestante', () => {
  it('T9 — o teto de forno limita o fluxo diário', () => {
    // Quinta 13/08: só a própria quinta produz antes da entrega de sexta.
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'));
    expect(capacidadeRestante('2026-08-14', snap)).toBe(30);
  });

  it('T10 — o teto de freezer limita o acúmulo e vence o do forno', () => {
    // Quinta 06/08 → 6 dias de produção até a sexta 14/08 = 180 de forno,
    // mas o freezer só guarda 150. O menor é o que vale.
    const snap = snapshot(new Date('2026-08-06T12:00:00Z'));
    expect(capacidadeRestante('2026-08-14', snap)).toBe(150);
  });

  it('T11 — produção já planejada abate, sem devolver negativo', () => {
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'), {
      producaoPlanejada: [{ data: '2026-08-13', produtoId: MARGHERITA, quantidade: 40 }],
    });
    expect(capacidadeRestante('2026-08-14', snap)).toBe(0);
  });

  it('T11 — consumo do dia abate a capacidade', () => {
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'), {
      consumos: [{ diaEntrega: '2026-08-14', produtoId: MARGHERITA, quantidade: 10 }],
    });
    expect(capacidadeRestante('2026-08-14', snap)).toBe(20);
  });
});

describe('calcularDisponibilidade', () => {
  it('T6 — antes do cutoff a promessa é CTP e soma estoque com capacidade', () => {
    const snap = snapshot(new Date('2026-08-10T12:00:00Z'), {
      lotes: [
        { produtoId: MARGHERITA, quantidade: 5, validade: '2026-09-01', diaEntregaAlocado: null },
      ],
    });
    const sexta = calcularDisponibilidade(snap).find((d) => d.data === '2026-08-14');

    expect(sexta?.modo).toBe('CTP');
    // 2 dias de produção (seg e ter) = 60, limitado pelo teto; mais 5 em estoque.
    expect(sexta?.produtos.find((p) => p.produtoId === MARGHERITA)?.disponivel).toBe(
      sexta!.capacidadeRestante + 5,
    );
  });

  it('T8 — depois do cutoff a promessa é ATP e vale só o lote pronto do dia', () => {
    // Quinta 13/08: o cutoff da sexta (quarta 17h) já passou.
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'), {
      lotes: [
        {
          produtoId: MARGHERITA,
          quantidade: 12,
          validade: '2026-09-01',
          diaEntregaAlocado: '2026-08-14',
        },
        { produtoId: MARGHERITA, quantidade: 99, validade: '2026-09-01', diaEntregaAlocado: null },
      ],
    });
    const sexta = calcularDisponibilidade(snap).find((d) => d.data === '2026-08-14');

    expect(sexta?.modo).toBe('ATP');
    expect(sexta?.produtos.find((p) => p.produtoId === MARGHERITA)?.disponivel).toBe(12);
  });

  it('T8 — lote vencido para o dia de entrega não conta', () => {
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'), {
      lotes: [
        {
          produtoId: MARGHERITA,
          quantidade: 12,
          validade: '2026-08-13',
          diaEntregaAlocado: '2026-08-14',
        },
      ],
    });
    const sexta = calcularDisponibilidade(snap).find((d) => d.data === '2026-08-14');
    expect(sexta?.produtos.find((p) => p.produtoId === MARGHERITA)?.disponivel).toBe(0);
  });

  it('T12 — massa respeita o sub-teto diário sem afetar a pizza', () => {
    const snap = snapshot(new Date('2026-08-10T12:00:00Z'), {
      consumos: [{ diaEntrega: '2026-08-14', produtoId: MASSA, quantidade: 6 }],
    });
    const sexta = calcularDisponibilidade(snap).find((d) => d.data === '2026-08-14');

    expect(sexta?.produtos.find((p) => p.produtoId === MASSA)?.disponivel).toBe(0);
    expect(sexta?.produtos.find((p) => p.produtoId === MARGHERITA)?.disponivel).toBeGreaterThan(0);
  });

  it('T13 — acima do limite de ocupação a massa sai do catálogo do dia', () => {
    // 25 de 30 vagas ocupadas = 83% > 80%.
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'), {
      consumos: [{ diaEntrega: '2026-08-14', produtoId: MARGHERITA, quantidade: 25 }],
      lotes: [
        {
          produtoId: MASSA,
          quantidade: 10,
          validade: '2026-09-01',
          diaEntregaAlocado: '2026-08-14',
        },
      ],
    });
    const sexta = calcularDisponibilidade(snap).find((d) => d.data === '2026-08-14');

    expect(sexta?.produtos.find((p) => p.produtoId === MASSA)?.disponivel).toBe(0);
  });
});

describe('lote liberado no admin', () => {
  it('T22 — lote reprogramado é considerado na consulta seguinte, sem recálculo manual', () => {
    // Depois do cutoff: em ATP só o lote pronto do dia conta.
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'));
    const antes = calcularDisponibilidade(snap).find((d) => d.data === '2026-08-14');
    expect(antes?.produtos.find((p) => p.produtoId === MARGHERITA)?.disponivel).toBe(0);

    // O gerente reprograma o lote perdido (NAPO-008 fará isso no banco).
    snap.lotes = [
      {
        produtoId: MARGHERITA,
        quantidade: 8,
        validade: '2026-09-01',
        diaEntregaAlocado: '2026-08-14',
      },
    ];

    const depois = calcularDisponibilidade(snap).find((d) => d.data === '2026-08-14');
    expect(depois?.produtos.find((p) => p.produtoId === MARGHERITA)?.disponivel).toBe(8);
  });
});

describe('proximoDiaComVaga', () => {
  it('T14 — produto esgotado aponta o próximo dia com vaga real', () => {
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'), {
      // Sexta 14/08 já passou do cutoff e não tem lote pronto: esgotada.
      consumos: [],
    });
    expect(proximoDiaComVaga(MARGHERITA, snap)).toBe('2026-08-21');
  });

  it('T14 — nunca sugere um dia igualmente lotado', () => {
    const snap = snapshot(new Date('2026-08-13T12:00:00Z'), {
      consumos: [{ diaEntrega: '2026-08-21', produtoId: MARGHERITA, quantidade: 999 }],
    });
    expect(proximoDiaComVaga(MARGHERITA, snap)).toBeNull();
  });
});
