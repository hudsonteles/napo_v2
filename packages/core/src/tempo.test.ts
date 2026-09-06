import { describe, expect, it } from 'vitest';

import { formatarContagem, hojeEmBrasilia } from './tempo';

describe('hojeEmBrasilia (RN6)', () => {
  // T3 — 02:30Z de 10/ago ainda é 09/ago às 23:30 em Brasília (UTC-3).
  it('respeita America/Sao_Paulo ao virar o dia', () => {
    const instante = new Date('2026-08-10T02:30:00Z');
    expect(hojeEmBrasilia(instante)).toBe('2026-08-09');
  });

  // T4 — o resultado não varia com o fuso do processo. `Intl` com `timeZone`
  // explícito ignora a variável TZ da máquina; provamos que os dois cenários
  // do contrato (America/New_York e UTC) produzem a mesma data.
  it('não varia com o fuso da máquina', () => {
    const instante = new Date('2026-08-10T02:30:00Z');
    const tzOriginal = process.env.TZ;

    try {
      process.env.TZ = 'America/New_York';
      const comNewYork = hojeEmBrasilia(instante);

      process.env.TZ = 'UTC';
      const comUtc = hojeEmBrasilia(instante);

      expect(comNewYork).toBe('2026-08-09');
      expect(comNewYork).toBe(comUtc);
    } finally {
      process.env.TZ = tzOriginal;
    }
  });
});

describe('formatarContagem', () => {
  it('formata minutos e segundos com dois dígitos', () => {
    expect(formatarContagem(30 * 60_000)).toBe('30:00');
    expect(formatarContagem(9 * 60_000 + 5_000)).toBe('09:05');
  });

  it('arredonda para cima: o segundo só some quando acaba de verdade', () => {
    // Meio segundo de vida ainda é 00:01. Zerar antes desmontaria o pagamento
    // antes de o prazo terminar.
    expect(formatarContagem(500)).toBe('00:01');
    expect(formatarContagem(1)).toBe('00:01');
    expect(formatarContagem(0)).toBe('00:00');
  });

  it('prazo vencido é 00:00, nunca negativo', () => {
    expect(formatarContagem(-1)).toBe('00:00');
    expect(formatarContagem(-90_000)).toBe('00:00');
  });

  it('passa de uma hora sem virar horas: o prazo é de minutos', () => {
    expect(formatarContagem(75 * 60_000)).toBe('75:00');
  });
});
