import { beforeEach, describe, expect, it, vi } from 'vitest';

const geo = { geocodificar: vi.fn(), medirDistancia: vi.fn() };
const repo = {
  carregarConfigDeArea: vi.fn(),
  listarAtivos: vi.fn(),
  lerAtivo: vi.fn(),
  contarAtivos: vi.fn(),
  inserir: vi.fn(),
  atualizar: vi.fn(),
  trocarPadrao: vi.fn(),
};

vi.mock('./geocoding', () => geo);
vi.mock('./enderecos-repo', () => repo);

const { atualizarEndereco, criarEndereco, desativarEndereco } = await import('./enderecos');

const PROFILE = '50000000-0000-0000-0000-000000000001';
const COZINHA = { lat: -15.849872, lng: -47.972633 };
const PORTA = { lat: -15.7565, lng: -47.885 };

const CONFIG = {
  origem: COZINHA,
  raioKm: 12,
  freteGratisCentavos: 15_000,
  fatorDistanciaEstimada: 1.35,
  limiteAjustePinM: 300,
  faixas: [
    { kmDe: 0, kmAte: 4, valorCentavos: 600 },
    { kmDe: 4, kmAte: 8, valorCentavos: 1000 },
    { kmDe: 8, kmAte: 12, valorCentavos: 1400 },
  ],
  excecoes: [],
  diasDeEntrega: [5],
};

const ENTRADA = {
  apelido: 'Casa',
  cep: '70862030',
  logradouro: 'SQN 210 Bloco C',
  numero: 's/n',
  complemento: 'Apto 302',
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  uf: 'DF',
  lat: PORTA.lat,
  lng: PORTA.lng,
};

/** O que o insert devolveria — só o que o mapeamento lê. */
const linha = (extra: Record<string, unknown> = {}) => ({
  id: '5e000000-0000-0000-0000-000000000001',
  apelido: 'Casa',
  cep: '70862030',
  logradouro: 'SQN 210 Bloco C',
  numero: 's/n',
  complemento: 'Apto 302',
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  uf: 'DF',
  referencia: null,
  lat: PORTA.lat,
  lng: PORTA.lng,
  lat_geocode: PORTA.lat,
  lng_geocode: PORTA.lng,
  distancia_km: 3.4,
  distancia_estimada: false,
  precisa_conferencia: false,
  atendido: true,
  motivo_nao_atendido: null,
  padrao: true,
  ativo: true,
  ...extra,
});

/** Campos que o serviço mandou gravar. */
const gravado = () => repo.inserir.mock.calls[0]?.[0] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  repo.carregarConfigDeArea.mockResolvedValue(CONFIG);
  repo.contarAtivos.mockResolvedValue(0);
  repo.inserir.mockResolvedValue({ data: linha(), error: null });
  repo.atualizar.mockResolvedValue(linha());
  repo.lerAtivo.mockResolvedValue(linha());
  repo.trocarPadrao.mockResolvedValue(true);
  geo.geocodificar.mockResolvedValue(PORTA);
  geo.medirDistancia.mockResolvedValue({ distanciaKm: 3.4, estimada: false });
});

describe('T3 — o primeiro endereço nasce padrão (RN13)', () => {
  it('marca padrão quando o cliente ainda não tem nenhum', async () => {
    await criarEndereco(ENTRADA, PROFILE);

    expect(gravado().padrao).toBe(true);
  });

  it('o segundo não vira padrão sozinho', async () => {
    repo.contarAtivos.mockResolvedValue(1);

    await criarEndereco(ENTRADA, PROFILE);

    expect(gravado().padrao).toBe(false);
  });

  it('T4 — pedir padrão no segundo passa pela troca que desmarca o anterior', async () => {
    repo.contarAtivos.mockResolvedValue(1);

    await criarEndereco({ ...ENTRADA, padrao: true }, PROFILE);

    expect(repo.trocarPadrao).toHaveBeenCalled();
  });
});

describe('T14 — limite de 10 endereços ativos (RN14)', () => {
  it('recusa o décimo primeiro sem gastar geocodificação', async () => {
    repo.contarAtivos.mockResolvedValue(10);

    await expect(criarEndereco(ENTRADA, PROFILE)).resolves.toEqual({ falha: 'limite-atingido' });
    expect(geo.geocodificar).not.toHaveBeenCalled();
  });
});

describe('T17 — a distância é sempre medida pelo servidor (RN5)', () => {
  it('grava o que a medição devolveu, não o que veio na entrada', async () => {
    geo.medirDistancia.mockResolvedValue({ distanciaKm: 11.2, estimada: false });

    await criarEndereco({ ...ENTRADA, distanciaKm: 0.5 } as never, PROFILE);

    expect(gravado().distancia_km).toBe(11.2);
  });

  it('mede a partir da coordenada FINAL, não da geocodificada (RN6)', async () => {
    const arrastado = { lat: -15.79, lng: -47.9 };

    await criarEndereco({ ...ENTRADA, ...arrastado }, PROFILE);

    expect(geo.medirDistancia).toHaveBeenCalledWith(COZINHA, arrastado, 1.35);
  });
});

describe('T12 e T13 — área congelada no cadastro (RN9, RN10)', () => {
  it('fora do raio grava atendido = false com motivo', async () => {
    geo.medirDistancia.mockResolvedValue({ distanciaKm: 28.6, estimada: false });

    await criarEndereco(ENTRADA, PROFILE);

    expect(gravado().atendido).toBe(false);
    expect(gravado().motivo_nao_atendido).toContain('12');
  });

  it('T13 — bloqueio de CEP recusa endereço dentro do raio, com o motivo cadastrado', async () => {
    repo.carregarConfigDeArea.mockResolvedValue({
      ...CONFIG,
      excecoes: [{ tipo: 'bloqueio', cepPrefixo: '71680', motivo: 'condomínio não autoriza' }],
    });
    geo.medirDistancia.mockResolvedValue({ distanciaKm: 6, estimada: false });

    await criarEndereco({ ...ENTRADA, cep: '71680000' }, PROFILE);

    expect(gravado().atendido).toBe(false);
    expect(gravado().motivo_nao_atendido).toBe('condomínio não autoriza');
  });

  it('T13 — liberação de CEP atende endereço fora do raio', async () => {
    repo.carregarConfigDeArea.mockResolvedValue({
      ...CONFIG,
      excecoes: [{ tipo: 'liberacao', cepPrefixo: '73255', motivo: 'rota semanal passa lá' }],
    });
    geo.medirDistancia.mockResolvedValue({ distanciaKm: 15, estimada: false });

    await criarEndereco({ ...ENTRADA, cep: '73255900' }, PROFILE);

    expect(gravado().atendido).toBe(true);
  });
});

describe('T23 e T24 — o que nunca vira rota de entrega sem conferência', () => {
  it('distância estimada marca o endereço para conferência (RN11)', async () => {
    geo.medirDistancia.mockResolvedValue({ distanciaKm: 18.9, estimada: true });

    await criarEndereco(ENTRADA, PROFILE);

    expect(gravado().distancia_estimada).toBe(true);
    expect(gravado().precisa_conferencia).toBe(true);
  });

  it('pin arrastado além do limite marca para conferência (RN6)', async () => {
    // ~1,2 km ao sul do ponto geocodificado.
    await criarEndereco({ ...ENTRADA, lat: PORTA.lat - 0.0108, lng: PORTA.lng }, PROFILE);

    expect(gravado().precisa_conferencia).toBe(true);
  });

  it('pin ajustado dentro do limite não marca nada', async () => {
    await criarEndereco({ ...ENTRADA, lat: PORTA.lat - 0.0009, lng: PORTA.lng }, PROFILE);

    expect(gravado().precisa_conferencia).toBe(false);
  });

  it('geocodificação sem resultado marca para conferência — pin não é medição', async () => {
    geo.geocodificar.mockResolvedValue(null);

    await criarEndereco(ENTRADA, PROFILE);

    expect(gravado().precisa_conferencia).toBe(true);
    expect(gravado().lat_geocode).toBeNull();
  });

  it('guarda as duas coordenadas — sem elas o deslocamento é irrecuperável', async () => {
    await criarEndereco({ ...ENTRADA, lat: PORTA.lat - 0.01, lng: PORTA.lng }, PROFILE);

    expect(gravado().lat_geocode).toBe(PORTA.lat);
    expect(gravado().lat).toBe(PORTA.lat - 0.01);
  });
});

describe('T20 — uma medição por endereço (RN12)', () => {
  it('editar só o ponto de referência não gasta geocodificação nem rota', async () => {
    await atualizarEndereco('5e000000-0000-0000-0000-000000000001', {
      ...ENTRADA,
      referencia: 'Portaria do bloco C',
    });

    expect(geo.geocodificar).not.toHaveBeenCalled();
    expect(geo.medirDistancia).not.toHaveBeenCalled();
  });

  it('mover o pin remede — a distância mudou de verdade', async () => {
    await atualizarEndereco('5e000000-0000-0000-0000-000000000001', {
      ...ENTRADA,
      lat: -15.8,
      lng: -47.9,
    });

    expect(geo.medirDistancia).toHaveBeenCalled();
  });

  it('endereço alheio não é encontrado (T16)', async () => {
    repo.lerAtivo.mockResolvedValue(null);

    await expect(atualizarEndereco('outro-id', ENTRADA)).resolves.toEqual({
      falha: 'nao-encontrado',
    });
  });
});

describe('T15 — remover é desativar (RN15)', () => {
  it('grava ativo = false e solta o padrão', async () => {
    await desativarEndereco('5e000000-0000-0000-0000-000000000001');

    expect(repo.atualizar).toHaveBeenCalledWith('5e000000-0000-0000-0000-000000000001', {
      ativo: false,
      padrao: false,
    });
  });
});
