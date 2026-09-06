import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Acesso às cobranças, isolado das rotas.
 *
 * Escreve com a chave de serviço porque a tabela foi **revogada** de `anon` e
 * `authenticated` (0016): cobrança é operação, não conteúdo de cliente.
 */

export type InstrumentoCobranca = 'online' | 'pix_qr' | 'link' | 'dinheiro' | 'point';
export type SituacaoCobranca = 'pendente' | 'aprovada' | 'recusada' | 'expirada' | 'estornada';

export interface CobrancaLida {
  id: string;
  pedidoId: string;
  instrumento: InstrumentoCobranca;
  situacao: SituacaoCobranca;
  valorCentavos: number;
  mpPaymentId: string | null;
  expiraEm: string | null;
}

export interface RepositorioDeCobrancas {
  /**
   * Abre uma cobrança pendente. Quando já existe uma viva para o pedido, o
   * índice único parcial recusa o insert e o que volta é a que já existe — é
   * assim que o duplo clique resolve para a mesma cobrança (RN10).
   */
  abrir(entrada: {
    pedidoId: string;
    instrumento: InstrumentoCobranca;
    valorCentavos: number;
    expiraEm: string | null;
    criadaPor: string | null;
  }): Promise<CobrancaLida>;
  ler(cobrancaId: string): Promise<CobrancaLida | null>;
  pendenteDoPedido(pedidoId: string): Promise<CobrancaLida | null>;
  /** Guarda o rastro do gateway sem aprovar: quem aprova é o webhook (RN6). */
  registrarTentativa(entrada: {
    cobrancaId: string;
    mpPaymentId: string | null;
    detalhe: string | null;
  }): Promise<void>;
  mudarSituacao(entrada: {
    cobrancaId: string;
    situacao: Exclude<SituacaoCobranca, 'aprovada'>;
    detalhe?: string | null;
  }): Promise<void>;
}

const CAMPOS =
  'id, pedido_id, instrumento, situacao, valor_centavos, mp_payment_id, expira_em';

interface Linha {
  id: string;
  pedido_id: string;
  instrumento: InstrumentoCobranca;
  situacao: SituacaoCobranca;
  valor_centavos: number;
  mp_payment_id: string | null;
  expira_em: string | null;
}

function paraCobranca(linha: Linha): CobrancaLida {
  return {
    id: linha.id,
    pedidoId: linha.pedido_id,
    instrumento: linha.instrumento,
    situacao: linha.situacao,
    valorCentavos: linha.valor_centavos,
    mpPaymentId: linha.mp_payment_id,
    expiraEm: linha.expira_em,
  };
}

/** Violação de restrição única: o banco decidiu, não a aplicação. */
const VIOLACAO_UNICA = '23505';

export function repositorioDeCobrancas(): RepositorioDeCobrancas {
  const supabase = createSupabaseAdminClient();

  return {
    async abrir({ pedidoId, instrumento, valorCentavos, expiraEm, criadaPor }) {
      const { data, error } = await supabase
        .from('cobrancas')
        .insert({
          pedido_id: pedidoId,
          instrumento,
          valor_centavos: valorCentavos,
          expira_em: expiraEm,
          criada_por: criadaPor,
        })
        .select(CAMPOS)
        .single();

      if (!error) return paraCobranca(data as Linha);

      if (error.code !== VIOLACAO_UNICA) throw error;

      // Já havia uma pendente: é o segundo clique chegando. Devolver a que
      // existe é o que faz a tentativa do cliente virar uma cobrança só.
      const existente = await this.pendenteDoPedido(pedidoId);
      if (!existente) throw error;
      return existente;
    },

    async ler(cobrancaId) {
      const { data } = await supabase
        .from('cobrancas')
        .select(CAMPOS)
        .eq('id', cobrancaId)
        .maybeSingle();

      return data ? paraCobranca(data as Linha) : null;
    },

    async pendenteDoPedido(pedidoId) {
      const { data } = await supabase
        .from('cobrancas')
        .select(CAMPOS)
        .eq('pedido_id', pedidoId)
        .eq('situacao', 'pendente')
        .maybeSingle();

      return data ? paraCobranca(data as Linha) : null;
    },

    async registrarTentativa({ cobrancaId, mpPaymentId, detalhe }) {
      const { error } = await supabase
        .from('cobrancas')
        .update({ mp_payment_id: mpPaymentId, mp_status_detail: detalhe })
        .eq('id', cobrancaId);

      if (error) throw error;
    },

    async mudarSituacao({ cobrancaId, situacao, detalhe }) {
      const { error } = await supabase
        .from('cobrancas')
        .update({ situacao, ...(detalhe === undefined ? {} : { mp_status_detail: detalhe }) })
        .eq('id', cobrancaId);

      if (error) throw error;
    },
  };
}
