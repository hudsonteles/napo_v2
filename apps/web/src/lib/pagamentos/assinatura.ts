import { createHmac, timingSafeEqual } from 'node:crypto';

/** O que o Mercado Pago manda: dois cabeçalhos e o id que vem na querystring. */
export interface NotificacaoAssinada {
  /** Cabeçalho `x-signature`, no formato `ts=...,v1=...`. */
  assinatura: string | null;
  /** Cabeçalho `x-request-id`. */
  requestId: string | null;
  /** `data.id` da querystring — o id do pagamento a consultar. */
  dataId: string | null;
}

/**
 * Confere o HMAC do manifesto da notificação (RN10).
 *
 * A assinatura prova origem, não conteúdo: quem passa daqui ainda tem o valor
 * buscado na API do Mercado Pago, nunca lido do corpo recebido.
 */
export function verificarAssinaturaMercadoPago(
  { assinatura, requestId, dataId }: NotificacaoAssinada,
  segredo: string,
): boolean {
  if (!assinatura || !requestId || !dataId || !segredo) return false;

  const partes = new Map(
    assinatura.split(',').map((parte) => {
      const [chave, ...resto] = parte.split('=');
      return [chave?.trim() ?? '', resto.join('=').trim()];
    }),
  );

  const ts = partes.get('ts');
  const recebido = partes.get('v1');
  if (!ts || !recebido) return false;

  // Id alfanumérico entra em minúsculas — é assim que o manifesto é montado do
  // lado deles, e conferir com a grafia recebida recusaria notificação legítima.
  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');

  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(recebido, 'utf8');

  // `timingSafeEqual` lança quando os tamanhos diferem; um hash truncado é
  // resposta falsa, não exceção.
  return a.length === b.length && timingSafeEqual(a, b);
}
