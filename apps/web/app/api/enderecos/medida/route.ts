import { NextResponse } from 'next/server';

import { esquemaEndereco, medirPosicao } from '@/features/enderecos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/**
 * Mede a posição que o cliente está ajustando no mapa (etapa 2).
 *
 * Separada de `/posicao` porque faz metade do trabalho: não geocodifica, só mede
 * a rota até a coordenada escolhida. É o que permite a régua reagir a cada ajuste
 * sem gastar duas chamadas externas por movimento.
 */
export async function POST(request: Request) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = esquemaEndereco.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Endereço inválido.' }, { status: 400 });
  }

  try {
    const medida = await medirPosicao(corpo.data);

    if (!medida) {
      return NextResponse.json(
        { success: false, error: 'Coordenada ausente.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: medida });
  } catch (erro) {
    console.error('[enderecos/medida] falha ao medir', erro);
    return NextResponse.json(
      { success: false, error: 'Não foi possível medir agora.' },
      { status: 502 },
    );
  }
}
