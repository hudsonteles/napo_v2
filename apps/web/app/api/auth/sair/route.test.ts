import { beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut } }),
}));

const { POST } = await import('./route');

describe('POST /api/auth/sair (T8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ error: null });
  });

  it('encerra a sessão e devolve para a tela de entrar', async () => {
    const resposta = await POST(new Request('http://localhost/api/auth/sair', { method: 'POST' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(new URL(resposta.headers.get('location') ?? '').pathname).toBe('/entrar');
  });
});
