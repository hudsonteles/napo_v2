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

          {/* Abaixo de lg o botão vive na barra fixa do rodapé (design §4.6):
              total que precisa de rolagem para ser visto é total que não foi
              lido. Duas instâncias, um só handler. */}
          <div className="hidden lg:block">
            <BotaoPagar
              className="mt-4"
              processando={processando}
              bloqueio={bloqueio}
              total={total}
              onPagar={onPagar}
            />
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-texto-suave">
              {bloqueio ?? `Sua vaga na fornada fica reservada por ${minutosDeReserva} minutos.`}
            </p>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-preto/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-texto-suave">Total</p>
            <p className="font-mono text-lg font-extrabold leading-tight">
              {total === null ? '—' : reais(total)}
            </p>
          </div>
          <BotaoPagar
            className="flex-1"
            processando={processando}
            bloqueio={bloqueio}
            total={total}
            onPagar={onPagar}
            compacto
          />
        </div>
      </div>

      {/* Espaço para a barra fixa não cobrir o fim do conteúdo. */}
      <div className="h-20 lg:hidden" aria-hidden />
    </aside>
  );
}

function BotaoPagar({
  processando,
  bloqueio,
  total,
  onPagar,
  className,
  compacto = false,
}: {
  processando: boolean;
  bloqueio: string | null;
  total: number | null;
  onPagar: () => void;
  className?: string;
  compacto?: boolean;
}) {
  return (
    <Button className={className} disabled={processando || bloqueio !== null} onClick={onPagar}>
      <Lock className="h-4 w-4" />
      {processando
        ? 'Abrindo pagamento…'
        : compacto || total === null
          ? 'Pagar'
          : `Pagar ${reais(total)}`}
    </Button>
  );
}
