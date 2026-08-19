import { describe, expect, it } from 'vitest';

import { faltaParaFreteGratis, interpretarRespostaPedido } from './checkout-view';

const PID = '00000000-0000-0000-0000-0000000000aa';

describe('interpretarRespostaPedido', () => {
  it('sucesso devolve número e URL de pagamento', () => {
    expect(
      interpretarRespostaPedido(200, { success: true, data: { numero: 1042, urlPagamento: 'https://mp/1' } }),
    ).toEqual({ tipo: 'ok', numero: 1042, urlPagamento: 'https://mp/1' });
  });

  it('409 com divergências é E1 (preço mudou), com o de/para', () => {
    const divergencias = [{ produtoId: PID, deCentavos: 3790, paraCentavos: 3990 }];
    expect(interpretarRespostaPedido(409, { success: false, divergencias })).toEqual({
      tipo: 'divergencia',
      divergencias,
    });
  });

  it('409 sem divergências é E3 (sem vaga), carregando o dia recalculado', () => {
    expect(interpretarRespostaPedido(409, { success: false, dia: '2026-08-29' })).toEqual({
      tipo: 'sem_vaga',
      dia: '2026-08-29',
    });
  });

  it('mapeia 422 → fora de área, 503 → gateway, 401/403 → sessão', () => {
    expect(interpretarRespostaPedido(422, {}).tipo).toBe('fora_area');
    expect(interpretarRespostaPedido(503, {}).tipo).toBe('gateway');
    expect(interpretarRespostaPedido(401, {}).tipo).toBe('sessao');
    expect(interpretarRespostaPedido(403, {}).tipo).toBe('sessao');
  });

  it('qualquer outro é erro genérico', () => {
    expect(interpretarRespostaPedido(500, {}).tipo).toBe('erro');
    expect(interpretarRespostaPedido(200, { success: false }).tipo).toBe('erro');
  });
});

describe('faltaParaFreteGratis', () => {
  it('devolve quanto falta abaixo do piso', () => {
    expect(faltaParaFreteGratis(12970, 15000)).toBe(2030);
  });

  it('devolve null quando já atingiu', () => {
    expect(faltaParaFreteGratis(15000, 15000)).toBeNull();
    expect(faltaParaFreteGratis(20000, 15000)).toBeNull();
  });
});
