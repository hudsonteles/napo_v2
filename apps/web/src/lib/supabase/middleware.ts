import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@napo/db';

import { publicEnv } from '@/lib/env';

/**
 * Renova a sessão a cada navegação e devolve a resposta já com os cookies
 * atualizados. Sem isso o token expira em trânsito e a pessoa é deslogada no
 * meio do fluxo.
 *
 * `getUser()` (e não `getSession()`) porque só ele revalida o token contra o
 * servidor do Supabase — sessão lida do cookie sem verificação é palpite.
 */
export async function atualizarSessao(
  request: NextRequest,
): Promise<{ resposta: NextResponse; temSessao: boolean }> {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          resposta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { resposta, temSessao: user !== null };
}
