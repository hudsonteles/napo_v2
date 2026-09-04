import { type ItemCarrinho, normalizarItens } from '@napo/core';

/**
 * O carrinho mora no navegador porque é anônimo (RN1): persistir em tabela
 * exigiria identificar quem não se identificou — cookie próprio, linha órfã e um
 * problema de LGPD criado do nada (design §2.2 alternativa C).
 *
 * A versão está na chave de propósito: mudar o formato depois não pode fazer o
 * carrinho antigo virar lixo em tela. A chave nova nasce vazia; a velha morre.
 */
export const CHAVE_CARRINHO = 'napo:carrinho:v1';

/** Nada aqui vale dinheiro, mas lixo aqui não pode derrubar a página (T40). */
export function lerCarrinho(): ItemCarrinho[] {
  const bruto = ler();
  if (!bruto) return [];

  try {
    const conteudo: unknown = JSON.parse(bruto);
    if (!Array.isArray(conteudo)) return [];

    return normalizarItens(conteudo.filter(ehItem));
  } catch {
    return [];
  }
}

export function gravarCarrinho(itens: ItemCarrinho[]): void {
  const normalizados = normalizarItens(itens);

  // Carrinho vazio não deixa rastro: um `[]` guardado só ocuparia a chave.
  if (normalizados.length === 0) return limparCarrinho();

  try {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(normalizados));
  } catch {
    // Modo privado e cota cheia recusam a escrita. O carrinho continua válido
    // nesta aba; só não sobrevive ao recarregamento.
  }
}

export function limparCarrinho(): void {
  try {
    localStorage.removeItem(CHAVE_CARRINHO);
  } catch {
    // Mesmo motivo do `gravarCarrinho`.
  }
}

function ler(): string | null {
  try {
    // No servidor `localStorage` não existe: a primeira renderização é sempre
    // de carrinho vazio, e a hidratação é quem traz o conteúdo real.
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(CHAVE_CARRINHO);
  } catch {
    return null;
  }
}

function ehItem(linha: unknown): linha is ItemCarrinho {
  if (typeof linha !== 'object' || linha === null) return false;

  const { produtoId, quantidade } = linha as Record<string, unknown>;
  return typeof produtoId === 'string' && produtoId.length > 0 && typeof quantidade === 'number';
}
