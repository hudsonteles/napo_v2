import { NextResponse } from 'next/server';

import { destinoAposLogin, ROTA_ENTRAR } from '@/features/auth';
import { garantirPerfil } from '@/features/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function paraDestino(origem: URL, caminho: string): NextResponse {
  return NextResponse.redirect(new URL(caminho, origem.origin));
}

/**
 * Troca o código PKCE por sessão e decide o destino **no servidor** (RN5).
 *
 * Nada do que chega pela URL influencia papel ou permissão: o único parâmetro
 * lido além do código é `proximo`, e ele passa pela guarda de caminho interno
 * antes de virar redirecionamento (T31).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const proximo = url.searchParams.get('proximo');

  // Cancelar o consentimento no Google não é falha — volta sem acusar erro.
  if (url.searchParams.get('error')) {
    return paraDestino(url, ROTA_ENTRAR);
  }

  if (!code) {
    return paraDestino(url, `${ROTA_ENTRAR}?erro=link-invalido`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return paraDestino(url, `${ROTA_ENTRAR}?erro=link-invalido`);
  }

  const perfil = await garantirPerfil(supabase);

  if (!perfil) {
    return paraDestino(url, `${ROTA_ENTRAR}?erro=perfil-indisponivel`);
  }

  return paraDestino(url, destinoAposLogin(perfil, proximo));
}
