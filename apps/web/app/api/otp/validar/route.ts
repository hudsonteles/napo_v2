import { NextResponse } from 'next/server';
import { z } from 'zod';

import { carregarPerfilDaSessao } from '@/features/auth';
import { registrarConsentimentos } from '@/features/auth/services/consentimento';
import { conferirCodigo } from '@/features/auth/services/verificacao';
import { ipDaRequisicao } from '@/lib/ip';

export const dynamic = 'force-dynamic';

const corpoSchema = z.object({
  codigo: z.string().regex(/^\d{6}$/),
  // RN15: aceite é condição para concluir, não um campo opcional. `false` é
  // recusa de entrada — não existe caminho de sucesso silencioso sem aceite.
  aceiteTermos: z.literal(true),
  aceiteMarketing: z.boolean().default(false),
});

function erro(mensagem: string, status: number) {
  return NextResponse.json({ success: false, error: mensagem }, { status });
}

/**
 * Confere o código e conclui o cadastro (RN6, RN9, RN15). Conferência e
 * consentimento vivem no mesmo endpoint de propósito: separá-los abriria a
 * janela de um cadastro concluído sem consentimento gravado.
 */
export async function POST(request: Request) {
  const perfil = await carregarPerfilDaSessao();
  if (!perfil) return erro('Entre na sua conta para validar o telefone.', 401);

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return erro('Digite os 6 dígitos e aceite os termos para concluir.', 400);
  }

  const resultado = await conferirCodigo({
    perfil,
    codigo: corpo.data.codigo,
    ip: ipDaRequisicao(request.headers),
    aceiteMarketing: corpo.data.aceiteMarketing,
    registrarConsentimentos,
  });

  switch (resultado.tipo) {
    case 'validado':
      return NextResponse.json({ success: true, data: { destino: resultado.destino } });

    case 'codigo_incorreto':
      return erro(`Código incorreto. Restam ${resultado.restantes} tentativas.`, 400);

    case 'expirado':
      return erro('Este código expirou. Peça um novo.', 410);

    case 'esgotado':
      return erro('Muitas tentativas. Peça um novo código.', 410);

    case 'ja_validado':
      return erro('Este código já foi usado. Peça um novo.', 410);

    case 'sem_desafio':
      return erro('Nenhum código pendente. Peça um novo.', 410);

    default:
      return erro(
        'Não foi possível validar este número nesta conta. Se ele já é seu em outro cadastro, entre por aquele ou fale com a gente.',
        409,
      );
  }
}
