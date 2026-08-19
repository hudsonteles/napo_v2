'use client';

import Link from 'next/link';
import { MapPinOff, Plus } from 'lucide-react';

import { Badge } from '@napo/ui/components/badge';
import { cn } from '@napo/ui/lib/cn';

import { formatarCentavos } from '../carrinho-view';
import type { EnderecoParaCheckout } from '../checkout-view';

/**
 * Escolha do endereço no checkout (RN18). Endereço fora de área aparece
 * **visível e desabilitado, com o motivo** — nunca escondido da lista (critério
 * visual 4): esconder faria o cliente procurar um endereço que existe e não
 * entender por que sumiu. O `<CardEndereco>` da conta não serve porque não tem
 * estado de seleção; este é o radio próprio do checkout (contrato §A do preview).
 */
export function SeletorEndereco({
  enderecos,
  selecionadoId,
  onSelecionar,
  freteSelecionadoCentavos,
}: {
  enderecos: EnderecoParaCheckout[];
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  freteSelecionadoCentavos: number | null;
}) {
  return (
    <div className="mt-4 space-y-2.5">
      {enderecos.map((endereco) =>
        endereco.atendido ? (
          <label
            key={endereco.id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-card border bg-superficie p-4 transition',
              endereco.id === selecionadoId
                ? 'border-2 border-amarelo'
                : 'border border-borda hover:border-borda-forte',
            )}
          >
            <input
              type="radio"
              name="endereco"
              className="sr-only"
              checked={endereco.id === selecionadoId}
              onChange={() => onSelecionar(endereco.id)}
            />
            <span
              className={cn(
                'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                endereco.id === selecionadoId ? 'border-amarelo' : 'border-borda-forte',
              )}
              aria-hidden
            >
              {endereco.id === selecionadoId && <span className="h-2 w-2 rounded-full bg-amarelo" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{titulo(endereco)}</span>
                {endereco.padrao && (
                  <Badge variant="neutro" size="sm" className="font-mono">
                    padrão
                  </Badge>
                )}
              </span>
              <span className="mt-1 block text-sm text-texto-suave">{linhaLocalidade(endereco)}</span>
              {endereco.id === selecionadoId && (
                <span className="mt-2 block font-mono text-xs text-amarelo">
                  {formatarKm(endereco.distanciaKm)}
                  {freteSelecionadoCentavos != null
                    ? ` · frete ${formatarCentavos(freteSelecionadoCentavos)}`
                    : ''}
                </span>
              )}
            </span>
          </label>
        ) : (
          <div
            key={endereco.id}
            className="flex items-start gap-3 rounded-card border border-borda bg-superficie/40 p-4 opacity-60"
          >
            <span className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-borda-forte" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-texto-suave">{titulo(endereco)}</p>
              <p className="mt-1 text-sm text-texto-suave">{linhaLocalidade(endereco)}</p>
              <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-texto-suave">
                <MapPinOff className="h-3.5 w-3.5" />
                {endereco.distanciaKm != null ? `${formatarKm(endereco.distanciaKm)} · ` : ''}
                {endereco.motivoNaoAtendido ?? 'ainda não entregamos aqui'}
              </p>
            </div>
          </div>
        ),
      )}

      <Link
        href="/conta/enderecos/novo"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-campo border border-borda-forte text-sm font-medium transition hover:bg-superficie-alta"
      >
        <Plus className="h-4 w-4" /> Cadastrar novo endereço
      </Link>
    </div>
  );
}

function titulo(e: EnderecoParaCheckout): string {
  return e.complemento ? `${e.logradouro} · ${e.complemento}` : e.logradouro;
}

function linhaLocalidade(e: EnderecoParaCheckout): string {
  const local = [e.bairro, e.cidade].filter(Boolean).join(', ');
  return `${local} · ${formatarCep(e.cep)}`;
}

function formatarKm(km: number | null): string {
  if (km == null) return '';
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function formatarCep(cep: string): string {
  const so = cep.replace(/\D/g, '');
  return so.length === 8 ? `${so.slice(0, 5)}-${so.slice(5)}` : cep;
}
