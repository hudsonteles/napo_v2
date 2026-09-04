import { beforeEach, describe, expect, it, vi } from 'vitest';

const exigirClienteValidado = vi.fn();
const lerPedidoPorNumero = vi.fn();
const cancelarPedido = vi.fn();
const carregarSnapshot = vi.fn();

vi.mock('@/lib/guarda-api', () => ({
  exigirClienteValidado: () => exigirClienteValidado(),
}));
vi.mock('@/features/disponibilidade', () => ({
  carregarSnapshot: (...args: unknown[]) => carregarSnapshot(...args),
}));
vi.mock('@/features/pedidos', () => ({
  repositorioDePedidos: () => ({ lerPedidoPorNumero, cancelarPedido }),
}));

const { POST } = await import('./route');

const PEDIDO = {
  id: 'pedido-1',
  numero: 1042,
  profileId: 'u-1',
  status: 'pago',
  diaEntrega: '2026-08-14',
  totalCentavos: 13570,
  mpPaymentId: 'pag-1',
  itens: [{ produtoId: 'p-1', quantidade: 2 }],
};

/** Sexta 14/08 como dia de entrega; `agora` decide se o cutoff já passou. */
function snapshot(agora: string) {
  return {
    agora: new Date(agora),
    config: {
      tempoPreparoHoras: 48,
      tetoFornoDia: 30,
      capacidadeFreezer: 150,
      subTetoMassaDia: 6,
      limiteOcupacaoMassaPct: 80,
      bufferCutoffMin: 15,
      reservaMinutos: 15,
      horizonteSemanas: 2,
    },
    diasEntrega: [{ diaSemana: 5, entrega: true, janelaInicio: '17:00', janelaFim: '21:00' }],
    diasProducao: [1, 2, 3, 4, 5].map((d) => ({ diaSemana: d, produz: true })),
    excecoes: [],
    produtos: [{ id: 'p-1', ehMassa: false }],
    lotes: [],
    producaoPlanejada: [],
    consumos: [],
  };
}

function requisicao() {
  return new Request('http://localhost/api/pedidos/1042/cancelar', { method: 'POST' });
}

const PARAMS = { params: Promise.resolve({ numero: '1042' }) };

describe('POST /api/pedidos/[numero]/cancelar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exigirClienteValidado.mockResolvedValue({ perfil: { id: 'u-1' } });
    lerPedidoPorNumero.mockResolvedValue(PEDIDO);
    cancelarPedido.mockResolvedValue(true);
  });

  it('T16 — depois do cutoff o cliente não cancela e o pedido não muda', async () => {
    // Quinta 13/08: o cutoff da entrega de sexta já passou.
    carregarSnapshot.mockResolvedValue(snapshot('2026-08-13T12:00:00Z'));

    const resposta = await POST(requisicao(), PARAMS);

    expect(resposta.status).toBe(409);
    expect(cancelarPedido).not.toHaveBeenCalled();
  });

  it('antes do cutoff o cancelamento passa, com a devolução decidida pelo núcleo', async () => {
    carregarSnapshot.mockResolvedValue(snapshot('2026-08-06T12:00:00Z'));

    const resposta = await POST(requisicao(), PARAMS);

    expect(resposta.status).toBe(200);
    expect(cancelarPedido).toHaveBeenCalledWith('pedido-1', 'capacidade');
  });

  it('pedido de outra pessoa responde igual a pedido inexistente', async () => {
    lerPedidoPorNumero.mockResolvedValue({ ...PEDIDO, profileId: 'outro' });

    const resposta = await POST(requisicao(), PARAMS);

    expect(resposta.status).toBe(404);
    expect(carregarSnapshot).not.toHaveBeenCalled();
  });

  it('pedido já encerrado devolve 409 em vez de fingir que cancelou', async () => {
    carregarSnapshot.mockResolvedValue(snapshot('2026-08-06T12:00:00Z'));
    cancelarPedido.mockResolvedValue(false);

    const resposta = await POST(requisicao(), PARAMS);

    expect(resposta.status).toBe(409);
  });

  it('sem sessão não há cancelamento', async () => {
    exigirClienteValidado.mockResolvedValue({
      resposta: Response.json({ success: false }, { status: 401 }),
    });

    const resposta = await POST(requisicao(), PARAMS);

    expect(resposta.status).toBe(401);
    expect(lerPedidoPorNumero).not.toHaveBeenCalled();
  });
});
