import 'server-only';

import { calcularDisponibilidade } from '@napo/core';

import { carregarSnapshot } from './snapshot';
import { produtosAtivosDoCatalogo } from './produtos';

/**
 * Estoque no horizonte para o JSON-LD (RN9/T23): `InStock` se há vaga em alguma
 * fornada, `OutOfStock` se não há em nenhuma. É um snapshot de build (a página
 * revalida por hora) — o buscador lê o marcado, não o vivo do cliente. Preço e
 * disponibilidade continuam saindo da mesma origem que a tela usa.
 */
export async function temEstoqueNoHorizonte(produtoId: string): Promise<boolean> {
  const produtos = await produtosAtivosDoCatalogo();
  const snapshot = await carregarSnapshot(produtos);
  const dias = calcularDisponibilidade(snapshot);
  return dias.some(
    (dia) => (dia.produtos.find((p) => p.produtoId === produtoId)?.disponivel ?? 0) > 0,
  );
}
