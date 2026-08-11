/**
 * IP do cliente atrás do proxy da Vercel (RN7, RN15).
 *
 * `x-forwarded-for` chega como cadeia `cliente, proxy1, proxy2` — o primeiro é
 * quem originou. Pode ser forjado por quem fala direto com a origem, e é por
 * isso que o teto por IP é o **dobro** do teto por número: ele é defesa em
 * profundidade contra script, não identidade confiável.
 */
export function ipDaRequisicao(headers: Headers): string | null {
  const encaminhado = headers.get('x-forwarded-for');
  if (encaminhado) {
    const primeiro = encaminhado.split(',')[0]?.trim();
    if (primeiro) return primeiro;
  }
  return headers.get('x-real-ip');
}
