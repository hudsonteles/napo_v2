import { NextResponse } from 'next/server';

import { avaliarViabilidade, devolucaoPorCancelamento } from '@napo/core';

import { carregarSnapshot } from '@/features/disponibilidade';
import {
  repositorioDeCobrancas,
  dependenciasDaConfirmacao,
  reconciliarPedido,
  repositorioDePedidos,
} from '@/features/pedidos';
import { exigirClienteValidado } from '@/lib/guarda-api';
import { portaDePagamento } from '@/lib/pagamentos/porta';

export const dynamic = 'force-dynamic';

/**
 * Status do pedido do próprio cliente — e o resgate da RN19.
 *
 * Se o pedido ainda aguarda pagamento, a tela pergunta ao gateway **na hora**:
 * webhook perdido existe, e sem esta consulta há dinheiro na conta e pedido
 * `aguardando_pagamento` para sempre.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const { numero } = await params;
  const repo = repositorioDePedidos();
  const pedido = await repo.lerPedidoPorNumero(Number(numero));

  // Pedido de outra pessoa responde igual a pedido inexistente: o endpoint não
  // pode virar oráculo de quantos pedidos a casa já fez.
  if (!pedido || pedido.profileId !== guarda.perfil.id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });
  }

  // Só vale perguntar ao gateway enquanto o dinheiro não chegou (RN19).
  if (pedido.situacaoPagamento === 'pago' || pedido.situacaoPagamento === 'estornado') {
    return NextResponse.json({ success: true, data: resumo(pedido) });
  }

  await reconciliarPedido(
    pedido,
    dependenciasDaConfirmacao(repo, repositorioDeCobrancas(), portaDePagamento(), {
      carregarSnapshot,
      avaliarViabilidade,
      devolucaoPorCancelamento,
    }),
  );

  const atualizado = await repo.lerPedidoPorNumero(Number(numero));
  return NextResponse.json({ success: true, data: resumo(atualizado ?? pedido) });
}

function resumo(pedido: {
  numero: number;
  status: string;
  diaEntrega: string;
  totalCentavos: number;
}) {
  return {
    numero: pedido.numero,
    status: pedido.status,
    diaEntrega: pedido.diaEntrega,
    totalCentavos: pedido.totalCentavos,
  };
}
