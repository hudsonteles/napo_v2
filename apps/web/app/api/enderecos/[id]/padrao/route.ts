import { NextResponse } from 'next/server';

import { definirPadrao } from '@/features/enderecos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

/** Troca de endereço padrão (RN13). Marcar um desmarca o anterior. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const { id } = await params;

  return (await definirPadrao(id))
    ? NextResponse.json({ success: true, data: { padrao: true } })
    : NextResponse.json({ success: false, error: 'Endereço não encontrado.' }, { status: 404 });
}
