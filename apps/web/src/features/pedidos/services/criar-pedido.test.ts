import { beforeEach, describe, expect, it, vi } from 'vitest';

import { criarPedido } from './criar-pedido';
import type { DependenciasDoPedido, FontesDoPedido } from './criar-pedido';
import type { RepositorioDePedidos } from './pedidos-repo';

const CALABRESA = '00000000-0000-0000-0000-00000000000a';
const MARGHERITA = '00000000-0000-0000-0000-00000000000b';
const ENDERECO = '00000000-0000-0000-0000-0000000000ee';
const PERFIL = '00000000-0000-0000-0000-0000000000aa';
const DIA = '2026-08-22';

const PRECOS = [
  { produtoId: CALABRESA, nome: 'Calabresa', precoUnitarioCentavos: 3990, ehMassa: false },
  { produtoId: MARGHERITA, nome: 'Margherita', precoUnitarioCentavos: 5990, ehMassa: false },
];

const ENDERECO_SNAPSHOT = { logradouro: 'SQN 210 Bloco C', numero: '101' };

function fontes(parcial: Partial<FontesDoPedido> = {}): FontesDoPedido {
  return {
    precos: async () => PRECOS,
    disponibilidade: async () => ({
      dias: [
        {
          data: DIA,
          cutoff: `${DIA}T00:00:00Z`,
          modo: 'CTP',
          capacidadeRestante: 30,
          produtos: [
            { produtoId: CALABRESA, disponivel: 10 },
            { produtoId: MARGHERITA, disponivel: 10 },
          ],
        },
      ] as never,
      consumos: [],
    }),
    endereco: async () => ({ id: ENDERECO, atendido: true, snapshot: ENDERECO_SNAPSHOT }),
    frete: async () => ({
      freteCentavos: 600,
      gratis: false,
      faixa: null,
      foraDeArea: false,
      motivo: null,
    }),
    ...parcial,
  };
}

function repositorio(parcial: Partial<RepositorioDePedidos> = {}): RepositorioDePedidos {
  return {
    pagamentoMinutos: async () => 30,
    reservarCarrinho: async ({ itens }) =>
      itens.map((item, indice) => ({
        id: `reserva-${indice}`,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        expira_em: '2026-08-20T12:30:00Z',
      })),
    gravarPedido: async () => ({ id: 'pedido-1', numero: 1042 }),
    registrarPreferencia: async () => {},
    desfazerPedido: async () => {},
    ...parcial,
  };
}

const COBRANCA_OK = { preferenciaId: 'pref-1', urlPagamento: 'https://mp/pagar' };

function pagamento(criarCobranca = vi.fn().mockResolvedValue(COBRANCA_OK)) {
  return {
    criarCobranca,
    consultarPagamento: vi.fn(),
    verificarAssinatura: vi.fn(),
  };
}

function dependencias(parcial: Partial<DependenciasDoPedido> = {}): DependenciasDoPedido {
  return {
    fontes: fontes(),
    repo: repositorio(),
    pagamento: pagamento(),
    urlRetorno: (numero) => `https://napobsb.com.br/pedido/${numero}`,
    ...parcial,
  };
}

const ENTRADA = {
  itens: [{ produtoId: CALABRESA, quantidade: 2, precoVistoCentavos: 3990 }],
  enderecoId: ENDERECO,
};

describe('criarPedido', () => {
  beforeEach(() => vi.clearAllMocks());

  it('T3 — o pedido congela nome e preço do dia da venda, e o endereço inteiro', async () => {
    const gravarPedido = vi.fn().mockResolvedValue({ id: 'pedido-1', numero: 1042 });

    await criarPedido(ENTRADA, PERFIL, dependencias({ repo: repositorio({ gravarPedido }) }));

    expect(gravarPedido).toHaveBeenCalledWith(
      expect.objectContaining({
        enderecoSnapshot: ENDERECO_SNAPSHOT,
        subtotalCentavos: 7980,
        freteCentavos: 600,
        totalCentavos: 8580,
        itens: [
          {
            produtoId: CALABRESA,
            nome: 'Calabresa',
            quantidade: 2,
            precoUnitarioCentavos: 3990,
          },
        ],
      }),
    );
  });

  it('T5 — a reserva nasce antes da cobrança, com o prazo do pagamento', async () => {
    const ordem: string[] = [];
    const reservarCarrinho = vi.fn(async () => {
      ordem.push('reserva');
      return [
        {
          id: 'reserva-0',
          produto_id: CALABRESA,
          quantidade: 2,
          expira_em: '2026-08-20T12:30:00Z',
        },
      ];
    });
    const criarCobranca = vi.fn(async () => {
      ordem.push('cobranca');
      return { preferenciaId: 'pref-1', urlPagamento: 'https://mp/pagar' };
    });
    const gravarPedido = vi.fn().mockResolvedValue({ id: 'pedido-1', numero: 1042 });

    await criarPedido(
      ENTRADA,
      PERFIL,
      dependencias({
        repo: repositorio({ reservarCarrinho, gravarPedido }),
        pagamento: pagamento(criarCobranca),
      }),
    );

    expect(ordem).toEqual(['reserva', 'cobranca']);
    expect(reservarCarrinho).toHaveBeenCalledWith(expect.objectContaining({ minutos: 30 }));
    // O pedido vence junto com a reserva que o sustenta.
    expect(gravarPedido).toHaveBeenCalledWith(
      expect.objectContaining({ expiraEm: '2026-08-20T12:30:00Z', reservaId: 'reserva-0' }),
    );
  });

  it('T14 — preço divergente bloqueia sem reservar nem gravar', async () => {
    const reservarCarrinho = vi.fn();
    const gravarPedido = vi.fn();

    const resultado = await criarPedido(
      { ...ENTRADA, itens: [{ produtoId: CALABRESA, quantidade: 2, precoVistoCentavos: 3790 }] },
      PERFIL,
      dependencias({ repo: repositorio({ reservarCarrinho, gravarPedido }) }),
    );

    expect(resultado).toEqual({
      ok: false,
      falha: {
        motivo: 'preco_mudou',
        status: 409,
        divergencias: [{ produtoId: CALABRESA, deCentavos: 3790, paraCentavos: 3990 }],
      },
    });
    expect(reservarCarrinho).not.toHaveBeenCalled();
    expect(gravarPedido).not.toHaveBeenCalled();
  });

  it('T18 — endereço fora de área devolve 422 e nada é persistido', async () => {
    const gravarPedido = vi.fn();

    const resultado = await criarPedido(
      ENTRADA,
      PERFIL,
      dependencias({
        fontes: fontes({
          endereco: async () => ({ id: ENDERECO, atendido: false, snapshot: ENDERECO_SNAPSHOT }),
        }),
        repo: repositorio({ gravarPedido }),
      }),
    );

    expect(resultado).toMatchObject({ ok: false, falha: { motivo: 'fora_de_area', status: 422 } });
    expect(gravarPedido).not.toHaveBeenCalled();
  });

  it('T19 — frete nulo é fora de área, nunca zero', async () => {
    const resultado = await criarPedido(
      ENTRADA,
      PERFIL,
      dependencias({
        fontes: fontes({
          frete: async () => ({
            freteCentavos: null,
            gratis: false,
            faixa: null,
            foraDeArea: true,
            motivo: 'fora do raio',
          }),
        }),
      }),
    );

    expect(resultado).toEqual({
      ok: false,
      falha: { motivo: 'fora_de_area', status: 422, detalhe: 'fora do raio' },
    });
  });

  it('T19 — o frete grava o valor que a faixa devolveu, não o que o cliente mandaria', async () => {
    const gravarPedido = vi.fn().mockResolvedValue({ id: 'pedido-1', numero: 1042 });

    await criarPedido(ENTRADA, PERFIL, dependencias({ repo: repositorio({ gravarPedido }) }));

    expect(gravarPedido).toHaveBeenCalledWith(expect.objectContaining({ freteCentavos: 600 }));
  });

  it('T36 — carrinho que não cabe na fornada não vira reserva parcial', async () => {
    const reservarCarrinho = vi.fn().mockResolvedValue(null);
    const gravarPedido = vi.fn();

    const resultado = await criarPedido(
      ENTRADA,
      PERFIL,
      dependencias({ repo: repositorio({ reservarCarrinho, gravarPedido }) }),
    );

    expect(resultado).toMatchObject({ ok: false, falha: { motivo: 'sem_vaga', status: 409 } });
    expect(gravarPedido).not.toHaveBeenCalled();
  });

  it('T36 — item acima do que a fornada comporta bloqueia antes de reservar', async () => {
    const reservarCarrinho = vi.fn();

    const resultado = await criarPedido(
      { ...ENTRADA, itens: [{ produtoId: CALABRESA, quantidade: 12, precoVistoCentavos: 3990 }] },
      PERFIL,
      dependencias({ repo: repositorio({ reservarCarrinho }) }),
    );

    // Não cabe em nenhuma fornada do horizonte: o dia nem chega a ser resolvido.
    expect(resultado).toMatchObject({ ok: false, falha: { motivo: 'sem_vaga', status: 409 } });
    expect(reservarCarrinho).not.toHaveBeenCalled();
  });

  it('T37 — gateway indisponível devolve a vaga na mesma requisição', async () => {
    const desfazerPedido = vi.fn();
    const criarCobranca = vi.fn().mockRejectedValue(new Error('mercado pago fora do ar'));

    const resultado = await criarPedido(
      ENTRADA,
      PERFIL,
      dependencias({
        repo: repositorio({ desfazerPedido }),
        pagamento: pagamento(criarCobranca),
      }),
    );

    expect(resultado).toEqual({
      ok: false,
      falha: { motivo: 'gateway_indisponivel', status: 503 },
    });
    expect(desfazerPedido).toHaveBeenCalledWith('pedido-1', ['reserva-0']);
  });

  it('T37 — todas as reservas do carrinho voltam, não só a gravada no pedido', async () => {
    const desfazerPedido = vi.fn();
    const criarCobranca = vi.fn().mockRejectedValue(new Error('mercado pago fora do ar'));

    await criarPedido(
      {
        ...ENTRADA,
        itens: [
          { produtoId: CALABRESA, quantidade: 2, precoVistoCentavos: 3990 },
          { produtoId: MARGHERITA, quantidade: 1, precoVistoCentavos: 5990 },
        ],
      },
      PERFIL,
      dependencias({
        repo: repositorio({ desfazerPedido }),
        pagamento: pagamento(criarCobranca),
      }),
    );

    expect(desfazerPedido).toHaveBeenCalledWith('pedido-1', ['reserva-0', 'reserva-1']);
  });

  it('o limite mandado ao banco é o teto do dia, com as vagas já ocupadas somadas', async () => {
    const reservarCarrinho = vi.fn().mockResolvedValue([
      { id: 'reserva-0', produto_id: CALABRESA, quantidade: 2, expira_em: '2026-08-20T12:30:00Z' },
    ]);

    await criarPedido(
      ENTRADA,
      PERFIL,
      dependencias({
        fontes: fontes({
          disponibilidade: async () => ({
            dias: [
              {
                data: DIA,
                cutoff: `${DIA}T00:00:00Z`,
                modo: 'CTP',
                capacidadeRestante: 30,
                produtos: [{ produtoId: CALABRESA, disponivel: 6 }],
              },
            ] as never,
            consumos: [{ diaEntrega: DIA, produtoId: CALABRESA, quantidade: 4 }],
          }),
        }),
        repo: repositorio({ reservarCarrinho }),
      }),
    );

    expect(reservarCarrinho).toHaveBeenCalledWith(
      expect.objectContaining({ limites: [{ produto_id: CALABRESA, limite: 10 }] }),
    );
  });

  it('produto que saiu do catálogo não vira pedido', async () => {
    const resultado = await criarPedido(
      ENTRADA,
      PERFIL,
      dependencias({ fontes: fontes({ precos: async () => [] }) }),
    );

    expect(resultado).toMatchObject({
      ok: false,
      falha: { motivo: 'produto_fora_do_catalogo', status: 409 },
    });
  });

  it('pedido criado devolve número, dia e a URL do gateway', async () => {
    const resultado = await criarPedido(ENTRADA, PERFIL, dependencias());

    expect(resultado).toEqual({
      ok: true,
      pedido: {
        pedidoId: 'pedido-1',
        numero: 1042,
        diaEntrega: DIA,
        totalCentavos: 8580,
        urlPagamento: 'https://mp/pagar',
      },
    });
  });

  it('a cobrança carrega o id do pedido como referência externa', async () => {
    const criarCobranca = vi.fn().mockResolvedValue(COBRANCA_OK);

    await criarPedido(ENTRADA, PERFIL, dependencias({ pagamento: pagamento(criarCobranca) }));

    expect(criarCobranca).toHaveBeenCalledWith(
      expect.objectContaining({
        referenciaExterna: 'pedido-1',
        numeroPedido: 1042,
        freteCentavos: 600,
        urlRetorno: 'https://napobsb.com.br/pedido/1042',
      }),
    );
  });
});
