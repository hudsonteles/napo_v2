import { NextResponse } from 'next/server';

import { criarPedido, criarPedidoSchema } from '@/features/pedidos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/pedidos` — revalida, reserva, grava o pedido e cria a cobrança,
 * devolvendo a URL do pagamento (design §3.2). São quatro passos que só têm
 * sentido juntos: expor cada um deixaria o cliente parar no meio com uma vaga
 * reservada e nenhum pedido dono dela.
 *
 * Middleware protege a página; este guarda protege o endpoint — um `fetch`
 * direto não passa pelo middleware de rota (RN5, T20).
 */
export async function POST(request: Request) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = criarPedidoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  const resultado = await criarPedido(corpo.data, guarda.perfil.id);

  if (resultado.ok) {
    return NextResponse.json({
      success: true,
      data: { numero: resultado.numero, urlPagamento: resultado.urlPagamento },
    });
  }

  switch (resultado.erro) {
    case 'carrinho_vazio':
      return NextResponse.json({ success: false, error: 'Carrinho vazio.' }, { status: 400 });
    case 'item_indisponivel':
      return NextResponse.json(
        { success: false, error: 'Um dos itens não está mais disponível.' },
        { status: 409 },
      );
    case 'divergencia_preco':
      return NextResponse.json(
        { success: false, error: 'O preço mudou. Confira e confirme.', divergencias: resultado.divergencias },
        { status: 409 },
      );
    case 'sem_vaga':
      return NextResponse.json(
        { success: false, error: 'Esta fornada encheu enquanto você decidia.', dia: resultado.dia },
        { status: 409 },
      );
    case 'endereco_invalido':
      return NextResponse.json(
        { success: false, error: 'Endereço não encontrado.' },
        { status: 404 },
      );
    case 'fora_de_area':
      return NextResponse.json(
        { success: false, error: 'Ainda não entregamos neste endereço.' },
        { status: 422 },
      );
    case 'gateway_indisponivel':
      return NextResponse.json(
        { success: false, error: 'Pagamento indisponível no momento. Seu carrinho continua aqui.' },
        { status: 503 },
      );
    default:
      return NextResponse.json(
        { success: false, error: 'Não foi possível criar o pedido.' },
        { status: 500 },
      );
  }
}
