import { describe, expect, it } from 'vitest';

import { criarPedidoSchema, notificacaoMpSchema, validarCarrinhoSchema } from './schema';

const PID = '00000000-0000-0000-0000-0000000000aa';
const END = '11111111-0000-0000-0000-000000000001';

describe('criarPedidoSchema', () => {
  it('aceita itens com preço visto e endereço', () => {
    const r = criarPedidoSchema.safeParse({
      itens: [{ produtoId: PID, quantidade: 2, precoUnitarioCentavos: 3990 }],
      enderecoId: END,
    });
    expect(r.success).toBe(true);
  });

  it('T13 — total, frete ou distância no corpo são rejeitados pelo schema', () => {
    for (const extra of [{ total: 12970 }, { freteCentavos: 600 }, { distanciaKm: 3.2 }]) {
      const r = criarPedidoSchema.safeParse({
        itens: [{ produtoId: PID, quantidade: 1, precoUnitarioCentavos: 3990 }],
        enderecoId: END,
        ...extra,
      });
      expect(r.success).toBe(false);
    }
  });

  it('T21 — declarar forma de pagamento (na entrega) é recusado', () => {
    const r = criarPedidoSchema.safeParse({
      itens: [{ produtoId: PID, quantidade: 1, precoUnitarioCentavos: 3990 }],
      enderecoId: END,
      formaPagamento: 'entrega',
    });
    expect(r.success).toBe(false);
  });

  it('T32 — lista de itens vazia é inválida', () => {
    const r = criarPedidoSchema.safeParse({ itens: [], enderecoId: END });
    expect(r.success).toBe(false);
  });

  it('quantidade fracionária ou não-positiva é recusada', () => {
    for (const q of [0, -1, 1.5]) {
      const r = criarPedidoSchema.safeParse({
        itens: [{ produtoId: PID, quantidade: q, precoUnitarioCentavos: 3990 }],
        enderecoId: END,
      });
      expect(r.success).toBe(false);
    }
  });
});

describe('validarCarrinhoSchema', () => {
  it('não aceita preço no corpo — revalidar é o servidor dizendo o preço (RN1/RN3)', () => {
    const r = validarCarrinhoSchema.safeParse({
      itens: [{ produtoId: PID, quantidade: 1, precoUnitarioCentavos: 3990 }],
    });
    expect(r.success).toBe(false);
  });

  it('aceita id e quantidade', () => {
    const r = validarCarrinhoSchema.safeParse({ itens: [{ produtoId: PID, quantidade: 1 }] });
    expect(r.success).toBe(true);
  });
});

describe('notificacaoMpSchema', () => {
  it('exige data.id e tolera campos extras do Mercado Pago', () => {
    const r = notificacaoMpSchema.safeParse({
      type: 'payment',
      action: 'payment.updated',
      data: { id: '123' },
      live_mode: true,
    });
    expect(r.success).toBe(true);
  });

  it('recusa notificação sem data.id', () => {
    expect(notificacaoMpSchema.safeParse({ type: 'payment', data: {} }).success).toBe(false);
  });
});
