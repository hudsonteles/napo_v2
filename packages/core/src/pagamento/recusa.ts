/**
 * Motivo de recusa traduzido para a voz da casa (RN13).
 *
 * O Mercado Pago devolve `status_detail` com dezenas de códigos. Repassá-los
 * viola `ARCHITECTURE.md` §2.2.3 — nenhuma tela exibe mensagem de terceiro — e,
 * nos casos de antifraude, ainda dá retorno útil a quem está testando cartão
 * roubado. O que o cliente lê é a família, e o que fica gravado para auditoria
 * é o código cru, na cobrança.
 *
 * Decisão pura: não conhece gateway, não faz HTTP. O que o adaptador entrega é
 * uma string; o que sai é o texto da tela.
 */

export type FamiliaRecusa = 'saldo' | 'dados' | 'emissor' | 'duplicado' | 'outro';

const POR_DETALHE: Record<string, FamiliaRecusa> = {
  cc_rejected_insufficient_amount: 'saldo',

  cc_rejected_bad_filled_card_number: 'dados',
  cc_rejected_bad_filled_date: 'dados',
  cc_rejected_bad_filled_security_code: 'dados',
  cc_rejected_bad_filled_other: 'dados',

  cc_rejected_call_for_authorize: 'emissor',
  cc_rejected_card_disabled: 'emissor',
  cc_rejected_other_reason: 'emissor',

  cc_rejected_duplicated_payment: 'duplicado',

  // `high_risk` e `blacklist` são antifraude e caem no genérico DE PROPÓSITO:
  // confirmar ao cliente que a recusa foi por risco é dizer a quem testa cartão
  // roubado qual tentativa chegou perto.
  cc_rejected_high_risk: 'outro',
  cc_rejected_blacklist: 'outro',
  cc_rejected_card_error: 'outro',
};

const MENSAGENS: Record<FamiliaRecusa, string> = {
  saldo: 'O cartão não tinha limite suficiente para este valor. Tente outro cartão ou pague com Pix.',
  dados: 'Confira o número, a validade e o código de segurança do cartão.',
  emissor:
    'O banco recusou a compra. Costuma resolver ligando para ele — ou você pode pagar com Pix agora.',
  duplicado:
    'Esse pagamento já foi feito. Confira a tela do seu pedido antes de tentar de novo.',
  outro: 'Não foi possível concluir com este cartão. Tente outro ou pague com Pix.',
};

/** Código novo do gateway cai no genérico: a tela nunca fica sem texto. */
export function familiaDaRecusa(detalhe: string | null | undefined): FamiliaRecusa {
  return (detalhe && POR_DETALHE[detalhe]) || 'outro';
}

export function mensagemDaRecusa(familia: FamiliaRecusa): string {
  return MENSAGENS[familia];
}
