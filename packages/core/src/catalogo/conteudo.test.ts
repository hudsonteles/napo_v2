import { describe, expect, it } from 'vitest';

import { alegacoesDeSaudeEncontradas, contémAlegacaoDeSaude } from './conteudo';

describe('contémAlegacaoDeSaude (RN7)', () => {
  it('T13 — formulação sensorial é permitida', () => {
    // RN7 permite "leve" e "não pesa" — sensorial, não alegação funcional.
    expect(contémAlegacaoDeSaude('Leve, não pesa. Assada na pedra, longa fermentação.')).toBe(
      false,
    );
  });

  it('T13 — alegação de digestão é proibida', () => {
    expect(contémAlegacaoDeSaude('Massa que faz bem para a digestão')).toBe(true);
  });

  it('T13 — alegação de saúde é proibida', () => {
    expect(contémAlegacaoDeSaude('A pizza mais saudável de Brasília')).toBe(true);
  });

  it('nomeia os termos encontrados, para o teste de conteúdo acusar onde', () => {
    expect(alegacoesDeSaudeEncontradas('Detox e imunidade em cada fatia')).toEqual(
      expect.arrayContaining(['detox', 'imunidade']),
    );
    expect(alegacoesDeSaudeEncontradas('Assada na pedra')).toEqual([]);
  });

  it('não confunde o sensorial "leve" com alegação', () => {
    expect(alegacoesDeSaudeEncontradas('Uma massa leve e crocante')).toEqual([]);
  });
});
