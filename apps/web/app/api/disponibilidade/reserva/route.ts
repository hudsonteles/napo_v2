import { NextResponse } from 'next/server';
import { z } from 'zod';

import { calcularDisponibilidade } from '@napo/core';

import { carregarSnapshot, createSupabaseAdminClient } from '@/features/disponibilidade';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Note o que o schema NÃO aceita: `limite`. Ele é calculado no servidor a
 * partir do núcleo — um limite vindo do browser seria a vaga sendo definida
 * por quem quer ocupá-la (RN11).
 */
const corpoSchema = z.object({
  diaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  produtoId: z.string().uuid(),
  quantidade: z.number().int().positive(),
  ehMassa: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'É preciso estar autenticado para reservar.' },
      { status: 401 },
    );
  }

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos.' }, { status: 400 });
  }

  const { diaEntrega, produtoId, quantidade, ehMassa } = corpo.data;

  const snapshot = await carregarSnapshot([{ id: produtoId, ehMassa }]);
  const dia = calcularDisponibilidade(snapshot).find((d) => d.data === diaEntrega);

  if (!dia) {
    return NextResponse.json(
      { success: false, error: 'Esta data não está disponível para entrega.' },
      { status: 409 },
    );
  }

  // O limite sai do núcleo e é somado às reservas vivas, que a RPC já conta:
  // é o total tolerado para o dia, não o que sobra.
  const disponivel = dia.produtos.find((p) => p.produtoId === produtoId)?.disponivel ?? 0;
  const ocupadas = snapshot.consumos
    .filter((c) => c.diaEntrega === diaEntrega && c.produtoId === produtoId)
    .reduce((total, c) => total + c.quantidade, 0);

  // Uma reserva de item único pela função do carrinho: um só advisory lock por
  // dia para toda a operação de reserva do sistema, em vez de duas funções
  // tomando o mesmo lock por caminhos diferentes (design §5, decisão 3).
  const { data, error } = await createSupabaseAdminClient().rpc('reservar_carrinho', {
    p_dia: diaEntrega,
    p_itens: [{ produto_id: produtoId, quantidade }],
    p_profile: user.id,
    p_limites: [{ produto_id: produtoId, limite: disponivel + ocupadas }],
    p_minutos: snapshot.config.reservaMinutos,
  });

  if (error) {
    // A recusa por falta de vaga chega antes de qualquer cobrança — é o ponto
    // inteiro da reserva (RN11).
    return NextResponse.json(
      { success: false, error: 'Não há mais vaga para esta data.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data });
}
