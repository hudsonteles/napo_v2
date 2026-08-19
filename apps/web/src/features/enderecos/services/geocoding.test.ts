import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { geocodificar, medirDistancia, montarEnderecoParaBusca } = await import('./geocoding');

const COZINHA = { lat: -15.849872, lng: -47.972633 };
const DESTINO = { lat: -15.7565, lng: -47.885 };

const ENDERECO = {
  logradouro: 'SQN 210 Bloco C',
  numero: '302',
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  uf: 'DF',
  cep: '70862030',
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('montarEnderecoParaBusca (RN4)', () => {
  it('inclui o número: o CEP devolve o meio da rua, o número devolve a porta', () => {
    expect(montarEnderecoParaBusca(ENDERECO)).toBe(
      'SQN 210 Bloco C, 302, Asa Norte, Brasília - DF, 70862030',
    );
  });

  it('omite "s/n" — não é número, é a ausência dele', () => {
    expect(montarEnderecoParaBusca({ ...ENDERECO, numero: 's/n' })).toBe(
      'SQN 210 Bloco C, Asa Norte, Brasília - DF, 70862030',
    );
  });

  it('sobrevive a bairro ausente', () => {
    expect(montarEnderecoParaBusca({ ...ENDERECO, bairro: null })).toBe(
      'SQN 210 Bloco C, 302, Brasília - DF, 70862030',
    );
  });
});

describe('geocodificar', () => {
  it('devolve a coordenada do primeiro resultado', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      resposta({ status: 'OK', results: [{ geometry: { location: { lat: -15.7565, lng: -47.885 } } }] }),
    );

    await expect(geocodificar(ENDERECO)).resolves.toEqual(DESTINO);
  });

  it('restringe a busca ao Brasil — "Brasília" existe em outros países', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      resposta({ status: 'OK', results: [{ geometry: { location: { lat: -15.7, lng: -47.8 } } }] }),
    );

    await geocodificar(ENDERECO);

    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('country%3ABR');
  });

  it('endereço não encontrado devolve nulo — o pin abre no centro da cidade', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta({ status: 'ZERO_RESULTS', results: [] }));

    await expect(geocodificar(ENDERECO)).resolves.toBeNull();
  });

  it('cota estourada devolve nulo em vez de derrubar o cadastro', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta({ status: 'OVER_QUERY_LIMIT', results: [] }));

    await expect(geocodificar(ENDERECO)).resolves.toBeNull();
  });

  it('API fora do ar devolve nulo, não exceção', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(geocodificar(ENDERECO)).resolves.toBeNull();
  });
});

describe('medirDistancia (RN5, RN11)', () => {
  it('usa a rota rodoviária quando a API responde', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta({ routes: [{ distanceMeters: 11_240 }] }));

    await expect(medirDistancia(COZINHA, DESTINO, 1.35)).resolves.toEqual({
      distanciaKm: 11.24,
      estimada: false,
    });
  });

  it('pede modo de direção — a pizza não vai a pé', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta({ routes: [{ distanceMeters: 1000 }] }));

    await medirDistancia(COZINHA, DESTINO, 1.35);

    const corpo = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(corpo.travelMode).toBe('DRIVE');
  });

  it('T23 — rota indisponível cai para a linha reta multiplicada pelo fator, marcada', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('rotas fora do ar'));

    const medida = await medirDistancia(COZINHA, DESTINO, 1.35);

    expect(medida.estimada).toBe(true);
    // Linha reta Guará → Asa Norte ≈ 14,0 km; × 1,35 ≈ 18,9 km.
    expect(medida.distanciaKm).toBeGreaterThan(18);
    expect(medida.distanciaKm).toBeLessThan(20);
  });

  it('T23 — resposta sem rota também vira estimativa marcada, nunca zero', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta({ routes: [] }));

    const medida = await medirDistancia(COZINHA, DESTINO, 1.35);

    expect(medida.estimada).toBe(true);
    expect(medida.distanciaKm).toBeGreaterThan(0);
  });

  it('o fator vem de fora — a estimativa acompanha a configuração', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fora do ar'));

    const comFatorBaixo = await medirDistancia(COZINHA, DESTINO, 1.3);
    const comFatorAlto = await medirDistancia(COZINHA, DESTINO, 1.4);

    expect(comFatorAlto.distanciaKm).toBeGreaterThan(comFatorBaixo.distanciaKm);
  });

  it('a chave vai no cabeçalho, nunca na query da rota', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(resposta({ routes: [{ distanceMeters: 1000 }] }));

    await medirDistancia(COZINHA, DESTINO, 1.35);

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).not.toContain('key=');
    expect((init?.headers as Record<string, string>)['X-Goog-Api-Key']).toBeTruthy();
  });
});
