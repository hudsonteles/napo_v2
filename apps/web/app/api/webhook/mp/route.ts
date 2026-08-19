import { NextResponse } from 'next/server';

import { notificacaoMpSchema, processarNotificacao } from '@/features/pedidos';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/webhook/mp` — a única rota pública do sistema (RN8, RN10). Não
 * confia em nada do corpo além do id: verifica a assinatura, consulta o
 * pagamento na fonte e usa ESSA resposta como valor e status. Os códigos são
 * deliberados — `401` assinatura inválida, `200` processado ou já conhecido,
 * `5xx` erro nosso para o Mercado Pago reenviar.
 */
export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const parsed = notificacaoMpSchema.safeParse(corpo);

  // Corpo sem `data.id` não é processável. 200 para o Mercado Pago não reenviar
  // um formato que nunca vai melhorar (pings de teste, tópicos que não tratamos).
  if (!parsed.success) {
    return NextResponse.json({ success: true, ignorado: true });
  }

  const dataId = String(parsed.data.data.id);

  const status = await processarNotificacao({
    dataId,
    xSignature: request.headers.get('x-signature'),
    xRequestId: request.headers.get('x-request-id'),
    corpo,
  });

  return NextResponse.json({ success: status === 200 }, { status });
}
