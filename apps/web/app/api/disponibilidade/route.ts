import { NextResponse } from 'next/server';

import { calcularDisponibilidade } from '@napo/core';

import { carregarSnapshot, produtosDaQuery } from '@/features/disponibilidade';

/**
 * Disponibilidade nunca vem de cache (RN10) — exceção declarada ao SSG de
 * `ARCHITECTURE.md` §4.5. Servir este número de cache é a definição de vender
 * o que não existe: a página do catálogo continua estática, só o dado é vivo.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const produtos = produtosDaQuery(searchParams.get('produtos'), searchParams.get('massas'));

  try {
    const snapshot = await carregarSnapshot(produtos);
    const dias = calcularDisponibilidade(snapshot);

    return NextResponse.json({
      success: true,
      // Agregado apenas: lote e validade são informação de operação e não
      // atravessam esta fronteira (design.md §5).
      data: {
        dias: dias.map((dia) => ({
          data: dia.data,
          cutoff: dia.cutoff.toISOString(),
          modo: dia.modo,
          produtos: dia.produtos,
        })),
      },
    });
  } catch (erro) {
    console.error('[disponibilidade] falha ao calcular', erro);
    return NextResponse.json(
      { success: false, error: 'Não foi possível calcular a disponibilidade.' },
      { status: 500 },
    );
  }
}
