import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cache = {
  lerCepDoCache: vi.fn(),
  gravarCepNoCache: vi.fn(),
};

vi.mock('./cep-repo', () => cache);

const { buscarCep, normalizarCep, TIMEOUT_PROVEDOR_MS } = await import('./cep');

const VIACEP_OK = {
  cep: '70862-030',
  logradouro: 'SQN 210 Bloco C',
  bairro: 'Asa Norte',
  localidade: 'Brasília',
  uf: 'DF',
};

const BRASILAPI_OK = {
  cep: '70862030',
  street: 'SQN 210 Bloco C',
  neighborhood: 'Asa Norte',
  city: 'Brasília',
  state: 'DF',
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function urlDaChamada(chamada: [unknown, ...unknown[]]): string {
  return String(chamada[0]);
}

describe('normalizarCep', () => {
  it('aceita CEP com e sem máscara', () => {
    expect(normalizarCep('70862-030')).toBe('70862030');
    expect(normalizarCep('70862030')).toBe('70862030');
    expect(normalizarCep(' 70862 030 ')).toBe('70862030');
  });

  it('T8 — recusa o que não tem oito dígitos, antes de qualquer chamada externa', () => {
    expect(normalizarCep('7086203')).toBeNull();
    expect(normalizarCep('708620300')).toBeNull();
    expect(normalizarCep('abcdefgh')).toBeNull();
    expect(normalizarCep('')).toBeNull();
  });
});

describe('buscarCep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.lerCepDoCache.mockResolvedValue(null);
    cache.gravarCepNoCache.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('T1 — CEP do ViaCEP preenche o endereço e vai para o cache', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta(VIACEP_OK));

    const achado = await buscarCep('70862-030');

    expect(achado).toEqual({
      cep: '70862030',
      logradouro: 'SQN 210 Bloco C',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      fonte: 'viacep',
    });
    expect(cache.gravarCepNoCache).toHaveBeenCalledWith(achado);
  });

  it('T1 — o cache responde sem tocar em terceiro na segunda consulta', async () => {
    cache.lerCepDoCache.mockResolvedValue({
      cep: '70862030',
      logradouro: 'SQN 210 Bloco C',
      bairro: 'Asa Norte',
      cidade: 'Brasília',
      uf: 'DF',
      fonte: 'viacep',
    });

    const achado = await buscarCep('70862030');

    expect(achado?.cidade).toBe('Brasília');
    expect(fetch).not.toHaveBeenCalled();
    expect(cache.gravarCepNoCache).not.toHaveBeenCalled();
  });

  it('cai para a BrasilAPI quando o ViaCEP responde erro', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(resposta({ erro: true }))
      .mockResolvedValueOnce(resposta(BRASILAPI_OK));

    const achado = await buscarCep('70862030');

    expect(achado?.fonte).toBe('brasilapi');
    expect(achado?.logradouro).toBe('SQN 210 Bloco C');
  });

  it('cai para a BrasilAPI quando o ViaCEP está fora do ar', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(resposta(BRASILAPI_OK));

    expect((await buscarCep('70862030'))?.fonte).toBe('brasilapi');
  });

  it('T21 — terceiro lento é abortado e a vez passa para o próximo provedor', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new DOMException('The operation was aborted.', 'TimeoutError'))
      .mockResolvedValueOnce(resposta(BRASILAPI_OK));

    expect((await buscarCep('70862030'))?.fonte).toBe('brasilapi');
    expect(TIMEOUT_PROVEDOR_MS).toBeLessThanOrEqual(3000);

    const chamadas = vi.mocked(fetch).mock.calls as [unknown, ...unknown[]][];
    expect(urlDaChamada(chamadas[0] as [unknown, ...unknown[]])).toContain('viacep');
    expect(urlDaChamada(chamadas[1] as [unknown, ...unknown[]])).toContain('brasilapi');
  });

  it('T22 — as duas bases fora do ar devolvem nulo, não exceção', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('fora do ar'))
      .mockRejectedValueOnce(new Error('fora do ar'));

    await expect(buscarCep('70862030')).resolves.toBeNull();
    expect(cache.gravarCepNoCache).not.toHaveBeenCalled();
  });

  it('T9 — CEP ausente nas duas bases devolve nulo', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(resposta({ erro: 'true' }))
      .mockResolvedValueOnce(resposta({ message: 'CEP não encontrado' }, 404));

    await expect(buscarCep('73255901')).resolves.toBeNull();
  });

  it('CEP geral de cidade entra sem logradouro — cidade e UF bastam (RN2)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      resposta({ cep: '73255-900', logradouro: '', bairro: '', localidade: 'Sobradinho', uf: 'DF' }),
    );

    const achado = await buscarCep('73255900');

    expect(achado?.logradouro).toBeNull();
    expect(achado?.cidade).toBe('Sobradinho');
    expect(cache.gravarCepNoCache).toHaveBeenCalled();
  });

  it('resposta sem cidade é descartada — endereço sem cidade não é endereço', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(resposta({ cep: '70862-030', logradouro: 'SQN 210' }))
      .mockResolvedValueOnce(resposta({ message: 'not found' }, 404));

    await expect(buscarCep('70862030')).resolves.toBeNull();
  });

  it('CEP malformado nem chega aos provedores (T8)', async () => {
    await expect(buscarCep('123')).resolves.toBeNull();

    expect(fetch).not.toHaveBeenCalled();
    expect(cache.lerCepDoCache).not.toHaveBeenCalled();
  });
});
