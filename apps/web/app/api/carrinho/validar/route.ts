import { NextResponse } from 'next/server';

import { aplicarTetos, calcularDisponibilidade, normalizarItens, resolverDiaDoPedido } from '@napo/core';

import { lerCatalogo } from '@/features/catalogo';
import { carregarSnapshot } from '@/features/disponibilidade';
import { esquemaValidarCarrinho } from '@/features/pedidos';

export const dynamic = 'force-dynamic';

/**
 * Revalida preço e disponibilidade do carrinho (RN1, RN3).
 *
 * **Sem sessão de propósito:** o carrinho é anônimo, e exigir login para ver o
 * próprio carrinho é o pedágio que a RN1 existe para não cobrar. Nada aqui
 * escreve; o que sai são os números atuais do banco.
 */
export async function POST(request: Request) {
  const corpo = esquemaValidarCarrinho.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  const itens = normalizarItens(corpo.data.itens);
  const { produtos } = await lerCatalogo();
  const doCatalogo = new Map(produtos.map((item) => [item.produto.id, item]));

  const encontrados = itens.filter((item) => doCatalogo.has(item.produtoId));
  const foraDoCatalogo = itens
    .filter((item) => !doCatalogo.has(item.produtoId))
    .map((item) => item.produtoId);

  if (encontrados.length === 0) {
    return NextResponse.json({
      success: true,
      data: { itens: [], ajustes: [], bloqueado: foraDoCatalogo.length > 0, dia: null, foraDoCatalogo },
    });
  }

  const snapshot = await carregarSnapshot(
    encontrados.map((item) => ({
      id: item.produtoId,
      ehMassa: doCatalogo.get(item.produtoId)?.categoria.ehMassa ?? false,
    })),
  );

  const dias = calcularDisponibilidade(snapshot);
  const dia = resolverDiaDoPedido(encontrados, dias);
  const doDiaEscolhido = dias.find((d) => d.data === dia?.data)?.produtos ?? [];

  const precificados = encontrados.map((item) => {
    const doCatalogoItem = doCatalogo.get(item.produtoId);
    return {
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      nome: doCatalogoItem?.produto.nome ?? '',
      precoUnitarioCentavos: doCatalogoItem?.precoEfetivoCentavos ?? 0,
      disponivel: doDiaEscolhido.find((p) => p.produtoId === item.produtoId)?.disponivel ?? 0,
    };
  });

  const ajustado = aplicarTetos(precificados);

  return NextResponse.json({
    success: true,
    data: {
      itens: ajustado.itens,
      ajustes: ajustado.ajustes,
      // Produto que saiu do catálogo também trava o avanço: seguir calado
      // cobraria por uma sacola diferente da que a pessoa montou.
      bloqueado: ajustado.bloqueado || foraDoCatalogo.length > 0,
      dia,
      foraDoCatalogo,
    },
  });
}
