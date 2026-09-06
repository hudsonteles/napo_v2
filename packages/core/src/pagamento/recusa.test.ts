import { describe, expect, it } from 'vitest';

import { familiaDaRecusa, mensagemDaRecusa } from './recusa';

describe('familiaDaRecusa', () => {
  it('reconhece falta de limite', () => {
    expect(familiaDaRecusa('cc_rejected_insufficient_amount')).toBe('saldo');
  });

  it('junta os quatro erros de preenchimento numa família só', () => {
    for (const detalhe of [
      'cc_rejected_bad_filled_card_number',
      'cc_rejected_bad_filled_date',
      'cc_rejected_bad_filled_security_code',
      'cc_rejected_bad_filled_other',
    ]) {
      expect(familiaDaRecusa(detalhe)).toBe('dados');
    }
  });

  it('reconhece a recusa do emissor', () => {
    expect(familiaDaRecusa('cc_rejected_call_for_authorize')).toBe('emissor');
    expect(familiaDaRecusa('cc_rejected_card_disabled')).toBe('emissor');
    expect(familiaDaRecusa('cc_rejected_other_reason')).toBe('emissor');
  });

  it('reconhece pagamento repetido', () => {
    expect(familiaDaRecusa('cc_rejected_duplicated_payment')).toBe('duplicado');
  });

  it('não conta ao cliente que a recusa foi antifraude', () => {
    // Dizer "recusado por risco" ensina quem está testando cartão roubado qual
    // tentativa passou perto. As duas caem no genérico de propósito.
    expect(familiaDaRecusa('cc_rejected_high_risk')).toBe('outro');
    expect(familiaDaRecusa('cc_rejected_blacklist')).toBe('outro');
  });

  it('trata detalhe desconhecido, vazio e ausente como genérico', () => {
    expect(familiaDaRecusa('detalhe_que_o_mp_inventou_amanha')).toBe('outro');
    expect(familiaDaRecusa('')).toBe('outro');
    expect(familiaDaRecusa(null)).toBe('outro');
    expect(familiaDaRecusa(undefined)).toBe('outro');
  });
});

describe('mensagemDaRecusa', () => {
  it('devolve texto nosso, em português, para toda família', () => {
    for (const familia of ['saldo', 'dados', 'emissor', 'duplicado', 'outro'] as const) {
      const mensagem = mensagemDaRecusa(familia);
      expect(mensagem.length).toBeGreaterThan(20);
      // Nenhum código do gateway vaza para a tela (RN13).
      expect(mensagem).not.toMatch(/cc_rejected|_/);
    }
  });

  it('oferece a saída pelo Pix onde ela resolve', () => {
    expect(mensagemDaRecusa('saldo')).toMatch(/Pix/);
    expect(mensagemDaRecusa('emissor')).toMatch(/Pix/);
    expect(mensagemDaRecusa('outro')).toMatch(/Pix/);
  });
});
