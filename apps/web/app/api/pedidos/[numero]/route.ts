import { NextResponse } from 'next/server';

import { confirmarPeloRetorno, lerPedidoDoDono } from '@/features/pedidos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/pedidos/[numero]` — status do pedido do próprio cliente (RN17), lido
 * sob a RLS do dono: número alheio simplesmente não existe (404).
 *
 * **Reconciliação ativa (RN19, T38):** se o pedido ainda está aguardando e a URL
 * de retorno trouxe o `payment_id`, consulta o Mercado Pago na hora antes de
 * responder. Webhook perdido não pode deixar dinheiro na conta e pedido parado
 * para sempre — a leitura da tela é a segunda rede de segurança. A confirmação é
 * idempotente e só toca o pedido do próprio dono, então o efeito colateral no
 * GET é seguro.
 */
export async function GET(request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const numero = Number((await params).numero);
  if (!Number.isInteger(numero)) {
    return NextResponse.json({ success: false, error: 'Número inválido.' }, { status: 400 });
  }

  let pedido = await lerPedidoDoDono(numero);
  if (!pedido) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado.' }, { status: 404 });
  }

  const paymentId = new URL(request.url).searchParams.get('payment_id');
  if (pedido.status === 'aguardando_pagamento' && paymentId) {
    // Reconciliação é best-effort: se falhar (gateway fora, corrida de
    // confirmação), a leitura do status ainda responde. A tela segue em
    // "confirmando" e tenta de novo — nunca um 500 em loop na cara do cliente.
    try {
      await confirmarPeloRetorno(numero, paymentId);
      pedido = (await lerPedidoDoDono(numero)) ?? pedido;
    } catch (erro) {
      console.error('[pedido] reconciliação falhou', { numero, erro });
    }
  }

  // O UUID interno não vai para o cliente — o identificador público é o número (RN16).
  return NextResponse.json({
    success: true,
    data: {
      numero: pedido.numero,
      status: pedido.status,
      diaEntrega: pedido.diaEntrega,
      subtotalCentavos: pedido.subtotalCentavos,
      freteCentavos: pedido.freteCentavos,
      totalCentavos: pedido.totalCentavos,
      veredito: pedido.veredito,
      criadoEm: pedido.criadoEm,
      enderecoSnapshot: pedido.enderecoSnapshot,
      itens: pedido.itens,
    },
  });
}
