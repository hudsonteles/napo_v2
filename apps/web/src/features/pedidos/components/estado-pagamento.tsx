'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Flame, LoaderCircle, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';

import { useCarrinho } from '@/lib/carrinho/provider';

/**
 * O retorno do pagamento (RN8, RN19).
 *
 * Quem confirma é o webhook, nunca o navegador: esta tela **pergunta ao
 * servidor** e mostra o que ele responder. A consulta tem espaçamento crescente
 * e um teto — a confirmação normal chega em segundos, e insistir para sempre é
 * aquecer servidor à toa quando o pagamento simplesmente não foi feito.
 */

const ESPERAS_MS = [2_000, 3_000, 5_000, 8_000, 13_000, 21_000];

/** Estados em que o dinheiro entrou: a sacola virou pedido. */
const PAGOS = ['pago', 'em_producao', 'pronto', 'em_rota', 'entregue'];

export interface PedidoNaTela {
  numero: number;
  status: string;
  diaEntrega: string;
  totalCentavos: number;
}

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function diaPorExtenso(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function EstadoPagamento({ inicial }: { inicial: PedidoNaTela }) {
  const [pedido, setPedido] = useState(inicial);
  const [desistiu, setDesistiu] = useState(false);
  const tentativa = useRef(0);
  const { limpar } = useCarrinho();

  /**
   * A sacola só é esvaziada quando o pagamento confirma — nunca ao criar o
   * pedido. Cobrança não paga expira em 30 minutos, e a microcopy da RN13
   * promete que "seus itens continuam no carrinho": limpar antes transformaria
   * uma desistência no meio do gateway em carrinho perdido.
   */
  useEffect(() => {
    if (PAGOS.includes(pedido.status)) limpar();
    // `limpar` muda a cada render do provider; o gatilho é o status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido.status]);

  useEffect(() => {
    if (pedido.status !== 'aguardando_pagamento') return;

    const espera = ESPERAS_MS[tentativa.current];

    if (espera === undefined) {
      setDesistiu(true);
      return;
    }

    const timer = setTimeout(async () => {
      tentativa.current += 1;

      try {
        const resposta = await fetch(`/api/pedidos/${pedido.numero}`);
        const corpo = await resposta.json();
        if (corpo?.success) setPedido(corpo.data);
        else setDesistiu(true);
      } catch {
        // Rede instável não é motivo para dizer "não pago": a próxima tentativa
        // resolve, e o teto encerra sozinho.
        setPedido((atual) => ({ ...atual }));
      }
    }, espera);

    return () => clearTimeout(timer);
  }, [pedido]);

  if (pedido.status === 'aguardando_pagamento') {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          {!desistiu && <LoaderCircle className="h-5 w-5 animate-spin text-amarelo" />}
          <h1 className="text-lg font-bold">
            {desistiu ? 'Não conseguimos confirmar ainda' : 'Confirmando seu pagamento'}
          </h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-texto-suave">
          {desistiu
            ? 'Se você já pagou, o pedido é confirmado assim que a notificação chegar. Fale com a gente no WhatsApp se precisar de ajuda.'
            : 'Pode fechar esta página — o pedido continua valendo. Assim que o Mercado Pago confirmar, ele aparece aqui e na sua conta.'}
        </p>
        <p className="mt-4 font-mono text-xs text-texto-suave">
          Pedido #{pedido.numero} · {reais(pedido.totalCentavos)}
        </p>

        <SaidasDoPedido />
      </Card>
    );
  }

  const pago = PAGOS.includes(pedido.status);

  return (
    <Card className="border-amarelo/30 p-6">
      <div className="flex items-center gap-3">
        {pago && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amarelo">
            <Check className="h-5 w-5 text-preto" />
          </span>
        )}
        <div>
          <h1 className="text-lg font-bold leading-tight">
            {pago ? 'Pedido confirmado' : rotuloDeEncerramento(pedido.status)}
          </h1>
          <p className="font-mono text-xs text-texto-suave">#{pedido.numero}</p>
        </div>
      </div>

      {pago && (
        <div className="mt-5 rounded-campo border border-borda-forte bg-superficie-alta p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-texto-suave">
            Sua fornada
          </p>
          <p className="mt-1 text-xl font-extrabold tracking-tight">
            {diaPorExtenso(pedido.diaEntrega)}
          </p>
          <p className="mt-1.5 text-xs text-texto-suave">entre 14h e 20h</p>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <span className="rounded-full bg-amarelo/15 px-2.5 py-1 font-mono text-[11px] font-bold text-amarelo">
          {rotuloDeStatus(pedido.status)}
        </span>
      </div>

      <dl className="mt-5 space-y-1.5 border-t border-borda pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="font-bold">Total</dt>
          <dd className="font-mono font-extrabold">{reais(pedido.totalCentavos)}</dd>
        </div>
      </dl>

      <SaidasDoPedido />

      {pago && <ConviteEventos />}
    </Card>
  );
}

/**
 * Toda tela precisa de saída, e a de pedido fechado precisa das **úteis**.
 *
 * "Como aquecer" vem primeiro de propósito: quem acabou de comprar congelada
 * vai precisar dessa informação antes de precisar de qualquer outra, e é ela
 * que decide se a pizza chega boa à mesa — a compra seguinte depende disso mais
 * do que de qualquer botão de vitrine.
 */
function SaidasDoPedido() {
  return (
    <div className="mt-6 flex flex-wrap gap-2 border-t border-borda pt-5">
      <Button largura="natural" size="sm" variant="outline" asChild>
        <Link href="/como-aquecer">
          <Flame className="h-4 w-4" /> Como aquecer
        </Link>
      </Button>
      <Button largura="natural" size="sm" variant="outline" asChild>
        <Link href="/conta/pedidos">
          <ReceiptText className="h-4 w-4" /> Meus pedidos
        </Link>
      </Button>
      <Button largura="natural" size="sm" variant="ghost" asChild>
        <Link href="/sabores">
          Ver as pizzas <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

/**
 * O cross-sell da casa, e não uma promoção genérica.
 *
 * Quem acabou de comprar é o lead mais qualificado que existe para evento — o
 * ticket é ordens de grandeza maior que o da congelada, e a porta de entrada
 * (`/eventos`) já existe desde o NAPO-003. Aparece só depois de confirmado:
 * oferecer outra coisa a quem ainda espera a confirmação é ruído em cima de
 * ansiedade.
 */
function ConviteEventos() {
  return (
    <Link
      href="/eventos"
      className="mt-4 flex items-center gap-3 rounded-campo border border-borda bg-superficie-alta p-4 transition hover:border-amarelo/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Vai receber gente em casa?</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-texto-suave">
          A Napo leva o forno de pedra e assa na hora, de 10 a 100 pessoas.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-amarelo" />
    </Link>
  );
}

function rotuloDeStatus(status: string): string {
  const rotulos: Record<string, string> = {
    pago: 'pago',
    em_producao: 'em produção',
    pronto: 'pronto',
    em_rota: 'em rota',
    entregue: 'entregue',
    cancelado: 'cancelado',
    expirado: 'expirado',
    estornado: 'estornado',
  };
  return rotulos[status] ?? status;
}

function rotuloDeEncerramento(status: string): string {
  if (status === 'expirado') return 'O prazo de pagamento venceu';
  if (status === 'cancelado') return 'Pedido cancelado';
  if (status === 'estornado') return 'Pagamento estornado';
  return 'Pedido';
}
