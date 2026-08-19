import { NextResponse } from 'next/server';

import { devolucaoPorCancelamento } from '@napo/core';

import { carregarSnapshot } from '@/features/disponibilidade';
import { cancelarPedidoRpc, lerPedidoDoDono } from '@/features/pedidos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/pedidos/[numero]/cancelar` — cancelamento pelo cliente antes do
 * cutoff (RN14, RN15). Endpoint dedicado, não `PATCH {status}`: cancelar dispara
 * devolução de capacidade e é barrado pelo cutoff — transição com regra, não
 * edição de campo. Depois do cutoff a pizza entrou na produção do dia: `409`, o
 * pedido permanece pago e a tela oferece o WhatsApp (T16).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const numero = Number((await params).numero);
  if (!Number.isInteger(numero)) {
    return NextResponse.json({ success: false, error: 'Número inválido.' }, { status: 400 });
  }

  // Leitura sob a RLS do dono: pedido de outro cliente não existe aqui (RN17).
  const pedido = await lerPedidoDoDono(numero);
  if (!pedido) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });
  }

  if (pedido.status !== 'pago') {
    return NextResponse.json(
      { success: false, error: 'Este pedido não pode ser cancelado.' },
      { status: 409 },
    );
  }

  // `devolucaoPorCancelamento` também decide o cutoff: `lote` significa que já
  // passou dele — a pizza vai ser produzida e o cliente não cancela mais sozinho.
  const snapshot = await carregarSnapshot([]);
  const devolucao = devolucaoPorCancelamento(pedido.diaEntrega, snapshot);

  if (devolucao === 'lote') {
    return NextResponse.json(
      { success: false, error: 'Este pedido já entrou na produção do dia. Fale com a gente no WhatsApp.' },
      { status: 409 },
    );
  }

  const cancelado = await cancelarPedidoRpc(pedido.id, 'capacidade');
  if (!cancelado) {
    return NextResponse.json(
      { success: false, error: 'Este pedido não pode ser cancelado.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data: { devolucao } });
}
