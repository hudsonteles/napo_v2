import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { expirarPedidosRpc } from '@/features/pedidos';
import { getPagamentoEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/manutencao/pedidos-parados` — varredura protegida por segredo em
 * header, não por sessão: quem chama é agendador, não pessoa (design §3.2).
 * Expira pedidos vencidos e devolve a vaga (RN13). Enquanto o NAPO-021 não dá
 * ambiente publicado, é chamada à mão; depois vira Vercel Cron sem mudar código.
 *
 * A reconsulta ativa de pedido parado (RN19) é entregue pela tela de retorno
 * (`GET /api/pedidos/[numero]`, T38), que tem o `payment_id`; a varredura por
 * busca no Mercado Pago fica para quando houver ambiente real que a exercite.
 */
export async function POST(request: Request) {
  const segredo = getPagamentoEnv().MANUTENCAO_SECRET;
  const recebido = request.headers.get('x-manutencao-secret');

  // Sem segredo configurado, ninguém entra — falha fechada. Comparação em tempo
  // constante para o header não virar oráculo do segredo (RN19).
  if (!segredo || !recebido || !igualdadeConstante(recebido, segredo)) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const expirados = await expirarPedidosRpc();
  return NextResponse.json({ success: true, data: { expirados } });
}

function igualdadeConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // `timingSafeEqual` lança com comprimentos diferentes; o curto-circuito de
  // tamanho não vaza timing útil (o segredo tem tamanho fixo).
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
