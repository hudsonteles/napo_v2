'use client';

import { Lock } from 'lucide-react';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';

/**
 * A ficha da entrega (Direção A, aprovada no Gate Visual A do NAPO-006).
 *
 * O dia é o **título** do resumo, não uma linha entre subtotal e frete: o que o
 * cliente compra não é "3 pizzas", é a entrega de um dia específico.
 *
 * O rótulo deixou de dizer "fornada" no NAPO-025 (spec §7): a palavra continua
 * onde explica a escassez — vitrine, barra, seletor —, mas o cliente não guarda
 * um lugar numa assadeira, ele guarda a entrega de sexta.
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
      {/* `p-0`: o padding é por faixa (canhoto e corpo têm o seu), não do card. */}
      <Card className="overflow-hidden border-amarelo/30 p-0">
        <div className="serrilha border-b border-dashed border-borda-forte bg-amarelo/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-amarelo">Entrega</p>
          <p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight">
            {diaEntrega ? diaCurto(diaEntrega) : 'a definir'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-texto-suave">
            Assada e congelada no dia. Chega entre 14h e 20h.
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
              {bloqueio ?? textoDaReserva(diaEntrega, minutosDeReserva)}
            </p>
          </div>
        </div>
      </Card>

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
        ? 'Reservando…'
        : compacto || total === null
          ? 'Reservar'
          : `Reservar e pagar ${reais(total)}`}
    </Button>
  );
}

/**
 * O botão promete o que faz: este clique guarda a entrega, o pagamento é na
 * próxima tela. "Pagar" mentia sobre onde o dinheiro sai.
 */
function textoDaReserva(diaEntrega: string | null, minutos: number): string {
  if (!diaEntrega) return `Sua entrega fica reservada por ${minutos} minutos.`;

  const diaSemana = new Date(`${diaEntrega}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
  });

  return `Sua entrega de ${diaSemana} fica reservada por ${minutos} minutos.`;
}
