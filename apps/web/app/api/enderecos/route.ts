import { NextResponse } from 'next/server';

import { criarEndereco, esquemaEndereco, listarEnderecos, MAX_ENDERECOS_ATIVOS } from '@/features/enderecos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  return NextResponse.json({ success: true, data: { enderecos: await listarEnderecos() } });
}

export async function POST(request: Request) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = esquemaEndereco.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Endereço inválido.' }, { status: 400 });
  }

  try {
    const resultado = await criarEndereco(corpo.data, guarda.perfil.id);

    if ('falha' in resultado) {
      // Limite atingido é 409, não 400: o pedido está correto, o estado é que não
      // comporta — e a orientação é desativar um endereço, não corrigir o envio.
      if (resultado.falha === 'limite-atingido') {
        return NextResponse.json(
          {
            success: false,
            error: `Você chegou ao limite de ${MAX_ENDERECOS_ATIVOS} endereços. Desative um que não usa mais.`,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { success: false, error: 'Não foi possível salvar o endereço.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: resultado.endereco }, { status: 201 });
  } catch (erro) {
    console.error('[enderecos] falha ao criar', erro);
    return NextResponse.json(
      { success: false, error: 'Não foi possível salvar o endereço.' },
      { status: 500 },
    );
  }
}
