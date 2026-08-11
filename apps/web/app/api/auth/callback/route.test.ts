import { beforeEach, describe, expect, it, vi } from 'vitest';

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const maybeSingle = vi.fn();
const insert = vi.fn();

/** Fake encadeável do PostgREST: `.from().select().eq().maybeSingle()`. */
function fakeSupabase() {
  return {
    auth: { exchangeCodeForSession, getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      insert: (...args: unknown[]) => insert(...args),
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => fakeSupabase(),
}));

const { GET } = await import('./route');

const USUARIO = {
  id: '00000000-0000-0000-0000-0000000000aa',
  email: 'hudson@email.com',
  user_metadata: { full_name: 'Hudson Teles' },
};

function requisicao(query: string) {
  return new Request(`http://localhost/api/auth/callback${query}`);
}

function destinoDe(resposta: Response): string {
  return new URL(resposta.headers.get('location') ?? '').pathname;
}

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: USUARIO } });
    insert.mockResolvedValue({ error: null });
  });

  it('T1/T2 — conta nova nasce cliente e cai no gate de telefone', async () => {
    // Primeira leitura: perfil ainda não existe. Segunda: o recém-criado.
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: USUARIO.id, role: 'cliente', telefone_validado_em: null },
        error: null,
      });

    const resposta = await GET(requisicao('?code=abc'));

    expect(destinoDe(resposta)).toBe('/validar-telefone');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('T28 — papel vindo da URL é ignorado; o perfil é criado sem role', async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { id: USUARIO.id, role: 'cliente', telefone_validado_em: null },
        error: null,
      });

    await GET(requisicao('?code=abc&role=gerente'));

    const gravado = insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(gravado).not.toHaveProperty('role');
  });

  it('T4 — cliente já validado vai direto para a conta', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: USUARIO.id,
        role: 'cliente',
        telefone_validado_em: '2026-08-11T12:00:00Z',
      },
      error: null,
    });

    const resposta = await GET(requisicao('?code=abc'));

    expect(destinoDe(resposta)).toBe('/conta');
    expect(insert).not.toHaveBeenCalled();
  });

  it('T5 — equipe sem telefone validado vai direto para o painel', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: USUARIO.id, role: 'gerente', telefone_validado_em: null },
      error: null,
    });

    const resposta = await GET(requisicao('?code=abc'));

    expect(destinoDe(resposta)).toBe('/admin');
  });

  it('T7 — destino pretendido é preservado', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: USUARIO.id,
        role: 'cliente',
        telefone_validado_em: '2026-08-11T12:00:00Z',
      },
      error: null,
    });

    const resposta = await GET(requisicao('?code=abc&proximo=%2Fconta%2Fpedidos'));

    expect(destinoDe(resposta)).toBe('/conta/pedidos');
  });

  it('T31 — destino externo é trocado pelo destino do papel', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: USUARIO.id,
        role: 'cliente',
        telefone_validado_em: '2026-08-11T12:00:00Z',
      },
      error: null,
    });

    const resposta = await GET(requisicao('?code=abc&proximo=https%3A%2F%2Fsite-falso.com'));

    const destino = new URL(resposta.headers.get('location') ?? '');
    expect(destino.host).toBe('localhost');
    expect(destino.pathname).toBe('/conta');
  });

  it('link expirado volta para entrar com aviso, sem criar perfil', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } });

    const resposta = await GET(requisicao('?code=velho'));

    expect(destinoDe(resposta)).toBe('/entrar');
    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBe(
      'link-invalido',
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('consentimento cancelado no Google volta para entrar sem erro', async () => {
    const resposta = await GET(requisicao('?error=access_denied'));

    expect(destinoDe(resposta)).toBe('/entrar');
    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBeNull();
  });
});
