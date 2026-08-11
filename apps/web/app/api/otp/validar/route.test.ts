import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const carregarPerfilDaSessao = vi.fn();
const registrarConsentimentos = vi.fn();

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
vi.mock('@/features/auth/services/consentimento', () => ({ registrarConsentimentos }));

const { POST } = await import('./route');

const PERFIL = {
  id: '00000000-0000-0000-0000-0000000000aa',
  papel: 'cliente' as const,
  telefoneValidado: false,
};

const TELEFONE = '+5561991504477';
const CODIGO = '472913';

function hashDe(codigo: string): string {
  return createHmac('sha256', 'pimenta-de-teste').update(`${TELEFONE}:${codigo}`).digest('hex');
}

function desafio(parcial: Record<string, unknown> = {}) {
  return {
    id: 'desafio-1',
    telefone: TELEFONE,
    codigoHash: hashDe(CODIGO),
    tentativas: 0,
    expiraEm: new Date('2026-08-11T12:10:00Z'),
    validadoEm: null,
    criadoEm: new Date('2026-08-11T12:00:00Z'),
    ...parcial,
  };
}

function requisicao(corpo: unknown) {
  return new Request('http://localhost/api/otp/validar', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(corpo),
  });
}

const CORPO = { codigo: CODIGO, aceiteTermos: true, aceiteMarketing: false };

describe('POST /api/otp/validar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-08-11T12:05:00Z'));
    carregarPerfilDaSessao.mockResolvedValue(PERFIL);
    repo.ultimoDesafioDoPerfil.mockResolvedValue(desafio());
    repo.marcarTelefoneValidado.mockResolvedValue({ conflito: false });
    registrarConsentimentos.mockResolvedValue(undefined);
  });

  it('T3 — código correto valida o telefone e leva para a conta', async () => {
    const resposta = await POST(requisicao(CORPO));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(repo.marcarTelefoneValidado).toHaveBeenCalledWith(PERFIL.id, TELEFONE);
    expect(repo.concluirDesafio).toHaveBeenCalledWith('desafio-1');
    expect(corpo.data.destino).toBe('/conta');
  });

  it('T36 — consentimento é gravado antes da conclusão, com IP e opção de marketing', async () => {
    await POST(requisicao({ ...CORPO, aceiteMarketing: true }));

    expect(registrarConsentimentos).toHaveBeenCalledWith({
      perfilId: PERFIL.id,
      ip: '203.0.113.7',
      marketing: true,
    });
    expect(registrarConsentimentos.mock.invocationCallOrder[0]).toBeLessThan(
      repo.marcarTelefoneValidado.mock.invocationCallOrder[0] as number,
    );
  });

  it('T16 — código errado informa quantas tentativas restam e conta a tentativa', async () => {
    const resposta = await POST(requisicao({ ...CORPO, codigo: '000000' }));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(400);
    expect(corpo.error).toContain('4');
    expect(repo.registrarTentativa).toHaveBeenCalledWith('desafio-1', 1);
    expect(repo.marcarTelefoneValidado).not.toHaveBeenCalled();
  });

  it('T13/T17 — código expirado e código já usado recebem 410 sem alterar o perfil', async () => {
    repo.ultimoDesafioDoPerfil.mockResolvedValue(
      desafio({ expiraEm: new Date('2026-08-11T12:04:00Z') }),
    );
    expect((await POST(requisicao(CORPO))).status).toBe(410);

    repo.ultimoDesafioDoPerfil.mockResolvedValue(
      desafio({ validadoEm: new Date('2026-08-11T12:03:00Z') }),
    );
    expect((await POST(requisicao(CORPO))).status).toBe(410);

    repo.ultimoDesafioDoPerfil.mockResolvedValue(desafio({ tentativas: 5 }));
    expect((await POST(requisicao(CORPO))).status).toBe(410);

    expect(repo.marcarTelefoneValidado).not.toHaveBeenCalled();
  });

  it('T18 — sem aceite dos termos não conclui nem grava consentimento', async () => {
    const resposta = await POST(requisicao({ ...CORPO, aceiteTermos: false }));

    expect(resposta.status).toBe(400);
    expect(repo.marcarTelefoneValidado).not.toHaveBeenCalled();
    expect(registrarConsentimentos).not.toHaveBeenCalled();
    expect(repo.registrarTentativa).not.toHaveBeenCalled();
  });

  it('T44 — corrida perdida na unicidade devolve 409', async () => {
    repo.marcarTelefoneValidado.mockResolvedValue({ conflito: true });

    const resposta = await POST(requisicao(CORPO));

    expect(resposta.status).toBe(409);
    expect(repo.concluirDesafio).not.toHaveBeenCalled();
  });

  it('sem desafio ativo devolve 410', async () => {
    repo.ultimoDesafioDoPerfil.mockResolvedValue(null);

    expect((await POST(requisicao(CORPO))).status).toBe(410);
  });

  it('T5/T24 — equipe validando o telefone volta para o painel', async () => {
    carregarPerfilDaSessao.mockResolvedValue({ ...PERFIL, papel: 'gerente' });

    const corpo = await (await POST(requisicao(CORPO))).json();

    expect(corpo.data.destino).toBe('/admin');
  });
});
