import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface EntradaAssinatura {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  segredo: string;
}

/**
 * Verifica a assinatura da notificação do Mercado Pago (RN10). Esquema: header
 * `x-signature: ts=<unix>,v1=<hmacHex>`; o manifesto assinado é
 * `id:<dataId>;request-id:<xRequestId>;ts:<ts>;` — o segmento `request-id` só
 * entra quando o header existe, exatamente como o Mercado Pago o monta.
 *
 * A assinatura protege a ORIGEM, não o conteúdo: por isso o valor e o status do
 * pagamento nunca saem daqui — saem da consulta à API (design §5, webhook). Erro
 * neste arquivo é pedido confirmado sem pagamento.
 */
export function verificarAssinaturaMercadoPago(entrada: EntradaAssinatura): boolean {
  const { xSignature, xRequestId, dataId, segredo } = entrada;
  if (!xSignature) return false;

  const partes = new Map(
    xSignature.split(',').map((parte) => {
      const [chave, valor] = parte.split('=');
      return [chave?.trim(), valor?.trim()] as const;
    }),
  );

  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  if (!ts || !v1) return false;

  let manifesto = `id:${dataId};`;
  if (xRequestId) manifesto += `request-id:${xRequestId};`;
  manifesto += `ts:${ts};`;

  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');

  const recebido = paraBuffer(v1);
  const calculado = paraBuffer(esperado);
  // Comprimentos diferentes fazem `timingSafeEqual` lançar; o curto-circuito de
  // tamanho não vaza timing útil (o hash tem tamanho fixo).
  if (recebido.length !== calculado.length) return false;

  return timingSafeEqual(recebido, calculado);
}

function paraBuffer(hex: string): Buffer {
  // Hex inválido vira buffer vazio; o teste de comprimento reprova em seguida.
  return /^[0-9a-f]*$/i.test(hex) && hex.length % 2 === 0
    ? Buffer.from(hex, 'hex')
    : Buffer.alloc(0);
}
