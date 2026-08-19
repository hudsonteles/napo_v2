import { beforeEach, describe, expect, it, vi } from 'vitest';

const carregarPerfilDaSessao = vi.fn();

const feature = {
  criarEndereco: vi.fn(),
  listarEnderecos: vi.fn(),
  atualizarEndereco: vi.fn(),
  desativarEndereco: vi.fn(),
  definirPadrao: vi.fn(),
  calcularFreteDoEndereco: vi.fn(),
  avaliarPosicao: vi.fn(),
  medirPosicao: vi.fn(),
  MAX_ENDERECOS_ATIVOS: 10,
};

vi.mock('@/features/auth', () => ({ carregarPerfilDaSessao }));
// O schema entra real, não mockado: é ele que a rota usa para recusar corpo
// inválido, e mocká-lo transformaria o teste de validação em teste de mock.
vi.mock('@/features/enderecos', async () => ({
  ...feature,
  esquemaEndereco: (await vi.importActual<typeof import('@/features/enderecos/schema')>(
    '@/features/enderecos/schema',
  )).esquemaEndereco,
}));

const { GET, POST } = await import('./route');
const { PATCH, DELETE } = await import('./[id]/route');
const { POST: TORNAR_PADRAO } = await import('./[id]/padrao/route');
const { POST: FRETE } = await import('../frete/route');
const { POST: POSICAO } = await import('./posicao/route');
const { POST: MEDIDA } = await import('./medida/route');

const PERFIL = {
  id: '50000000-0000-0000-0000-000000000001',
  papel: 'cliente' as const,
  telefoneValidado: true,
};

const ID = '5e000000-0000-0000-0000-000000000001';

const CORPO = {
  apelido: 'Casa',
  cep: '70862030',
  logradouro: 'SQN 210 Bloco C',
  numero: 's/n',
  complemento: 'Apto 302',
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  uf: 'DF',
  lat: -15.7565,
  lng: -47.885,
};

const ENDERECO = {
  id: ID,
  ...CORPO,
  referencia: null,
  distanciaKm: 3.4,
  distanciaEstimada: false,
  precisaConferencia: false,
  atendido: true,
  motivoNaoAtendido: null,
  padrao: true,
};

const requisicao = (corpo: unknown, url = 'http://localhost/api/enderecos') =>
  new Request(url, { method: 'POST', body: JSON.stringify(corpo) });

const contexto = (id = ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  carregarPerfilDaSessao.mockResolvedValue(PERFIL);
  feature.listarEnderecos.mockResolvedValue([ENDERECO]);
  feature.criarEndereco.mockResolvedValue({ endereco: ENDERECO });
  feature.atualizarEndereco.mockResolvedValue({ endereco: ENDERECO });
  feature.desativarEndereco.mockResolvedValue(true);
  feature.definirPadrao.mockResolvedValue(true);
});

describe('POST /api/enderecos', () => {
  it('T2 — cria o endereço e devolve distância e área medidas pelo servidor', async () => {
    const resposta = await POST(requisicao(CORPO));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(201);
    expect(corpo.data.distanciaKm).toBe(3.4);
    expect(feature.criarEndereco).toHaveBeenCalledWith(expect.anything(), PERFIL.id);
  });

  it('T17 — distância enviada pelo cliente é ignorada, não aceita', async () => {
    await POST(requisicao({ ...CORPO, distancia_km: 0.5, distanciaKm: 0.5, atendido: true }));

    const entrada = feature.criarEndereco.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(entrada).not.toHaveProperty('distancia_km');
    expect(entrada).not.toHaveProperty('distanciaKm');
    expect(entrada).not.toHaveProperty('atendido');
  });

  it('T10 — número "s/n" é aceito: endereço de quadra não tem número', async () => {
    expect((await POST(requisicao({ ...CORPO, numero: 's/n' }))).status).toBe(201);
  });

  it('T14 — décimo primeiro endereço é recusado com orientação, não com erro genérico', async () => {
    feature.criarEndereco.mockResolvedValue({ falha: 'limite-atingido' });

    const resposta = await POST(requisicao(CORPO));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(409);
    expect(corpo.error).toContain('Desative');
  });

  it('corpo inválido é recusado antes de tocar no serviço', async () => {
    const resposta = await POST(requisicao({ ...CORPO, cep: '708' }));

    expect(resposta.status).toBe(400);
    expect(feature.criarEndereco).not.toHaveBeenCalled();
  });

  it('exige sessão com telefone validado', async () => {
    carregarPerfilDaSessao.mockResolvedValue(null);
    expect((await POST(requisicao(CORPO))).status).toBe(401);

    carregarPerfilDaSessao.mockResolvedValue({ ...PERFIL, telefoneValidado: false });
    expect((await POST(requisicao(CORPO))).status).toBe(403);

    expect(feature.criarEndereco).not.toHaveBeenCalled();
  });
});

describe('GET /api/enderecos', () => {
  it('T5 — lista os ativos do dono', async () => {
    const corpo = await (await GET()).json();

    expect(corpo.data.enderecos).toHaveLength(1);
  });
});

describe('PATCH e DELETE /api/enderecos/[id]', () => {
  it('T20 — editar campo textual passa pelo serviço, que decide se remede', async () => {
    const resposta = await PATCH(requisicao({ ...CORPO, referencia: 'Portaria do bloco C' }), contexto());

    expect(resposta.status).toBe(200);
    expect(feature.atualizarEndereco).toHaveBeenCalledWith(ID, expect.anything());
  });

  it('T16 — id de outro cliente responde "não encontrado", nunca "proibido"', async () => {
    feature.atualizarEndereco.mockResolvedValue({ falha: 'nao-encontrado' });

    expect((await PATCH(requisicao(CORPO), contexto())).status).toBe(404);
  });

  it('T15 — remover é desativar', async () => {
    const resposta = await DELETE(new Request('http://localhost'), contexto());

    expect(resposta.status).toBe(200);
    expect(feature.desativarEndereco).toHaveBeenCalledWith(ID);
  });

  it('T16 — desativar endereço alheio também é 404', async () => {
    feature.desativarEndereco.mockResolvedValue(false);

    expect((await DELETE(new Request('http://localhost'), contexto())).status).toBe(404);
  });
});

describe('POST /api/enderecos/[id]/padrao', () => {
  it('T4 — trocar o padrão passa pela operação que desmarca o anterior', async () => {
    const resposta = await TORNAR_PADRAO(new Request('http://localhost'), contexto());

    expect(resposta.status).toBe(200);
    expect(feature.definirPadrao).toHaveBeenCalledWith(ID);
  });
});

describe('POST /api/frete', () => {
  const pedirFrete = (corpo: unknown) =>
    FRETE(requisicao(corpo, 'http://localhost/api/frete'));

  it('T6 — devolve o frete calculado a partir do endereço gravado', async () => {
    feature.calcularFreteDoEndereco.mockResolvedValue({
      freteCentavos: 0,
      gratis: true,
      faixa: { kmDe: 8, kmAte: 12, valorCentavos: 1400 },
      foraDeArea: false,
      motivo: null,
    });

    const corpo = await (await pedirFrete({ enderecoId: ID, subtotalCentavos: 15_000 })).json();

    expect(corpo.data.gratis).toBe(true);
    expect(corpo.data.freteCentavos).toBe(0);
  });

  it('T17 — o corpo não aceita distância: só id e subtotal', async () => {
    feature.calcularFreteDoEndereco.mockResolvedValue({
      freteCentavos: 1400,
      gratis: false,
      faixa: null,
      foraDeArea: false,
      motivo: null,
    });

    await pedirFrete({ enderecoId: ID, subtotalCentavos: 5_000, distanciaKm: 0.5 });

    expect(feature.calcularFreteDoEndereco).toHaveBeenCalledWith(ID, 5_000);
  });

  it('T12 — endereço fora de área não devolve frete zero', async () => {
    feature.calcularFreteDoEndereco.mockResolvedValue({
      freteCentavos: null,
      gratis: false,
      faixa: null,
      foraDeArea: true,
      motivo: 'Fora do raio de 12 km — o endereço fica a 28.6 km.',
    });

    const corpo = await (await pedirFrete({ enderecoId: ID, subtotalCentavos: 20_000 })).json();

    expect(corpo.data.foraDeArea).toBe(true);
    expect(corpo.data.freteCentavos).toBeNull();
  });

  it('T16 — endereço de outro cliente é 404', async () => {
    feature.calcularFreteDoEndereco.mockResolvedValue(null);

    expect((await pedirFrete({ enderecoId: ID, subtotalCentavos: 5_000 })).status).toBe(404);
  });

  it('subtotal negativo é recusado', async () => {
    expect((await pedirFrete({ enderecoId: ID, subtotalCentavos: -1 })).status).toBe(400);
  });
});


describe('POST /api/enderecos/posicao — etapa 2 (drift.md)', () => {
  const POSICAO_OK = {
    geocodificada: { lat: -15.7565, lng: -47.885 },
    final: { lat: -15.7565, lng: -47.885 },
    distanciaKm: 3.4,
    distanciaEstimada: false,
    precisaConferencia: false,
    atendido: true,
    motivoNaoAtendido: null,
    frete: {
      freteCentavos: 600,
      gratis: false,
      faixa: { kmDe: 0, kmAte: 4, valorCentavos: 600 },
      foraDeArea: false,
      motivo: null,
    },
  };

  const pedirPosicao = (corpo: unknown) =>
    POSICAO(requisicao(corpo, 'http://localhost/api/enderecos/posicao'));

  it('T28 — devolve distância, área e frete sem gravar nada', async () => {
    feature.avaliarPosicao.mockResolvedValue(POSICAO_OK);

    const resposta = await pedirPosicao(CORPO);
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.data.distanciaKm).toBe(3.4);
    expect(corpo.data.frete.freteCentavos).toBe(600);
    // Nenhuma linha criada: a gravação continua sendo o POST /api/enderecos.
    expect(feature.criarEndereco).not.toHaveBeenCalled();
    expect(corpo.data).not.toHaveProperty('id');
  });

  it('T29 — devolve o ponto sugerido, que é o que confirmar sem tocar no mapa usa', async () => {
    feature.avaliarPosicao.mockResolvedValue(POSICAO_OK);

    const corpo = await (await pedirPosicao(CORPO)).json();

    expect(corpo.data.final).toEqual(POSICAO_OK.geocodificada);
  });

  it('sem geocodificação, avisa que a posição precisa de conferência', async () => {
    feature.avaliarPosicao.mockResolvedValue({
      ...POSICAO_OK,
      geocodificada: null,
      precisaConferencia: true,
    });

    const corpo = await (await pedirPosicao(CORPO)).json();

    expect(corpo.data.geocodificada).toBeNull();
    expect(corpo.data.precisaConferencia).toBe(true);
  });

  it('geocodificação sem resultado NÃO trava a etapa: abre no centro da cidade', async () => {
    feature.avaliarPosicao.mockResolvedValue({
      ...POSICAO_OK,
      geocodificada: null,
      final: { lat: -15.7939, lng: -47.8828 },
      distanciaKm: 0,
      precisaConferencia: true,
      atendido: false,
      frete: { freteCentavos: null, gratis: false, faixa: null, foraDeArea: true, motivo: null },
    });

    const resposta = await pedirPosicao(CORPO);
    const corpo = await resposta.json();

    // 200, não 4xx: endereço que o Google não acha não é erro de quem digitou.
    expect(resposta.status).toBe(200);
    expect(corpo.data.geocodificada).toBeNull();
    expect(corpo.data.final).toEqual({ lat: -15.7939, lng: -47.8828 });
  });

  it('T17 — o corpo continua sem aceitar distância', async () => {
    feature.avaliarPosicao.mockResolvedValue(POSICAO_OK);

    await pedirPosicao({ ...CORPO, distanciaKm: 0.5 });

    const entrada = feature.avaliarPosicao.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entrada).not.toHaveProperty('distanciaKm');
  });

  it('exige sessão com telefone validado', async () => {
    carregarPerfilDaSessao.mockResolvedValue(null);

    expect((await pedirPosicao(CORPO)).status).toBe(401);
    expect(feature.avaliarPosicao).not.toHaveBeenCalled();
  });
});


describe('POST /api/enderecos/medida — recálculo ao ajustar o mapa', () => {
  const MEDIDA_OK = {
    distanciaKm: 9.1,
    distanciaEstimada: false,
    atendido: true,
    motivoNaoAtendido: null,
    frete: {
      freteCentavos: 1400,
      gratis: false,
      faixa: { kmDe: 8, kmAte: 12, valorCentavos: 1400 },
      foraDeArea: false,
      motivo: null,
    },
  };

  const pedirMedida = (corpo: unknown) =>
    MEDIDA(requisicao(corpo, 'http://localhost/api/enderecos/medida'));

  it('devolve distância e frete da coordenada ajustada', async () => {
    feature.medirPosicao.mockResolvedValue(MEDIDA_OK);

    const corpo = await (await pedirMedida({ ...CORPO, lat: -15.798, lng: -47.892 })).json();

    expect(corpo.data.distanciaKm).toBe(9.1);
    expect(corpo.data.frete.faixa.valorCentavos).toBe(1400);
  });

  it('não devolve marcação de conferência — quem decide isso é o servidor ao salvar (RN6)', async () => {
    feature.medirPosicao.mockResolvedValue(MEDIDA_OK);

    const corpo = await (await pedirMedida(CORPO)).json();

    expect(corpo.data).not.toHaveProperty('precisaConferencia');
    expect(corpo.data).not.toHaveProperty('geocodificada');
  });

  it('sem coordenada não há o que medir', async () => {
    feature.medirPosicao.mockResolvedValue(null);

    expect((await pedirMedida(CORPO)).status).toBe(400);
  });

  it('exige sessão com telefone validado', async () => {
    carregarPerfilDaSessao.mockResolvedValue(null);

    expect((await pedirMedida(CORPO)).status).toBe(401);
    expect(feature.medirPosicao).not.toHaveBeenCalled();
  });
});
