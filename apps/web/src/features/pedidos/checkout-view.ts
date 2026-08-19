import type { DivergenciaPreco } from '@napo/core';

/**
 * Forma mínima do endereço que o checkout consome. Definida aqui, e não importada
 * de `features/enderecos`, para não criar dependência entre features (a página
 * compõe: ela importa das duas e passa o dado). `Endereco` é estruturalmente
 * compatível com este subconjunto, então a página passa direto.
 */
export interface EnderecoParaCheckout {
  id: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string;
  distanciaKm: number | null;
  atendido: boolean;
  motivoNaoAtendido: string | null;
  padrao: boolean;
}

/**
 * Tradução pura da resposta de `POST /api/pedidos` no estado que o checkout
 * mostra — testável em node, sem React nem rede. Cada código HTTP do contrato
 * (design §3.2) vira um estado de tela: divergência bloqueia com de/para (E1),
 * sem vaga oferece a próxima fornada (E3), gateway preserva o carrinho.
 */
export type ResultadoPagar =
  | { tipo: 'ok'; numero: number; urlPagamento: string }
  | { tipo: 'divergencia'; divergencias: DivergenciaPreco[] }
  | { tipo: 'sem_vaga'; dia: string | null }
  | { tipo: 'fora_area' }
  | { tipo: 'gateway' }
  | { tipo: 'sessao' }
  | { tipo: 'erro' };

interface CorpoResposta {
  success?: boolean;
  data?: { numero?: number; urlPagamento?: string };
  divergencias?: DivergenciaPreco[];
  dia?: string | null;
}

export function interpretarRespostaPedido(status: number, corpo: CorpoResposta | null): ResultadoPagar {
  if (status === 200 && corpo?.success && corpo.data?.numero != null && corpo.data.urlPagamento) {
    return { tipo: 'ok', numero: corpo.data.numero, urlPagamento: corpo.data.urlPagamento };
  }
  // A divergência de preço e o "sem vaga" compartilham o 409; o que os separa é
  // o corpo trazer o de/para dos preços (RN3) ou não (RN7).
  if (status === 409 && Array.isArray(corpo?.divergencias) && corpo.divergencias.length > 0) {
    return { tipo: 'divergencia', divergencias: corpo.divergencias };
  }
  if (status === 409) return { tipo: 'sem_vaga', dia: corpo?.dia ?? null };
  if (status === 422) return { tipo: 'fora_area' };
  if (status === 503) return { tipo: 'gateway' };
  if (status === 401 || status === 403) return { tipo: 'sessao' };
  return { tipo: 'erro' };
}

/** `null` quando já atingiu o frete grátis; senão quanto falta (para a linha do resumo). */
export function faltaParaFreteGratis(subtotalCentavos: number, freteGratisCentavos: number): number | null {
  const falta = freteGratisCentavos - subtotalCentavos;
  return falta > 0 ? falta : null;
}

/** "2026-08-22" → "sexta, 22/08" (título compacto do bloco da fornada, direção A). */
export function formatarFornadaBreve(data: string): string {
  const d = new Date(`${data}T12:00:00`);
  const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d).replace('-feira', '');
  const [, mes, dia] = data.split('-');
  return `${semana}, ${dia}/${mes}`;
}
