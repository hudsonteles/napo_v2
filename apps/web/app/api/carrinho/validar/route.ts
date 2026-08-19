import { NextResponse } from 'next/server';

import { revalidarCarrinho, validarCarrinhoSchema } from '@/features/pedidos';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/carrinho/validar` — devolve preço e disponibilidade atuais dos ids
 * enviados. **Sem sessão** (RN1): o carrinho é anônimo, e revalidar é o servidor
 * DIZENDO o preço, nunca recebendo. A tela usa isto para bloquear o avanço
 * quando um item esgotou (RN2) ou o preço mudou (RN3) — sempre com reconfirmação
 * explícita, nunca em silêncio.
 */
export async function POST(request: Request) {
  const corpo = validarCarrinhoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  const { itens, dia } = await revalidarCarrinho(corpo.data.itens);

  return NextResponse.json({
    success: true,
    data: {
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        nome: i.nome,
        quantidade: i.quantidade,
        precoUnitarioCentavos: i.precoUnitarioCentavos,
        disponivel: i.disponivel,
        esgotado: i.disponivel <= 0,
      })),
      dia,
    },
  });
}
