import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAVE_CARRINHO, gravarCarrinho, lerCarrinho, limparCarrinho } from './armazenamento';

const PRODUTO = 'p-calabresa';

/** `localStorage` de mentira: o teste roda em Node, sem navegador. */
function memoria(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    removeItem: (chave: string) => void dados.delete(chave),
    conteudo: () => dados,
  };
}

function instalar(armazem: ReturnType<typeof memoria> | null) {
  vi.stubGlobal('localStorage', armazem);
}

describe('armazenamento do carrinho (RN1)', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('T1 — o carrinho sobrevive a recarregar a página', () => {
    const armazem = memoria();
    instalar(armazem);

    gravarCarrinho([{ produtoId: PRODUTO, quantidade: 2 }]);

    expect(lerCarrinho()).toEqual([{ produtoId: PRODUTO, quantidade: 2 }]);
  });

  it('T40 — conteúdo corrompido é tratado como carrinho vazio', () => {
    for (const lixo of ['{', 'null', '"texto"', '42', '[{"produtoId":123}]', '[[]]']) {
      instalar(memoria({ [CHAVE_CARRINHO]: lixo }));
      expect(lerCarrinho()).toEqual([]);
    }
  });

  it('T40 — quantidade impossível é descartada, não corrigida em silêncio no total', () => {
    instalar(
      memoria({
        [CHAVE_CARRINHO]: JSON.stringify([
          { produtoId: PRODUTO, quantidade: 1.5 },
          { produtoId: 'p-margherita', quantidade: 0 },
          { produtoId: 'p-lombo', quantidade: -3 },
          { produtoId: 'p-frango', quantidade: 2 },
        ]),
      }),
    );

    expect(lerCarrinho()).toEqual([{ produtoId: 'p-frango', quantidade: 2 }]);
  });

  it('T40 — linhas repetidas do mesmo sabor viram uma só', () => {
    instalar(
      memoria({
        [CHAVE_CARRINHO]: JSON.stringify([
          { produtoId: PRODUTO, quantidade: 1 },
          { produtoId: PRODUTO, quantidade: 2 },
        ]),
      }),
    );

    expect(lerCarrinho()).toEqual([{ produtoId: PRODUTO, quantidade: 3 }]);
  });

  it('T40 — sem `localStorage` a leitura devolve vazio e a gravação não lança', () => {
    instalar(null);

    expect(lerCarrinho()).toEqual([]);
    expect(() => gravarCarrinho([{ produtoId: PRODUTO, quantidade: 1 }])).not.toThrow();
  });

  it('T40 — armazenamento que lança (modo privado, cota cheia) não derruba a tela', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('acesso negado');
      },
      setItem: () => {
        throw new Error('cota estourada');
      },
      removeItem: () => {
        throw new Error('acesso negado');
      },
    });

    expect(lerCarrinho()).toEqual([]);
    expect(() => gravarCarrinho([{ produtoId: PRODUTO, quantidade: 1 }])).not.toThrow();
    expect(() => limparCarrinho()).not.toThrow();
  });

  it('carrinho vazio some da memória do navegador em vez de virar `[]` guardado', () => {
    const armazem = memoria({ [CHAVE_CARRINHO]: JSON.stringify([{ produtoId: PRODUTO, quantidade: 1 }]) });
    instalar(armazem);

    gravarCarrinho([]);

    expect(armazem.conteudo().has(CHAVE_CARRINHO)).toBe(false);
  });

  it('a chave carrega a versão do formato', () => {
    // Mudar o formato amanhã não pode fazer o carrinho velho virar lixo em tela:
    // a chave nova nasce vazia e a antiga é ignorada.
    expect(CHAVE_CARRINHO).toMatch(/v\d+$/);
  });
});
