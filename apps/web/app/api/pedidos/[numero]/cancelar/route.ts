import { NextResponse } from 'next/server';

import { calcularCutoff, devolucaoPorCancelamento } from '@napo/core';

import { carregarSnapshot } from '@/features/disponibilidade';
import { repositorioDePedidos } from '@/features/pedidos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/**
 * Endpoint dedicado, não `PATCH` de status (design §3.2): cancelar dispara
 * devolução de capacidade ou lote (RN14) e é barrado pelo cutoff (RN15) —
 * transição com regra, não edição de campo. Um `PATCH {status}` genérico
 * convidaria o cliente a tentar `{status:'pago'}`.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const { numero } = await params;
  const repo = repositorioDePedidos();
  const pedido = await repo.lerPedidoPorNumero(Number(numero));

  if (!pedido || pedido.profileId !== guarda.perfil.id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });
  }

  const snapshot = await carregarSnapshot(
    pedido.itens.map((item) => ({ id: item.produtoId, ehMassa: false })),
  );

  // Depois do cutoff a pizza já entrou na fila de produção: quem cancela é a
  // equipe, com contato humano, não um botão na tela (RN15).
  if (snapshot.agora.getTime() >= calcularCutoff(pedido.diaEntrega, snapshot).getTime()) {
    return NextResponse.json(
      { success: false, error: 'prazo_de_cancelamento_encerrado' },
      { status: 409 },
    );
  }

  const cancelou = await repo.cancelarPedido(
    pedido.id,
    devolucaoPorCancelamento(pedido.diaEntrega, snapshot),
  );

  if (!cancelou) {
    return NextResponse.json(
      { success: false, error: 'pedido_ja_encerrado' },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data: { numero: pedido.numero, status: 'cancelado' } });
}
