import { beforeEach, describe, expect, it, vi } from 'vitest';

const lerCatalogo = vi.fn();
vi.mock('@/features/catalogo', () => ({ lerCatalogo: (...a: unknown[]) => lerCatalogo(...a) }));

const carregarSnapshot = vi.fn();
vi.mock('@/features/disponibilidade', () => ({
  carregarSnapshot: (...a: unknown[]) => carregarSnapshot(...a),
}));

const listarEnderecos = vi.fn();
const calcularFreteDoEndereco = vi.fn();
vi.mock('@/features/enderecos', () => ({
  listarEnderecos: (...a: unknown[]) => listarEnderecos(...a),
  calcularFreteDoEndereco: (...a: unknown[]) => calcularFreteDoEndereco(...a),
}));

const criarCobranca = vi.fn();
vi.mock('@/lib/pagamentos/porta', () => ({ portaPagamento: () => ({ criarCobranca }) }));

const repo = {
  reservarCarrinho: vi.fn(),
  inserirPedido: vi.fn(),
  anexarPreferencia: vi.fn(),
  compensarPedido: vi.fn(),
  lerPagamentoMinutos: vi.fn(),
};
vi.mock('./pedidos-repo', () => repo);

// Núcleo puro real, exceto o cálculo de disponibilidade (que exigiria um
// snapshot completo) e a resolução do dia — controlados aqui como no teste da
// rota de reserva.
const calcularDisponibilidade = vi.fn();
const resolverDiaDoPedido = vi.fn();
vi.mock('@napo/core', async (importActual) => {
  const real = await importActual<typeof import('@napo/core')>();
  return {
    ...real,
    calcularDisponibilidade: (...a: unknown[]) => calcularDisponibilidade(...a),
    resolverDiaDoPedido: (...a: unknown[]) => resolverDiaDoPedido(...a),
  };
});

const { criarPedido } = await import('./criar-pedido');

const PID_A = '00000000-0000-0000-0000-0000000000aa';
const END = '11111111-0000-0000-0000-000000000001';
const PROFILE = '50000000-0000-0000-0000-000000000001';
const DIA = '2026-08-22';

function produtoVitrine(id: string, nome: string, precoCentavos: number) {
  return {
    produto: { id, nome },
    categoria: { ehMassa: false },
    precoEfetivoCentavos: precoCentavos,
  };
}

function enderecoAtendido(extra: Record<string, unknown> = {}) {
  return {
    id: END,
    apelido: 'Casa',
    logradouro: 'SQN 210 Bloco C',
    distanciaKm: 3.2,
    atendido: true,
    ...extra,
  };
}

const FRETE_OK = { freteCentavos: 600, gratis: false, faixa: null, foraDeArea: false, motivo: null };

/** Carrinho de 1 Calabresa a R$ 39,90, 2 unidades, endereço atendido, tudo cabe. */
function cenarioFelizardo() {
  lerCatalogo.mockResolvedValue({ produtos: [produtoVitrine(PID_A, 'Calabresa', 3990)] });
  carregarSnapshot.mockResolvedValue({ consumos: [{ diaEntrega: DIA, produtoId: PID_A, quantidade: 1 }] });
  calcularDisponibilidade.mockReturnValue([{ data: DIA, produtos: [{ produtoId: PID_A, disponivel: 9 }] }]);
  resolverDiaDoPedido.mockReturnValue({ data: DIA, determinadoPor: PID_A });
  listarEnderecos.mockResolvedValue([enderecoAtendido()]);
  calcularFreteDoEndereco.mockResolvedValue(FRETE_OK);
  repo.lerPagamentoMinutos.mockResolvedValue(30);
  repo.reservarCarrinho.mockResolvedValue([
    { id: 'r-1', produtoId: PID_A, quantidade: 2, expiraEm: '2026-08-19T12:30:00Z' },
  ]);
  repo.inserirPedido.mockResolvedValue({ id: 'p-1', numero: 1042 });
  criarCobranca.mockResolvedValue({ preferenceId: 'pref-1', urlPagamento: 'https://mp/pay/1' });
}

const ENTRADA = { itens: [{ produtoId: PID_A, quantidade: 2, precoUnitarioCentavos: 3990 }], enderecoId: END };

describe('criarPedido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolverDiaDoPedido.mockReturnValue(null);
    calcularDisponibilidade.mockReturnValue([]);
  });

  it('caminho felizardo devolve número e URL de pagamento', async () => {
    cenarioFelizardo();
    const r = await criarPedido(ENTRADA, PROFILE);
    expect(r).toEqual({ ok: true, numero: 1042, urlPagamento: 'https://mp/pay/1' });
    expect(repo.anexarPreferencia).toHaveBeenCalledWith('p-1', 'pref-1');
  });

  it('T5 — a reserva nasce antes da cobrança, com o prazo do pagamento (30 min)', async () => {
    cenarioFelizardo();
    await criarPedido(ENTRADA, PROFILE);

    // Ordem: reserva antes de cobrar (RN7).
    expect(repo.reservarCarrinho.mock.invocationCallOrder[0]!).toBeLessThan(
      criarCobranca.mock.invocationCallOrder[0]!,
    );
    // Prazo do pagamento, não o da vitrine.
    expect(repo.reservarCarrinho).toHaveBeenCalledWith(expect.objectContaining({ minutos: 30 }));
    // Mesmo instante entre reserva e pedido.
    expect(repo.inserirPedido).toHaveBeenCalledWith(
      expect.objectContaining({ expiraEm: '2026-08-19T12:30:00Z', reservaId: 'r-1' }),
    );
  });

  it('T5 — o limite da reserva é disponível + ocupadas do dia, não o que sobra', async () => {
    cenarioFelizardo();
    await criarPedido(ENTRADA, PROFILE);
    // 9 disponíveis + 1 ocupada = 10 tolerado no dia.
    expect(repo.reservarCarrinho).toHaveBeenCalledWith(
      expect.objectContaining({ limites: [{ produto_id: PID_A, limite: 10 }] }),
    );
  });

  it('T3 — o pedido congela nome e preço do catálogo atual e o endereço', async () => {
    cenarioFelizardo();
    await criarPedido(ENTRADA, PROFILE);
    const dados = repo.inserirPedido.mock.calls[0]![0];
    expect(dados.itens).toEqual([
      { produtoId: PID_A, nomeSnapshot: 'Calabresa', quantidade: 2, precoUnitarioCentavos: 3990 },
    ]);
    expect(dados.enderecoSnapshot).toMatchObject({ id: END, logradouro: 'SQN 210 Bloco C' });
  });

  it('T19 — frete vem da faixa (do banco) e entra no total', async () => {
    cenarioFelizardo();
    await criarPedido(ENTRADA, PROFILE);
    expect(calcularFreteDoEndereco).toHaveBeenCalledWith(END, 7980);
    expect(repo.inserirPedido).toHaveBeenCalledWith(
      expect.objectContaining({ subtotalCentavos: 7980, freteCentavos: 600, totalCentavos: 8580 }),
    );
  });

  it('T19 — subtotal com frete grátis grava frete zero, total = subtotal', async () => {
    cenarioFelizardo();
    calcularFreteDoEndereco.mockResolvedValue({ ...FRETE_OK, freteCentavos: 0, gratis: true });
    await criarPedido(ENTRADA, PROFILE);
    expect(repo.inserirPedido).toHaveBeenCalledWith(
      expect.objectContaining({ freteCentavos: 0, totalCentavos: 7980 }),
    );
  });

  it('T14 — preço divergente bloqueia com o de/para e não cria reserva nem cobrança', async () => {
    cenarioFelizardo();
    // Cliente viu R$ 37,90; agora custa R$ 39,90.
    const r = await criarPedido(
      { itens: [{ produtoId: PID_A, quantidade: 2, precoUnitarioCentavos: 3790 }], enderecoId: END },
      PROFILE,
    );
    expect(r).toEqual({
      ok: false,
      erro: 'divergencia_preco',
      divergencias: [{ produtoId: PID_A, deCentavos: 3790, paraCentavos: 3990 }],
    });
    expect(repo.reservarCarrinho).not.toHaveBeenCalled();
    expect(criarCobranca).not.toHaveBeenCalled();
  });

  it('T18 — endereço fora de área não fecha pedido e nada é persistido', async () => {
    cenarioFelizardo();
    listarEnderecos.mockResolvedValue([enderecoAtendido({ atendido: false })]);
    const r = await criarPedido(ENTRADA, PROFILE);
    expect(r).toEqual({ ok: false, erro: 'fora_de_area' });
    expect(repo.reservarCarrinho).not.toHaveBeenCalled();
    expect(repo.inserirPedido).not.toHaveBeenCalled();
  });

  it('endereço inexistente (ou de outro dono) é 404 lógico, sem persistir', async () => {
    cenarioFelizardo();
    listarEnderecos.mockResolvedValue([]);
    const r = await criarPedido(ENTRADA, PROFILE);
    expect(r).toEqual({ ok: false, erro: 'endereco_invalido' });
    expect(repo.reservarCarrinho).not.toHaveBeenCalled();
  });

  it('frete null (fora de área) também barra, nunca vira zero calado', async () => {
    cenarioFelizardo();
    calcularFreteDoEndereco.mockResolvedValue({ ...FRETE_OK, freteCentavos: null, foraDeArea: true });
    const r = await criarPedido(ENTRADA, PROFILE);
    expect(r).toEqual({ ok: false, erro: 'fora_de_area' });
    expect(repo.reservarCarrinho).not.toHaveBeenCalled();
  });

  it('T36 — carrinho não cabe na fornada: 409 sem vaga, nenhuma cobrança', async () => {
    cenarioFelizardo();
    repo.reservarCarrinho.mockResolvedValue(null); // RPC recusa: tudo ou nada.
    const r = await criarPedido(ENTRADA, PROFILE);
    expect(r).toEqual({ ok: false, erro: 'sem_vaga', dia: DIA });
    expect(repo.inserirPedido).not.toHaveBeenCalled();
    expect(criarCobranca).not.toHaveBeenCalled();
  });

  it('T37 — Mercado Pago indisponível: libera a reserva, expira o pedido, sem preferência', async () => {
    cenarioFelizardo();
    criarCobranca.mockRejectedValue(new Error('gateway fora do ar'));
    const r = await criarPedido(ENTRADA, PROFILE);
    expect(r).toEqual({ ok: false, erro: 'gateway_indisponivel' });
    expect(repo.compensarPedido).toHaveBeenCalledWith('p-1', ['r-1']);
    expect(repo.anexarPreferencia).not.toHaveBeenCalled();
  });

  it('carrinho vazio (nada normalizável) não vira pedido', async () => {
    cenarioFelizardo();
    const r = await criarPedido({ itens: [], enderecoId: END }, PROFILE);
    expect(r).toEqual({ ok: false, erro: 'carrinho_vazio' });
    expect(lerCatalogo).not.toHaveBeenCalled();
  });

  it('nenhum dia comporta o pedido: sem vaga', async () => {
    cenarioFelizardo();
    resolverDiaDoPedido.mockReturnValue(null);
    const r = await criarPedido(ENTRADA, PROFILE);
    expect(r).toEqual({ ok: false, erro: 'sem_vaga', dia: null });
  });
});
