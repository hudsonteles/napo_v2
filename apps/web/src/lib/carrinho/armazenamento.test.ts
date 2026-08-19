import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gravarCarrinho, lerCarrinho } from './armazenamento';

const CHAVE = 'napo.carrinho.v1';

function fakeStorage(): Storage {
  const mapa = new Map<string, string>();
  return {
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => void mapa.set(k, v),
    removeItem: (k) => void mapa.delete(k),
    clear: () => mapa.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

function definirStorage(store: Storage | undefined) {
  if (store) (globalThis as { localStorage?: Storage }).localStorage = store;
  else delete (globalThis as { localStorage?: Storage }).localStorage;
}

describe('armazenamento do carrinho (RN1)', () => {
  beforeEach(() => definirStorage(fakeStorage()));
  afterEach(() => definirStorage(undefined));

  it('T1 — o carrinho sobrevive a recarregar (round-trip pelo localStorage)', () => {
    gravarCarrinho([{ produtoId: 'p1', quantidade: 2 }]);
    expect(lerCarrinho()).toEqual([{ produtoId: 'p1', quantidade: 2 }]);
  });

  it('T40 — JSON corrompido vira carrinho vazio, sem lançar', () => {
    globalThis.localStorage.setItem(CHAVE, '{isso não é json}');
    expect(() => lerCarrinho()).not.toThrow();
    expect(lerCarrinho()).toEqual([]);
  });

  it('T40 — formato inesperado (não-array) também vira vazio', () => {
    globalThis.localStorage.setItem(CHAVE, JSON.stringify({ produtoId: 'p1' }));
    expect(lerCarrinho()).toEqual([]);
  });

  it('descarta item malformado e soma duplicatas na leitura', () => {
    globalThis.localStorage.setItem(
      CHAVE,
      JSON.stringify([
        { produtoId: 'p1', quantidade: 1 },
        { produtoId: 'p1', quantidade: 2 },
        { produtoId: 'p2', quantidade: -1 },
        { quantidade: 5 },
      ]),
    );
    expect(lerCarrinho()).toEqual([{ produtoId: 'p1', quantidade: 3 }]);
  });

  it('sem localStorage (SSR) devolve vazio e não grava', () => {
    definirStorage(undefined);
    expect(lerCarrinho()).toEqual([]);
    expect(() => gravarCarrinho([{ produtoId: 'p1', quantidade: 1 }])).not.toThrow();
  });
});
