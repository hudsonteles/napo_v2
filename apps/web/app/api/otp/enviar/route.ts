import { NextResponse } from 'next/server';
import { z } from 'zod';

import { carregarPerfilDaSessao } from '@/features/auth';
import { emitirCodigo } from '@/features/auth/services/verificacao';
import { ipDaRequisicao } from '@/lib/ip';

export const dynamic = 'force-dynamic';

const corpoSchema = z.object({
  telefone: z.string().min(1).max(30),
  nome: z.string().trim().min(1).max(120),
});

const RECUSA_GENERICA =
  'Não foi possível validar este número nesta conta. Se ele já é seu em outro cadastro, entre por aquele ou fale com a gente.';

function erro(mensagem: string, status: number) {
  return NextResponse.json({ success: false, error: mensagem }, { status });
}

/**
 * Emite o código (RN6-RN9, RN11). Normalização, tetos, gravação e envio são
 * passos de uma transação lógica: separá-los criaria desafio gravado sem
 * mensagem enviada, sem ganho nenhum (design §3.1).
 */
export async function POST(request: Request) {
  const perfil = await carregarPerfilDaSessao();
  if (!perfil) return erro('Entre na sua conta para validar o telefone.', 401);

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return erro('Informe seu nome e um celular válido.', 400);

  const resultado = await emitirCodigo({
    perfilId: perfil.id,
    telefone: corpo.data.telefone,
    nome: corpo.data.nome,
    ip: ipDaRequisicao(request.headers),
  });

  switch (resultado.tipo) {
    case 'enviado':
      return NextResponse.json({
        success: true,
        data: {
          expiraEm: resultado.expiraEm.toISOString(),
          podeReenviarEm: resultado.podeReenviarEm,
        },
      });

    // Erro do próprio usuário sobre o próprio dado: pode ser específico sem
    // vazar nada sobre a base (design §3.1).
    case 'telefone_invalido':
      return erro('Informe um celular com DDD, como (61) 99999-9999.', 400);

    case 'teto':
      return erro(
        'Limite de envios atingido. Tente de novo amanhã ou fale com a gente pelo WhatsApp da loja.',
        429,
      );

    case 'aguarde':
      return erro(`Aguarde ${resultado.segundosRestantes}s para pedir outro código.`, 429);

    case 'falha_envio':
      return erro(
        'Não conseguimos enviar agora. Tente novamente em alguns minutos ou fale com a gente pelo WhatsApp da loja.',
        502,
      );

    default:
      return erro(RECUSA_GENERICA, 400);
  }
}
