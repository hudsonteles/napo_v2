import { NextResponse } from 'next/server';

import { avaliarPosicao, esquemaEndereco } from '@/features/enderecos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/**
 * Etapa 2 do cadastro: geocodifica, mede e avalia a área **sem gravar** (drift.md).
 *
 * Não devolve id porque não existe linha — a gravação continua sendo o `POST
 * /api/enderecos`, e é lá que a coordenada final é remedida. Aqui o cliente
 * descobre onde a casa acha que ele mora, e quanto custa chegar lá.
 */
export async function POST(request: Request) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = esquemaEndereco.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Endereço inválido.' }, { status: 400 });
  }

  try {
    const posicao = await avaliarPosicao(corpo.data);

    if (!posicao) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível localizar esse endereço.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, data: posicao });
  } catch (erro) {
    console.error('[enderecos/posicao] falha ao avaliar', erro);
    return NextResponse.json(
      { success: false, error: 'Não foi possível calcular a posição agora.' },
      { status: 502 },
    );
  }
}
