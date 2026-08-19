import { NextResponse } from 'next/server';

import { atualizarEndereco, desativarEndereco, esquemaEndereco } from '@/features/enderecos';
import { exigirClienteValidado } from '@/lib/guarda-api';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

// Endereço de outro cliente é "não encontrado", nunca "proibido" (RN1): 403
// confirmaria que o id existe, e a RLS já devolve linha nenhuma.
const naoEncontrado = () =>
  NextResponse.json({ success: false, error: 'Endereço não encontrado.' }, { status: 404 });

export async function PATCH(request: Request, { params }: Contexto) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const corpo = esquemaEndereco.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Endereço inválido.' }, { status: 400 });
  }

  const { id } = await params;
  const resultado = await atualizarEndereco(id, corpo.data);

  if ('falha' in resultado) return naoEncontrado();

  return NextResponse.json({ success: true, data: resultado.endereco });
}

export async function DELETE(_request: Request, { params }: Contexto) {
  const guarda = await exigirClienteValidado();
  if ('resposta' in guarda) return guarda.resposta;

  const { id } = await params;

  return (await desativarEndereco(id))
    ? NextResponse.json({ success: true, data: { desativado: true } })
    : naoEncontrado();
}
