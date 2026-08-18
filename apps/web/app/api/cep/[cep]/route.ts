import { NextResponse } from 'next/server';

import { carregarPerfilDaSessao } from '@/features/auth';
import { buscarCep } from '@/features/enderecos/services/cep';

/**
 * Consulta de CEP para o cadastro de endereço (RN2).
 *
 * Falha de terceiro **nunca** sobe como falha do cadastro: CEP ausente é 404 com
 * `podeDigitarManual`, e o formulário abre os campos. O 500 fica reservado para
 * defeito nosso.
 *
 * Exige sessão com telefone validado — sem isso a rota seria um proxy gratuito
 * de CEP escrevendo na nossa tabela de cache.
 */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ cep: string }> }) {
  const perfil = await carregarPerfilDaSessao();

  if (!perfil) {
    return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
  }

  if (!perfil.telefoneValidado) {
    return NextResponse.json(
      { success: false, error: 'Telefone ainda não validado.' },
      { status: 403 },
    );
  }

  const { cep } = await params;

  // A validação de formato acontece antes de qualquer rede (T8). O regex aceita
  // a máscara porque a URL vem do que o cliente digitou.
  if (!/^[0-9]{5}-?[0-9]{3}$/.test(cep.trim())) {
    return NextResponse.json({ success: false, error: 'CEP inválido.' }, { status: 400 });
  }

  try {
    const achado = await buscarCep(cep);

    if (!achado) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não encontramos esse CEP nas bases públicas.',
          data: { podeDigitarManual: true },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: achado });
  } catch (erro) {
    console.error('[cep] falha ao consultar', erro);
    return NextResponse.json(
      { success: false, error: 'Não foi possível consultar o CEP agora.' },
      { status: 502 },
    );
  }
}
