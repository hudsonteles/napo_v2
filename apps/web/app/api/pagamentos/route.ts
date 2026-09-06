import { NextResponse } from 'next/server';

import {
  criarCobranca,
  esquemaCriarPagamento,
  repositorioDeCobrancas,
  repositorioDePedidos,
} from '@/features/pedidos';
import { exigirClienteValidado } from '@/lib/guarda-api';
import { portaDePagamento } from '@/lib/pagamentos/porta';

export const dynamic = 'force-dynamic';

/**
 * Onde o token do Payment Brick vira cobrança (ADR-0001).
 *
 * O que chega aqui é o que o `onSubmit` do Brick entregou: um token gerado
 * dentro dos campos isolados do Mercado Pago. Número, validade e código de
 * segurança **não passam por este servidor** (RN9), e o schema `.strict()`
 * recusa o corpo se algum dia caírem nele por engano.
 *
 * Aprovar não é confirmar: quem confirma o pedido é o webhook (RN6). O que esta
 * rota devolve é "a tentativa está de pé", com o QR quando o meio é Pix.
 */
export async function POST(request: Request) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = esquemaCriarPagamento.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  const resultado = await criarCobranca(corpo.data, guarda.perfil.id, {
    pagamento: portaDePagamento(),
    cobrancas: repositorioDeCobrancas(),
    pedidos: repositorioDePedidos(),
  });

  if (!resultado.ok) {
    const { status, ...falha } = resultado.falha;
    return NextResponse.json({ success: false, error: falha }, { status });
  }

  return NextResponse.json({ success: true, data: resultado.cobranca });
}
