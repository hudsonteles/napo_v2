import { NextResponse } from 'next/server';

import { ROTA_ENTRAR } from '@/features/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Só POST: sair por GET seria disparado por prefetch e por qualquer imagem
 * apontando para a rota — derrubar a sessão de alguém não pode ser um efeito
 * colateral de navegação.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(ROTA_ENTRAR, new URL(request.url).origin), {
    // 303 força o navegador a trocar o POST por GET no destino.
    status: 303,
  });
}
