-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_pedidos_auditoria — A transição para `pago` passa a ser auditada (RN21).
--
-- O 0014 gravou status, pagamento e veredito, mas não deixou rastro da
-- transição: `cancelar_pedido` auditava e `confirmar_pagamento` não. A
-- assimetria é o problema — cancelamento é raro e confirmação é o caminho de
-- todo dinheiro que entra, e é justamente dele que alguém vai querer o
-- histórico quando um valor não bater.
--
-- `profile_id` é o dono do pedido, não nulo: a confirmação foi causada pelo
-- pagamento daquele cliente. `motivo` diz que a mão foi do webhook, para o
-- registro não sugerir que a pessoa clicou em algo no admin.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.confirmar_pagamento(
  p_pedido uuid,
  p_payment_id text,
  p_forma text,
  p_veredito public.veredito_viabilidade
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.status_pedido;
  v_reserva uuid;
  v_profile uuid;
begin
  select status, reserva_id, profile_id into v_status, v_reserva, v_profile
  from public.pedidos where id = p_pedido
  for update;

  if not found then
    raise exception 'Pedido % não existe.', p_pedido using errcode = 'P0002';
  end if;

  if v_status = 'pago' then
    return false;
  end if;

  update public.pedidos set
    status = 'pago',
    mp_payment_id = p_payment_id,
    forma_pagamento = p_forma,
    veredito = p_veredito,
    pago_em = now()
  where id = p_pedido;

  -- A vaga passa a ser ocupada pelo pedido; a reserva cumpriu o papel dela.
  -- Deixá-la ativa faria a vaga contar duas vezes; deixá-la viva sem consumir
  -- faria a vaga sumir quando a reserva vencesse.
  if v_reserva is not null then
    update public.reservas
      set status = 'consumida', pedido_id = p_pedido
      where id = v_reserva and status = 'ativa';
  end if;

  update public.reservas
    set status = 'consumida', pedido_id = p_pedido
    where pedido_id is null
      and status = 'ativa'
      and profile_id = v_profile
      and dia_entrega = (select dia_entrega from public.pedidos where id = p_pedido)
      and produto_id in (select produto_id from public.pedido_itens where pedido_id = p_pedido);

  -- Na mesma transação do `update`: rastro que pode faltar quando o pedido
  -- mudou não é rastro (RN21).
  insert into public.auditoria (tabela, registro_id, acao, profile_id, dados_antes, dados_depois, motivo)
  values (
    'pedidos',
    p_pedido,
    'confirmacao_pagamento',
    v_profile,
    jsonb_build_object('status', v_status),
    jsonb_build_object(
      'status', 'pago',
      'mp_payment_id', p_payment_id,
      'forma_pagamento', p_forma,
      'veredito', p_veredito
    ),
    'confirmação pelo webhook de pagamento'
  );

  return true;
end;
$$;

comment on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) is
  'Confirma o pagamento, consome a reserva e audita a transição, atômico. false = já estava pago (idempotência da RN9).';

revoke execute on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) from anon, authenticated;
