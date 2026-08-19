'use client';

import { Lock } from 'lucide-react';

import { Button } from '@napo/ui/components/button';

import { formatarCentavos } from '../carrinho-view';
import { formatarFornadaBreve } from '../checkout-view';

/**
 * Resumo do checkout na direção A aprovada ("ficha da fornada"): o **dia é o
 * título** do resumo, em bloco com recorte de canhoto (`.serrilha`), maior e mais
 * pesado que o total (critério visual 1) — o que o cliente compra é uma vaga numa
 * fornada, não "3 pizzas". Em telas estreitas o card flui inline e o total + o
 * botão viram **barra fixa no rodapé** (critério 8, design §4.6): total que precisa
 * de rolagem para ser visto é total que não foi lido.
 */
export interface ResumoPedidoProps {
  dia: string | null;
  pizzas: number;
  distanciaKm: number | null;
  subtotalCentavos: number;
  /** `null` até um endereço atendido ser escolhido — "a calcular", nunca R$ 0,00. */
  freteCentavos: number | null;
  totalCentavos: number | null;
  faltamFreteGratisCentavos: number | null;
  minutos: number;
  podePagar: boolean;
  pagando: boolean;
  onPagar: () => void;
}

export function ResumoPedido(props: ResumoPedidoProps) {
  const { dia, pizzas, distanciaKm, subtotalCentavos, freteCentavos, totalCentavos } = props;
  const rotuloPagar =
    totalCentavos != null ? `Pagar ${formatarCentavos(totalCentavos)}` : 'Pagar';

  return (
    <>
      <div className="overflow-hidden rounded-card border border-amarelo/30 bg-superficie">
        <div className="serrilha border-b border-dashed border-borda-forte bg-amarelo/5 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amarelo">Fornada</p>
          <p className="mt-1.5 text-2xl font-extrabold capitalize leading-none tracking-tight">
            {dia ? formatarFornadaBreve(dia) : '—'}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-texto-suave">
            Assada e congelada no dia. Entrega entre 14h e 20h.
          </p>
        </div>

        <div className="px-5 py-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-texto-suave">
                {pizzas} {pizzas === 1 ? 'pizza' : 'pizzas'}
              </dt>
              <dd className="font-mono">{formatarCentavos(subtotalCentavos)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-texto-suave">
                Frete{distanciaKm != null ? ` · ${distanciaKm.toFixed(1).replace('.', ',')} km` : ''}
              </dt>
              <dd className="font-mono">
                {freteCentavos != null ? formatarCentavos(freteCentavos) : 'a calcular'}
              </dd>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-borda pt-3">
              <dt className="font-bold">Total</dt>
              <dd className="font-mono text-xl font-extrabold">
                {totalCentavos != null ? formatarCentavos(totalCentavos) : '—'}
              </dd>
            </div>
          </dl>

          {props.faltamFreteGratisCentavos != null && (
            <p className="mt-2.5 font-mono text-[11px] text-texto-suave">
              faltam {formatarCentavos(props.faltamFreteGratisCentavos)} para frete grátis
            </p>
          )}

          <Button onClick={props.onPagar} disabled={!props.podePagar || props.pagando} className="mt-4 hidden lg:flex">
            <Lock className="h-4 w-4" /> {props.pagando ? 'Abrindo pagamento…' : rotuloPagar}
          </Button>
          <p className="mt-2.5 hidden text-center text-[11px] leading-relaxed text-texto-suave lg:block">
            Sua vaga na fornada fica reservada por {props.minutos} minutos.
          </p>
        </div>
      </div>

      {/* Barra fixa do mobile: total + botão sempre visíveis, sem rolagem (T31). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-preto/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-texto-suave">Total</p>
            <p className="font-mono text-lg font-extrabold leading-tight">
              {totalCentavos != null ? formatarCentavos(totalCentavos) : '—'}
            </p>
          </div>
          <Button onClick={props.onPagar} disabled={!props.podePagar || props.pagando} className="flex-1">
            <Lock className="h-4 w-4" /> {props.pagando ? 'Abrindo…' : 'Pagar'}
          </Button>
        </div>
      </div>
    </>
  );
}
