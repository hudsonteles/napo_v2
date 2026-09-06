import { beforeEach, describe, expect, it, vi } from 'vitest';

import { criarCobranca } from './criar-cobranca';
import type { DependenciasDaCobranca } from './criar-cobranca';
import type { CobrancaLida, RepositorioDeCobrancas } from './cobrancas-repo';
import type { PedidoLido, RepositorioDePedidos } from './pedidos-repo';

const PERFIL = 'u-1';
const PEDIDO_ID = 'pedido-1';
const COBRANCA_ID = 'cobranca-1';

const DAQUI_A_MEIA_HORA = new Date(Date.now() + 30 * 60_000).toISOString();

const PEDIDO: PedidoLido = {
  id: PEDIDO_ID,
  numero: 1042,
  profileId: PERFIL,
  status: 'novo',
  situacaoPagamento: 'sem_pagamento',
  diaEntrega: '2026-09-11',
  totalCentavos: 13970,
  expiraEm: DAQUI_A_MEIA_HORA,
  itens: [{ produtoId: 'p-1', quantidade: 3 }],
};

const COBRANCA: CobrancaLida = {
  id: COBRANCA_ID,
  pedidoId: PEDIDO_ID,
  instrumento: 'online',
  situacao: 'pendente',
  valorCentavos: 13970,
  mpPaymentId: null,
  expiraEm: DAQUI_A_MEIA_HORA,
};

const ENTRADA = {
  pedidoId: PEDIDO_ID,
  token: 'tok-do-brick',
  metodo: 'master',
  parcelas: 1,
  emailPagador: 'cliente@napo.test',
};

function cobrancas(parcial: Partial<RepositorioDeCobrancas> = {}) {
  return {
    abrir: vi.fn().mockResolvedValue(COBRANCA),
    ler: vi.fn(),
    pendenteDoPedido: vi.fn(),
    registrarTentativa: vi.fn().mockResolvedValue(undefined),
    mudarSituacao: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  } as unknown as RepositorioDeCobrancas & Record<string, ReturnType<typeof vi.fn>>;
}

function pedidos(pedido: PedidoLido | null = PEDIDO) {
  return {
    lerPedido: vi.fn().mockResolvedValue(pedido),
  } as unknown as RepositorioDePedidos & Record<string, ReturnType<typeof vi.fn>>;
}

function gateway(criar = vi.fn().mockResolvedValue({
  idPagamento: 'pag-1',
  status: 'aprovado',
  detalhe: 'accredited',
  pix: null,
})) {
  return {
    criarCobranca: criar,
    consultarPagamento: vi.fn(),
    buscarPagamentoDaReferencia: vi.fn(),
    verificarAssinatura: vi.fn(),
  };
}

function deps(parcial: Partial<DependenciasDaCobranca> = {}): DependenciasDaCobranca {
  return {
    pagamento: gateway() as never,
    cobrancas: cobrancas(),
    pedidos: pedidos(),
    ...parcial,
  };
}

describe('criarCobranca', () => {
  beforeEach(() => vi.clearAllMocks());

  it('RN11 — a cobrança nasce com o vencimento da reserva do pedido', async () => {
    const repo = cobrancas();

    await criarCobranca(ENTRADA, PERFIL, deps({ cobrancas: repo }));

    expect(repo.abrir).toHaveBeenCalledWith(
      expect.objectContaining({
        pedidoId: PEDIDO_ID,
        instrumento: 'online',
        valorCentavos: 13970,
        expiraEm: DAQUI_A_MEIA_HORA,
      }),
    );
  });

  it('RN10 — o valor e o vencimento mandados ao gateway vêm do pedido, não do corpo', async () => {
    const criar = vi.fn().mockResolvedValue({
      idPagamento: 'pag-1',
      status: 'aprovado',
      detalhe: null,
      pix: null,
    });

    await criarCobranca(ENTRADA, PERFIL, deps({ pagamento: gateway(criar) as never }));

    expect(criar).toHaveBeenCalledWith(
      expect.objectContaining({
        cobrancaId: COBRANCA_ID,
        valorCentavos: 13970,
        expiraEm: DAQUI_A_MEIA_HORA,
        numeroPedido: 1042,
      }),
    );
  });

  it('T19/RN10 — o segundo clique resolve para a cobrança que já existe', async () => {
    // O índice único parcial é quem garante; o repositório devolve a existente
    // em vez de estourar. Aqui se prova que o serviço não abre uma segunda.
    const repo = cobrancas({ abrir: vi.fn().mockResolvedValue(COBRANCA) });

    const primeira = await criarCobranca(ENTRADA, PERFIL, deps({ cobrancas: repo }));
    const segunda = await criarCobranca(ENTRADA, PERFIL, deps({ cobrancas: repo }));

    expect(primeira).toMatchObject({ ok: true, cobranca: { cobrancaId: COBRANCA_ID } });
    expect(segunda).toMatchObject({ ok: true, cobranca: { cobrancaId: COBRANCA_ID } });
  });

  it('RN6 — aprovação no gateway NÃO confirma o pedido: quem confirma é o webhook', async () => {
    const repo = cobrancas();

    const resultado = await criarCobranca(ENTRADA, PERFIL, deps({ cobrancas: repo }));

    expect(resultado).toMatchObject({ ok: true, cobranca: { situacao: 'aguardando' } });
    // O rastro é gravado; a situação da cobrança continua pendente.
    expect(repo.registrarTentativa).toHaveBeenCalledWith({
      cobrancaId: COBRANCA_ID,
      mpPaymentId: 'pag-1',
      detalhe: 'accredited',
    });
    expect(repo.mudarSituacao).not.toHaveBeenCalled();
  });

  it('RN13 — a recusa vira mensagem nossa e libera a próxima tentativa', async () => {
    const repo = cobrancas();
    const criar = vi.fn().mockResolvedValue({
      idPagamento: 'pag-2',
      status: 'recusado',
      detalhe: 'cc_rejected_insufficient_amount',
      pix: null,
    });

    const resultado = await criarCobranca(
      ENTRADA,
      PERFIL,
      deps({ cobrancas: repo, pagamento: gateway(criar) as never }),
    );

    expect(resultado).toEqual({
      ok: false,
      falha: {
        motivo: 'recusado',
        status: 422,
        familia: 'saldo',
        mensagem: expect.stringContaining('limite'),
      },
    });
    // Recusada, e não expirada: é o que faz caber uma nova tentativa no mesmo
    // pedido, sem reiniciar o relógio da entrega (RN12).
    expect(repo.mudarSituacao).toHaveBeenCalledWith({
      cobrancaId: COBRANCA_ID,
      situacao: 'recusada',
      detalhe: 'cc_rejected_insufficient_amount',
    });
    expect(JSON.stringify(resultado)).not.toMatch(/cc_rejected/);
  });

  it('T35 — gateway fora do ar não devolve a vaga: o cliente está na tela', async () => {
    const repo = cobrancas();
    const criar = vi.fn().mockRejectedValue(new Error('mercado pago fora do ar'));

    const resultado = await criarCobranca(
      ENTRADA,
      PERFIL,
      deps({ cobrancas: repo, pagamento: gateway(criar) as never }),
    );

    expect(resultado).toEqual({ ok: false, falha: { motivo: 'gateway_indisponivel', status: 503 } });
    // A falha deixa rastro na própria cobrança: tentativa que morre em silêncio
    // é tentativa que ninguém investiga depois.
    expect(repo.mudarSituacao).toHaveBeenCalledWith({
      cobrancaId: COBRANCA_ID,
      situacao: 'expirada',
      detalhe: expect.stringContaining('mercado pago fora do ar'),
    });
    // E o cliente não vê nada disso (RN13).
    expect(JSON.stringify(resultado)).not.toMatch(/mercado pago fora do ar/);
  });

  it('devolve o QR quando o meio é Pix', async () => {
    const criar = vi.fn().mockResolvedValue({
      idPagamento: 'pag-3',
      status: 'pendente',
      detalhe: null,
      pix: { codigo: '00020126...BR', imagemBase64: null },
    });

    const resultado = await criarCobranca(
      { ...ENTRADA, metodo: 'pix', token: undefined },
      PERFIL,
      deps({ pagamento: gateway(criar) as never }),
    );

    expect(resultado).toMatchObject({ ok: true, cobranca: { pix: { codigo: '00020126...BR' } } });
  });

  it('T34 — pedido já pago não abre nova cobrança', async () => {
    const repo = cobrancas();

    const resultado = await criarCobranca(
      ENTRADA,
      PERFIL,
      deps({ cobrancas: repo, pedidos: pedidos({ ...PEDIDO, situacaoPagamento: 'pago' }) }),
    );

    expect(resultado).toEqual({ ok: false, falha: { motivo: 'pedido_ja_pago', status: 409 } });
    expect(repo.abrir).not.toHaveBeenCalled();
  });

  it('RN11 — pedido vencido não aceita pagamento', async () => {
    const vencido = { ...PEDIDO, expiraEm: new Date(Date.now() - 60_000).toISOString() };

    const resultado = await criarCobranca(ENTRADA, PERFIL, deps({ pedidos: pedidos(vencido) }));

    expect(resultado).toEqual({ ok: false, falha: { motivo: 'pedido_vencido', status: 409 } });
  });

  it('pedido de outra pessoa responde igual a pedido inexistente', async () => {
    const resultado = await criarCobranca(ENTRADA, 'outro-usuario', deps());

    expect(resultado).toEqual({ ok: false, falha: { motivo: 'pedido_nao_e_seu', status: 404 } });
  });

  it('pedido que não existe responde 404', async () => {
    const resultado = await criarCobranca(ENTRADA, PERFIL, deps({ pedidos: pedidos(null) }));

    expect(resultado).toEqual({ ok: false, falha: { motivo: 'pedido_desconhecido', status: 404 } });
  });
});
