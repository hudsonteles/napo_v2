import type { ItemCarrinho } from '@napo/core';
import { normalizarItens } from '@napo/core';

// Versionada de propósito: uma futura mudança de forma troca a chave e ignora o
// formato velho, em vez de migrar lixo. `v1` é o que persiste hoje.
const CHAVE = 'napo.carrinho.v1';

function armazem(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Acesso a localStorage lança em alguns modos privados: trata como ausente.
    return null;
  }
}

/**
 * Lê o carrinho do navegador, tolerante a lixo (RN1). Qualquer surpresa — chave
 * ausente, JSON quebrado, formato inesperado, item malformado — vira carrinho
 * vazio, nunca erro em tela (T40). O que sai daqui já passou pela mesma
 * `normalizarItens` do carrinho vivo, então duplicata soma e quantidade inválida
 * some, igual ao núcleo.
 */
export function lerCarrinho(): ItemCarrinho[] {
  const store = armazem();
  if (!store) return [];

  try {
    const bruto = store.getItem(CHAVE);
    if (!bruto) return [];

    const dados: unknown = JSON.parse(bruto);
    if (!Array.isArray(dados)) return [];

    const itens = dados
      .filter(
        (d): d is ItemCarrinho =>
          typeof d === 'object' &&
          d !== null &&
          typeof (d as ItemCarrinho).produtoId === 'string' &&
          typeof (d as ItemCarrinho).quantidade === 'number',
      )
      .map((d) => ({ produtoId: d.produtoId, quantidade: d.quantidade }));

    return normalizarItens(itens);
  } catch {
    return [];
  }
}

export function gravarCarrinho(itens: ItemCarrinho[]): void {
  const store = armazem();
  if (!store) return;

  try {
    store.setItem(CHAVE, JSON.stringify(itens));
  } catch {
    // Quota cheia ou modo privado: perder a escrita é melhor que quebrar a tela.
  }
}
