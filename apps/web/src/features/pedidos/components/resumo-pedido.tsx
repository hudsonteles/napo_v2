'use client';

import { Lock } from 'lucide-react';
import { Button } from '@napo/ui/components/button';

/**
 * A ficha da fornada (Direção A, aprovada no Gate Visual A).
 *
 * O dia de entrega é o **título** do resumo, não uma linha entre subtotal e
 * frete: o que o cliente compra não é "3 pizzas", é uma vaga numa fornada de um
 * dia específico — a leitura literal do gargalo do negócio.
 */
const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function diaCurto(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
}

export function ResumoPedido({
  diaEntrega,
  quantidadeItens,
  subtotalCentavos,
  freteCentavos,
  distanciaKm,
  faltamParaFreteGratisCentavos,
  minutosDeReserva,
  processando,
  bloqueio,
  onPagar,
}: {
  diaEntrega: string | null;
  quantidadeItens: number;
  subtotalCentavos: number;
  /** `null` = endereço ainda não escolhido ou fora de área: nunca zero. */
  freteCentavos: number | null;
  distanciaKm: number | null;
  faltamParaFreteGratisCentavos: number | null;
  minutosDeReserva: number;
  processando: boolean;
  /** Texto do impedimento, quando há um. `null` libera o botão. */
  bloqueio: string | null;
  onPagar: () => void;
}) {
  const total = freteCentavos === null ? null : subtotalCentavos + freteCentavos;

  return (
    <aside className="h-fit space-y-4 lg:sticky lg:top-20">
      <div className="overflow-hidden rounded-card border border-amarelo/30 bg-superficie">
        <div className="serrilha border-b border-dashed border-borda-forte bg-amarelo/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-amarelo">Fornada</p>
          <p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight">
            {diaEntrega ? diaCurto(diaEntrega) : 'a definir'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-texto-suave">
            Assada e congelada no dia. Entrega entre 14h e 20h.
          </p>
        </div>

        <div className="px-5 py-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-texto-suave">
                {quantidadeItens} {quantidadeItens === 1 ? 'pizza' : 'pizzas'}
              </dt>
              <dd className="font-mono">{reais(subtotalCentavos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-texto-suave">
                Frete{distanciaKm !== null && ` · ${distanciaKm.toFixed(1).replace('.', ',')} km`}
              </dt>
              <dd className="font-mono">
                {freteCentavos === null ? '—' : freteCentavos === 0 ? 'grátis' : reais(freteCentavos)}
              </dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-borda pt-3">
              <dt className="font-bold">Total</dt>
              <dd className="font-mono text-xl font-extrabold">
                {total === null ? '—' : reais(total)}
              </dd>
            </div>
          </dl>

          {faltamParaFreteGratisCentavos !== null && (
            <p className="mt-2.5 font-mono text-[11px] text-texto-suave">
              faltam {reais(faltamParaFreteGratisCentavos)} para frete grátis
            </p>
          )}

          <Button className="mt-4" disabled={processando || bloqueio !== null} onClick={onPagar}>
            <Lock className="h-4 w-4" />
            {processando ? 'Abrindo pagamento…' : total === null ? 'Pagar' : `Pagar ${reais(total)}`}
          </Button>

          <p className="mt-2.5 text-center text-[11px] leading-relaxed text-texto-suave">
            {bloqueio ?? `Sua vaga na fornada fica reservada por ${minutosDeReserva} minutos.`}
          </p>
        </div>
      </div>
    </aside>
  );
}
