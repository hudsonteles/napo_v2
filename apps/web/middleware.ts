import { NextResponse, type NextRequest } from 'next/server';

// Import direto do módulo puro, e não do barrel da feature: o barrel reexporta
// os serviços de sessão, que dependem de `next/headers` e não rodam no edge.
import { ROTA_ENTRAR, rotaExigeSessao } from '@/features/auth/destino';
import { atualizarSessao } from '@/lib/supabase/middleware';

/**
 * Middleware protege **rota**; RLS protege **dado** (arquitetura §5.3). Aqui só
 * se verifica se existe sessão — papel e telefone são conferidos no layout de
 * servidor, contra o banco (design §5).
 */
export async function middleware(request: NextRequest) {
  const { resposta, temSessao } = await atualizarSessao(request);
  const { pathname, search } = request.nextUrl;

  if (!temSessao && rotaExigeSessao(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = ROTA_ENTRAR;
    destino.search = '';
    // RN2: o destino pretendido volta depois do login — nunca jogar na home.
    destino.searchParams.set('proximo', `${pathname}${search}`);
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: [
    /*
     * Roda em toda navegação para manter a sessão viva, menos no que não tem
     * sessão a renovar: estáticos do Next, imagens otimizadas, arquivos com
     * extensão e as rotas de API (que criam o próprio client).
     */
    '/((?!_next/static|_next/image|api/|favicon.ico|.*\\..*).*)',
  ],
};
