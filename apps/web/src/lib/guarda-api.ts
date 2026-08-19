import 'server-only';

import { NextResponse } from 'next/server';

import { carregarPerfilDaSessao, type PerfilSessao } from '@/features/auth';

/**
 * Guarda de Route Handler da área logada.
 *
 * Vive em `lib/` e não numa feature porque duas features precisam dela e feature
 * não importa de feature (ARCHITECTURE §3.2). Devolve o perfil **ou** a resposta
 * pronta — quem chama não decide status nem mensagem, que é como cinco rotas
 * passariam a responder cinco coisas diferentes para a mesma negativa.
 *
 * Middleware protege rota; isto protege endpoint. Um `fetch` direto à API não
 * passa pelo middleware de página.
 */
export async function exigirClienteValidado(): Promise<
  { perfil: PerfilSessao } | { resposta: NextResponse }
> {
  const perfil = await carregarPerfilDaSessao();

  if (!perfil) {
    return {
      resposta: NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 }),
    };
  }

  if (!perfil.telefoneValidado) {
    return {
      resposta: NextResponse.json(
        { success: false, error: 'Telefone ainda não validado.' },
        { status: 403 },
      ),
    };
  }

  return { perfil };
}
