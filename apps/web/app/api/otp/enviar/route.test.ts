import { beforeEach, describe, expect, it, vi } from 'vitest';

const carregarPerfilDaSessao = vi.fn();
const enviarCodigo = vi.fn();

const repo = {
  contarEnviosPorNumero: vi.fn(),
  contarEnviosPorIp: vi.fn(),
  ultimoDesafioDoPerfil: vi.fn(),
  telefoneValidadoPorOutraConta: vi.fn(),
  gravarDesafio: vi.fn(),
  invalidarDesafio: vi.fn(),
  registrarTentativa: vi.fn(),
  concluirDesafio: vi.fn(),
  atualizarNome: vi.fn(),
  marcarTelefoneValidado: vi.fn(),
};

vi.mock('@/features/auth', () => ({ carregarPerfilDaSessao }));
vi.mock('@/features/auth/services/verificacao-repo', () => repo);
vi.mock('@/lib/otp/remetente', () => ({ remetenteDeCodigo: () => ({ enviarCodigo }) }));

const { POST } = await import('./route');

const PERFIL = {
  id: '00000000-0000-0000-0000-0000000000aa',
  papel: 'cliente' as const,
  telefoneValidado: false,
};

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/otp/enviar', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(corpo),
  });
}

const CORPO = { telefone: '(61) 99150-4477', nome: 'Hudson Teles' };

describe('POST /api/otp/enviar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    carregarPerfilDaSessao.mockResolvedValue(PERFIL);
    repo.contarEnviosPorNumero.mockResolvedValue(0);
    repo.contarEnviosPorIp.mockResolvedValue(0);
    repo.ultimoDesafioDoPerfil.mockResolvedValue(null);
    repo.telefoneValidadoPorOutraConta.mockResolvedValue(false);
    repo.gravarDesafio.mockResolvedValue({
      id: 'desafio-1',
      expiraEm: new Date('2026-08-11T12:10:00Z'),
    });
    repo.atualizarNome.mockResolvedValue(undefined);
    enviarCodigo.mockResolvedValue(undefined);
  });

  it('envia o código e grava o desafio', async () => {
    const resposta = await POST(requisicao(CORPO));

    expect(resposta.status).toBe(200);
    expect(enviarCodigo).toHaveBeenCalledTimes(1);
    expect(enviarCodigo.mock.calls[0]?.[0]).toBe('+5561991504477');
    expect(repo.atualizarNome).toHaveBeenCalledWith(PERFIL.id, 'Hudson Teles');
  });

  it('T37 — o código não aparece na resposta nem é gravado em texto puro', async () => {
    const resposta = await POST(requisicao(CORPO));
    const corpo = await resposta.text();

    const codigo = enviarCodigo.mock.calls[0]?.[1] as string;
    expect(codigo).toMatch(/^\d{6}$/);
    expect(corpo).not.toContain(codigo);

    const gravado = repo.gravarDesafio.mock.calls[0]?.[0] as { codigoHash: string };
    expect(gravado.codigoHash).not.toBe(codigo);
    expect(gravado.codigoHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('T15 — telefone mal formado não grava desafio nem chama o remetente', async () => {
    const resposta = await POST(requisicao({ ...CORPO, telefone: '(61) 3321-4477' }));

    expect(resposta.status).toBe(400);
    expect(repo.gravarDesafio).not.toHaveBeenCalled();
    expect(enviarCodigo).not.toHaveBeenCalled();
  });

  it('T19 — teto de 5 envios por número', async () => {
    repo.contarEnviosPorNumero.mockResolvedValue(5);

    const resposta = await POST(requisicao(CORPO));

    expect(resposta.status).toBe(429);
    expect(enviarCodigo).not.toHaveBeenCalled();
  });

  it('T20 — teto de 10 envios por IP', async () => {
    repo.contarEnviosPorIp.mockResolvedValue(10);

    const resposta = await POST(requisicao(CORPO));

    expect(resposta.status).toBe(429);
    expect(enviarCodigo).not.toHaveBeenCalled();
  });

  it('recusa reenvio antes de 60 segundos', async () => {
    vi.setSystemTime(new Date('2026-08-11T12:00:59Z'));
    repo.ultimoDesafioDoPerfil.mockResolvedValue({
      id: 'desafio-0',
      telefone: '+5561991504477',
      codigoHash: 'x'.repeat(64),
      tentativas: 0,
      expiraEm: new Date('2026-08-11T12:10:00Z'),
      validadoEm: null,
      criadoEm: new Date('2026-08-11T12:00:00Z'),
    });

    const resposta = await POST(requisicao(CORPO));

    expect(resposta.status).toBe(429);
    expect(enviarCodigo).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('T30 — número de outra conta responde como se tivesse enviado', async () => {
    repo.telefoneValidadoPorOutraConta.mockResolvedValue(true);

    const recusa = await POST(requisicao(CORPO));
    const corpoRecusa = await recusa.json();

    repo.telefoneValidadoPorOutraConta.mockResolvedValue(false);
    vi.clearAllMocks();
    carregarPerfilDaSessao.mockResolvedValue(PERFIL);
    repo.contarEnviosPorNumero.mockResolvedValue(0);
    repo.contarEnviosPorIp.mockResolvedValue(0);
    repo.ultimoDesafioDoPerfil.mockResolvedValue(null);
    repo.telefoneValidadoPorOutraConta.mockResolvedValue(false);
    repo.gravarDesafio.mockResolvedValue({
      id: 'desafio-2',
      expiraEm: new Date('2026-08-11T12:10:00Z'),
    });

    const sucesso = await POST(requisicao(CORPO));
    const corpoSucesso = await sucesso.json();

    expect(recusa.status).toBe(sucesso.status);
    expect(corpoRecusa).toEqual(corpoSucesso);
  });

  it('T30 — a tentativa com número de terceiro fica registrada e não é enviada', async () => {
    repo.telefoneValidadoPorOutraConta.mockResolvedValue(true);

    await POST(requisicao(CORPO));

    expect(repo.gravarDesafio).toHaveBeenCalledTimes(1);
    expect(enviarCodigo).not.toHaveBeenCalled();
  });

  it('T43 — falha do provedor devolve 502 e invalida o desafio', async () => {
    enviarCodigo.mockRejectedValue(new Error('meta fora do ar'));

    const resposta = await POST(requisicao(CORPO));

    expect(resposta.status).toBe(502);
    expect(repo.invalidarDesafio).toHaveBeenCalledWith('desafio-1');
    expect(await resposta.text()).not.toContain('meta fora do ar');
  });

  it('sem sessão não emite código', async () => {
    carregarPerfilDaSessao.mockResolvedValue(null);

    const resposta = await POST(requisicao(CORPO));

    expect(resposta.status).toBe(401);
    expect(repo.gravarDesafio).not.toHaveBeenCalled();
  });
});
