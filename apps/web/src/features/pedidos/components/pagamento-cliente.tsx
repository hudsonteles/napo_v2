'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Timer, TimerOff } from 'lucide-react';
import { Card } from '@napo/ui/components/card';
import { ContagemRegressiva } from '@napo/ui/components/contagem-regressiva';

import { BrickPagamento, type PagamentoEnviado } from './brick-pagamento';

/**
 * A ilha da tela de pagamento.
 *
 * O cronômetro não é enfeite: enquanto o cliente digita o cartão, o tempo
 * restante é a informação que justifica a pressa e explica a expiração sem
 * precisar de suporte. Aos 00:00 o pagamento é **retirado da tela** — deixá-lo
 * de pé seria oferecer algo que o servidor vai recusar, ou pior, aceitar sem
 * vaga.
 */

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function diaPorExtenso(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
}

export function PagamentoCliente({
  numero,
  pedidoId,
  diaEntrega,
  totalCentavos,
  expiraEm,
  emailPadrao,
}: {
  numero: number;
  pedidoId: string;
  diaEntrega: string;
  totalCentavos: number;
  expiraEm: string;
  emailPadrao: string;
}) {
  const router = useRouter();
  const [venceu, setVenceu] = useState(false);

  async function pagar(dados: PagamentoEnviado) {
    const resposta = await fetch('/api/pagamentos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pedidoId, ...dados }),
    });

    const corpo = await resposta.json().catch(() => null);

    if (resposta.ok) {
      // Quem confirma é o webhook (RN6). A tela do pedido pergunta ao servidor
      // e muda sozinha quando o dinheiro chegar.
      router.push(`/pedido/${numero}`);
      return { ok: true };
    }

    if (corpo?.error?.motivo === 'pedido_vencido') {
      setVenceu(true);
      return { ok: false };
    }

    return {
      ok: false,
      mensagem: corpo?.error?.mensagem ?? 'Não foi possível concluir. Tente de novo.',
    };
  }

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Pagamento do pedido</h1>
          <p className="mt-1 font-mono text-sm text-texto-suave">
            #{numero} · {diaPorExtenso(diaEntrega)}
          </p>
        </div>

        {!venceu && (
          <div className="flex items-center gap-2 rounded-campo border border-borda-forte bg-superficie px-3.5 py-2">
            <Timer className="h-4 w-4 text-amarelo" />
            <ContagemRegressiva ate={expiraEm} aoZerar={() => setVenceu(true)} className="text-sm font-bold" />
            <span className="text-xs text-texto-suave">sua entrega está reservada</span>
          </div>
        )}
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {venceu ? (
            <Card className="border-amarelo/50 bg-amarelo/5 p-4">
              <div className="flex gap-3">
                <TimerOff className="mt-0.5 h-5 w-5 shrink-0 text-amarelo" />
                <div className="min-w-0">
                  <p className="font-semibold">Sua entrega não está mais reservada</p>
                  <p className="mt-1 text-sm leading-relaxed text-texto-suave">
                    Passaram-se os 30 minutos e a data voltou a ficar disponível para outros
                    pedidos. Seus itens continuam no carrinho — é só recomeçar.
                  </p>
                  <Link
                    href="/carrinho"
                    className="mt-3 inline-block font-mono text-xs text-amarelo underline underline-offset-2"
                  >
                    voltar ao carrinho
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <BrickPagamento
              valorCentavos={totalCentavos}
              emailPadrao={emailPadrao}
              aoPagar={pagar}
            />
          )}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <Card className="overflow-hidden border-amarelo/30 p-0">
            <div className="serrilha border-b border-dashed border-borda-forte bg-amarelo/5 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-amarelo">Entrega</p>
              <p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight">
                {diaPorExtenso(diaEntrega)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-texto-suave">
                Chega entre 14h e 20h.
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="font-bold">Total</span>
                <span className="font-mono text-xl font-extrabold">{reais(totalCentavos)}</span>
              </div>
            </div>
          </Card>

          <Link
            href="/checkout"
            className="block text-center font-mono text-xs text-texto-suave underline underline-offset-4 hover:text-branco"
          >
            voltar e trocar o endereço
          </Link>
        </aside>
      </div>
    </>
  );
}
