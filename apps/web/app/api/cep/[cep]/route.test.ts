import { beforeEach, describe, expect, it, vi } from 'vitest';

const carregarPerfilDaSessao = vi.fn();
const buscarCep = vi.fn();

vi.mock('@/features/auth', () => ({ carregarPerfilDaSessao }));
vi.mock('@/features/enderecos/services/cep', () => ({ buscarCep }));

const { GET } = await import('./route');

const PERFIL = {
  id: '00000000-0000-0000-0000-0000000000aa',
  papel: 'cliente' as const,
  telefoneValidado: true,
};

const ACHADO = {
  cep: '70862030',
  logradouro: 'SQN 210 Bloco C',
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  uf: 'DF',
  fonte: 'viacep' as const,
};

function chamar(cep: string) {
  return GET(new Request(`http://localhost/api/cep/${cep}`), {
    params: Promise.resolve({ cep }),
  });
}

describe('GET /api/cep/[cep]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    carregarPerfilDaSessao.mockResolvedValue(PERFIL);
    buscarCep.mockResolvedValue(ACHADO);
  });

  it('T1 — devolve o endereço do CEP encontrado', async () => {
    const resposta = await chamar('70862-030');

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({ success: true, data: ACHADO });
  });

  it('T8 — CEP malformado é recusado sem chamar provedor nenhum', async () => {
    const resposta = await chamar('7086203');

    expect(resposta.status).toBe(400);
    expect(buscarCep).not.toHaveBeenCalled();
  });

  it('T9 — CEP não encontrado devolve 404 liberando a digitação manual', async () => {
    buscarCep.mockResolvedValue(null);

    const resposta = await chamar('73255901');
    const corpo = await resposta.json();

    expect(resposta.status).toBe(404);
    expect(corpo.success).toBe(false);
    expect(corpo.data).toEqual({ podeDigitarManual: true });
  });

  it('T22 — falha das duas bases não vira erro 500: o cadastro segue à mão', async () => {
    buscarCep.mockResolvedValue(null);

    expect((await chamar('70862030')).status).toBe(404);
  });

  it('exige sessão — a rota não é proxy público de CEP', async () => {
    carregarPerfilDaSessao.mockResolvedValue(null);

    const resposta = await chamar('70862030');

    expect(resposta.status).toBe(401);
    expect(buscarCep).not.toHaveBeenCalled();
  });

  it('exige telefone validado, como toda superfície logada do projeto', async () => {
    carregarPerfilDaSessao.mockResolvedValue({ ...PERFIL, telefoneValidado: false });

    expect((await chamar('70862030')).status).toBe(403);
    expect(buscarCep).not.toHaveBeenCalled();
  });

  it('falha inesperada do serviço vira 502, não vazamento de stack', async () => {
    buscarCep.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const resposta = await chamar('70862030');
    const corpo = await resposta.json();

    expect(resposta.status).toBe(502);
    expect(JSON.stringify(corpo)).not.toContain('boom');
  });
});
