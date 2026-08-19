import { NextResponse } from 'next/server';
import { z } from 'zod';

import { calcularFreteDoEndereco } from '@/features/enderecos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

// Só id e subtotal. Distância e faixa vêm do banco — é o que impede o cliente de
// escolher o próprio frete (RN5).
const corpoFrete = z.object({
  enderecoId: z.string().uuid(),
  subtotalCentavos: z.number().int().min(0),
});

/** Contrato que o checkout do NAPO-006 consome — por isso nasce aqui, e não lá. */
export async function POST(request: Request) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = corpoFrete.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Requisição inválida.' }, { status: 400 });
  }

  const frete = await calcularFreteDoEndereco(corpo.data.enderecoId, corpo.data.subtotalCentavos);

  if (!frete) {
    return NextResponse.json(
      { success: false, error: 'Endereço não encontrado.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: frete });
}
