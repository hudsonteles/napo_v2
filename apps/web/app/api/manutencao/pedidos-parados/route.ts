import { NextResponse } from 'next/server';

import { avaliarViabilidade, devolucaoPorCancelamento } from '@napo/core';

import { carregarSnapshot } from '@/features/disponibilidade';
import {
  dependenciasDaConfirmacao,
  reconciliarPedido,
  repositorioDePedidos,
} from '@/features/pedidos';
import { getPagamentoEnv } from '@/lib/env';
import { portaDePagamento } from '@/lib/pagamentos/porta';

export const dynamic = 'force-dynamic';

/**
 * Varredura da RN13 + RN19, protegida por segredo em header: quem chama é
 * agendador, não pessoa.
 *
 * A ordem importa — **reconsulta antes de expirar**. Expirar primeiro devolveria
 * a vaga de um pedido que já foi pago e cuja notificação só se perdeu no
 * caminho. Enquanto não há ambiente publicado (NAPO-021), a rota é chamada à
 * mão; depois vira Vercel Cron sem mudar código.
 */
export async function POST(request: Request) {
  const { MANUTENCAO_SECRET } = getPagamentoEnv();
  const oferecido = request.headers.get('x-manutencao-secret');

  // Segredo ausente na configuração recusa tudo: rota de manutenção sem
  // proteção é pior que rota de manutenção indisponível.
  if (!MANUTENCAO_SECRET || oferecido !== MANUTENCAO_SECRET) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const repo = repositorioDePedidos();
  const deps = dependenciasDaConfirmacao(repo, portaDePagamento(), {
    carregarSnapshot,
    avaliarViabilidade,
    devolucaoPorCancelamento,
  });

  const parados = await repo.pedidosVencidos();
  const resultados = [];

  for (const pedido of parados) {
    resultados.push(await reconciliarPedido(pedido, deps));
  }

  const expirados = await repo.expirarPedidos();

  return NextResponse.json({
    success: true,
    data: {
      reconsultados: parados.length,
      confirmados: resultados.filter((r) => r.resultado === 'confirmado').length,
      expirados,
    },
  });
}
