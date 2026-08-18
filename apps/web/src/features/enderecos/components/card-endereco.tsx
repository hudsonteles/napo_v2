'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { calcularFrete, formatarReais, type FaixaFrete } from '@napo/core';
import { Badge } from '@napo/ui/components/badge';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@napo/ui/components/dialog';
import { toast } from '@napo/ui/components/toaster';

import type { Endereco } from '../schema';
import { formatarKm, ReguaDistancia } from './regua-distancia';

/**
 * Um endereço na lista, com a régua de faixa e as ações.
 *
 * Ilha de cliente porque desativar e tornar padrão são ações; a leitura toda
 * vem do Server Component que a renderiza. O frete exibido é a **mesma** função
 * pura do checkout (RN16) — o card não tem uma segunda régua de preço.
 */
export function CardEndereco({
  endereco,
  raioKm,
  faixas,
  freteGratisCentavos,
}: {
  endereco: Endereco;
  raioKm: number;
  faixas: FaixaFrete[];
  freteGratisCentavos: number;
}) {
  const router = useRouter();
  const [processando, iniciarTransicao] = useTransition();
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  // Subtotal zero: o card mostra quanto o frete CUSTA, não quanto sairia num
  // pedido hipotético — o desconto por R$ 150 é do carrinho, não do endereço.
  const frete = calcularFrete({
    distanciaKm: endereco.distanciaKm,
    subtotalCentavos: 0,
    atendido: endereco.atendido,
    motivoNaoAtendido: endereco.motivoNaoAtendido,
    faixas,
    freteGratisCentavos,
  });

  async function chamar(url: string, metodo: 'POST' | 'DELETE', sucesso: string) {
    const resposta = await fetch(url, { method: metodo });

    if (!resposta.ok) {
      toast.error('Não foi possível concluir. Tente de novo em instantes.');
      return;
    }

    toast.success(sucesso);
    router.refresh();
  }

  return (
    // <Card> do catálogo com override de densidade: o primitivo nasceu para o
    // cartão de auth (p-8, sombra), e a lista precisa de itens mais compactos.
    // A borda tracejada é o que diz "fora de área" sem usar vermelho de erro.
    <Card
      className={
        endereco.atendido
          ? `p-5 sm:p-6 sm:shadow-none ${endereco.padrao ? 'border-borda-forte' : ''}`
          : 'border-dashed border-borda-forte bg-superficie/40 p-5 sm:p-6 sm:shadow-none'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`text-lg font-semibold ${endereco.atendido ? '' : 'text-texto-suave'}`}
            >
              {endereco.apelido}
            </h2>
            {endereco.padrao && (
              <Badge size="sm" className="font-bold">
                PADRÃO
              </Badge>
            )}
            {endereco.distanciaEstimada && (
              <Badge variant="contorno" size="sm">
                DISTÂNCIA APROXIMADA
              </Badge>
            )}
            {!endereco.atendido && (
              <Badge variant="contorno" size="sm">
                AINDA NÃO ENTREGAMOS AÍ
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-texto-suave">
            {endereco.logradouro}
            {endereco.complemento ? ` · ${endereco.complemento}` : ''}
            {endereco.bairro ? ` — ${endereco.bairro}` : ''}
          </p>
          <p className="text-sm text-texto-suave">
            CEP {formatarCep(endereco.cep)} · {endereco.cidade}/{endereco.uf}
          </p>
        </div>

        <div className="text-right">
          {frete.foraDeArea ? (
            <>
              <p className="text-sm font-semibold text-texto-suave">fora da área</p>
              <p className="text-xs text-texto-suave">
                {endereco.distanciaKm === null ? '—' : `${formatarKm(endereco.distanciaKm)} km`}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tabular-nums">
                {formatarReais(frete.freteCentavos ?? 0)}
              </p>
              <p className="text-xs text-texto-suave">
                frete · {endereco.distanciaEstimada ? '~' : ''}
                {formatarKm(endereco.distanciaKm ?? 0)} km
              </p>
            </>
          )}
        </div>
      </div>

      <ReguaDistancia
        distanciaKm={endereco.distanciaKm}
        raioKm={raioKm}
        faixas={faixas}
        atendido={endereco.atendido}
      />

      {!endereco.atendido && (
        <p className="mt-4 text-sm text-texto-suave">
          Guardamos seu endereço: é assim que decidimos para onde a entrega cresce.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" largura="natural">
          <Link href={`/conta/enderecos/${endereco.id}`}>Editar</Link>
        </Button>

        {!endereco.padrao && endereco.atendido && (
          <Button
            variant="ghost"
            size="sm"
            largura="natural"
            disabled={processando}
            onClick={() =>
              iniciarTransicao(async () => {
                await chamar(`/api/enderecos/${endereco.id}/padrao`, 'POST', 'Endereço padrão atualizado.');
              })
            }
          >
            Tornar padrão
          </Button>
        )}

        <Dialog open={confirmandoRemocao} onOpenChange={setConfirmandoRemocao}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" largura="natural">
              Desativar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Desativar “{endereco.apelido}”?</DialogTitle>
              <DialogDescription>
                Ele some da sua conta e da escolha de entrega. Os pedidos já feitos para esse
                endereço continuam com o histórico intacto.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" size="sm" largura="natural">
                  Manter
                </Button>
              </DialogClose>
              <Button
                variant="outline"
                size="sm"
                largura="natural"
                disabled={processando}
                onClick={() =>
                  iniciarTransicao(async () => {
                    await chamar(`/api/enderecos/${endereco.id}`, 'DELETE', 'Endereço desativado.');
                    setConfirmandoRemocao(false);
                  })
                }
              >
                Desativar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}

/** "70862030" → "70862-030". A máscara é de exibição; o banco guarda oito dígitos. */
function formatarCep(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}
