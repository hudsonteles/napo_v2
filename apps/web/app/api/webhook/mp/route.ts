import { NextResponse } from 'next/server';

import { avaliarViabilidade, devolucaoPorCancelamento } from '@napo/core';

import { carregarSnapshot } from '@/features/disponibilidade';
import { dependenciasDaConfirmacao, processarNotificacao, repositorioDePedidos } from '@/features/pedidos';
import { portaDePagamento } from '@/lib/pagamentos/porta';

export const dynamic = 'force-dynamic';

/**
 * A única rota pública sem sessão do sistema (RN8, RN9, RN10).
 *
 * Ordem de propósito: assinatura primeiro, porque é barata e é o que separa
 * notificação legítima de forjada. Só depois se toca no banco.
 *
 * Códigos: 200 processado ou já conhecido · 401 assinatura inválida · 5xx erro
 * nosso — **deliberadamente**, para o gateway reenviar. Devolver 200 num erro
 * nosso transforma falha temporária em pedido pago que nunca confirma.
 */
export async function POST(request: Request) {
  const pagamento = portaDePagamento();
  const url = new URL(request.url);
  const corpo: unknown = await request.json().catch(() => null);

  const dataId = url.searchParams.get('data.id') ?? idDoCorpo(corpo);

  const assinaturaValida = pagamento.verificarAssinatura({
    assinatura: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
  });

  if (!assinaturaValida) {
    await repositorioDePedidos().registrarEvento({
      pedidoId: null,
      mpPaymentId: dataId,
      resultado: 'assinatura_invalida',
      corpo,
    });

    return NextResponse.json({ success: false }, { status: 401 });
  }

  if (!dataId) return NextResponse.json({ success: false }, { status: 400 });

  try {
    const repo = repositorioDePedidos();

    const { http, resultado } = await processarNotificacao(
      dataId,
      dependenciasDaConfirmacao(repo, pagamento, {
        carregarSnapshot,
        avaliarViabilidade,
        devolucaoPorCancelamento,
      }),
      corpo,
    );

    return NextResponse.json({ success: http < 400, resultado }, { status: http });
  } catch {
    // Erro nosso não pode virar 200: o gateway precisa reenviar (T30).
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

function idDoCorpo(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null) return null;
  const dados = (corpo as { data?: { id?: unknown } }).data;
  return typeof dados?.id === 'string' ? dados.id : null;
}
