'use client';

import { MapPinOff, Plus } from 'lucide-react';
import Link from 'next/link';
import { calcularFrete, type FaixaFrete } from '@napo/core';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';
import { cn } from '@napo/ui/lib/cn';

/**
 * Escolha do endereço no checkout (RN18).
 *
 * Endereço fora de área aparece **desabilitado e com o motivo**, não escondido:
 * sumir com ele faria a pessoa cadastrar o mesmo endereço de novo achando que
 * esqueceu de salvar.
 *
 * O tipo é local de propósito — `features/pedidos` não importa de
 * `features/enderecos` (ARCHITECTURE §3.2); quem traduz é a página.
 */
export interface EnderecoDoCheckout {
  id: string;
  titulo: string;
  detalhe: string;
  distanciaKm: number | null;
  atendido: boolean;
  motivoNaoAtendido: string | null;
  padrao: boolean;
}

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SeletorEndereco({
  enderecos,
  escolhido,
  onEscolher,
  subtotalCentavos,
  faixas,
  freteGratisCentavos,
}: {
  enderecos: EnderecoDoCheckout[];
  escolhido: string | null;
  onEscolher: (id: string) => void;
  subtotalCentavos: number;
  faixas: FaixaFrete[];
  freteGratisCentavos: number;
}) {
  if (enderecos.length === 0) {
    return (
      <Card className="mt-4 p-6 text-center">
        <p className="text-sm text-texto-suave">Você ainda não tem endereço cadastrado.</p>
        <Button largura="natural" size="sm" variant="outline" className="mt-4" asChild>
          <Link href="/conta/enderecos">Cadastrar endereço</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-2.5">
      {enderecos.map((endereco) => {
        const frete = calcularFrete({
          distanciaKm: endereco.distanciaKm,
          subtotalCentavos,
          atendido: endereco.atendido,
          motivoNaoAtendido: endereco.motivoNaoAtendido,
          faixas,
          freteGratisCentavos,
        });

        // Frete `null` é fora de área, nunca zero (RN18): o card não pode
        // oferecer entrega grátis para onde a moto não vai.
        const indisponivel = frete.freteCentavos === null;
        const selecionado = escolhido === endereco.id;

        return (
          // Markup cru justificado (§4.4.5): <Card> renderiza `div`, e aqui o
          // elemento precisa ser `label` para que o card inteiro seja alvo de
          // clique do rádio. Classes visuais são as do <Card>.
          <label
            key={endereco.id}
            className={cn(
              'flex items-start gap-3 rounded-card border bg-superficie p-4',
              indisponivel
                ? 'border-borda bg-superficie/40 opacity-60'
                : 'cursor-pointer border-borda hover:border-borda-forte',
              selecionado && !indisponivel && 'border-2 border-amarelo',
            )}
          >
            <input
              type="radio"
              name="endereco"
              className="sr-only"
              checked={selecionado}
              disabled={indisponivel}
              onChange={() => onEscolher(endereco.id)}
            />
            <span
              className={cn(
                'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                selecionado && !indisponivel ? 'border-amarelo' : 'border-borda-forte',
              )}
              aria-hidden
            >
              {selecionado && !indisponivel && (
                <span className="h-2 w-2 rounded-full bg-amarelo" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className={cn('font-semibold', indisponivel && 'text-texto-suave')}>
                  {endereco.titulo}
                </span>
                {endereco.padrao && (
                  <span className="rounded-full bg-superficie-alta px-2 py-0.5 font-mono text-[10px] text-texto-suave">
                    padrão
                  </span>
                )}
              </span>
              <span className="mt-1 block text-sm text-texto-suave">{endereco.detalhe}</span>

              {indisponivel ? (
                <span className="mt-2 flex items-center gap-1.5 font-mono text-xs text-texto-suave">
                  <MapPinOff className="h-3.5 w-3.5" />
                  {endereco.distanciaKm !== null && `${km(endereco.distanciaKm)} · `}
                  {endereco.motivoNaoAtendido ?? 'ainda não entregamos aqui'}
                </span>
              ) : (
                <span className="mt-2 block font-mono text-xs text-amarelo">
                  {endereco.distanciaKm !== null && `${km(endereco.distanciaKm)} · `}
                  {frete.gratis ? 'frete grátis' : `frete ${reais(frete.freteCentavos ?? 0)}`}
                </span>
              )}
            </span>
          </label>
        );
      })}

      <Button variant="outline" size="sm" asChild>
        <Link href="/conta/enderecos">
          <Plus className="h-4 w-4" /> Cadastrar novo endereço
        </Link>
      </Button>
    </div>
  );
}

function km(distancia: number) {
  return `${distancia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}
