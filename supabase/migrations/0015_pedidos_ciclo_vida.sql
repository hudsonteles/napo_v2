-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_pedidos_ciclo_vida — auditoria da confirmação (RN21/T28) e estorno (RN14/T39).
--
-- Aditivo sobre o 0014, de propósito: migration aplicada não se reescreve (design
-- §2.4 fixa estratégia aditiva, e os hooks de sincronia do NAPO-004 degradam
-- quando detectam migration reescrita). `create or replace` de confirmar_pagamento
-- acrescenta o registro de auditoria da transição aguardando→pago; estornar_pedido
-- dá destino à notificação de estorno/chargeback. Ambos completam o ciclo de vida
-- que o webhook do NAPO-006 (bloco H) consome — o 0014 entregou a atomicidade,
-- o bloco H acrescenta o rastro (RN21) e o estado terminal de estorno (RN14).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- confirmar_pagamento — agora AUDITA a transição (RN21, T28).
--
-- Idêntica à do 0014, mais um insert em `auditoria` na mesma transação da
-- mudança. `profile_id` fica nulo: quem confirma é o webhook, sem sessão — o
-- autor é o sistema, e a coluna já nasce nulável exatamente para isto (0006).
-- A auditoria só é escrita por função SECURITY DEFINER (0006), então este é o
-- único lugar de onde o rastro da confirmação pode sair.
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
begin
  select status, reserva_id into v_status, v_reserva
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
  if v_reserva is not null then
    update public.reservas
      set status = 'consumida', pedido_id = p_pedido
      where id = v_reserva and status = 'ativa';
  end if;

  update public.reservas
    set status = 'consumida', pedido_id = p_pedido
    where pedido_id is null
      and status = 'ativa'
      and profile_id = (select profile_id from public.pedidos where id = p_pedido)
      and dia_entrega = (select dia_entrega from public.pedidos where id = p_pedido)
      and produto_id in (select produto_id from public.pedido_itens where pedido_id = p_pedido);

  -- RN21: o rastro da transição, na mesma transação da mudança. Autor nulo = o
  -- webhook (sistema); o veredito acompanha porque é o que dispara o alerta da
  -- RN11 quando o dinheiro entrou num dia que deixou de ser viável.
  insert into public.auditoria (tabela, registro_id, acao, dados_antes, dados_depois)
  values ('pedidos', p_pedido, 'confirmacao_pagamento',
          jsonb_build_object('status', v_status),
          jsonb_build_object('status', 'pago', 'mp_payment_id', p_payment_id, 'veredito', p_veredito));

  return true;
end;
$$;

comment on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) is
  'Confirma o pagamento, consome a reserva e audita a transição, atômico. false = já estava pago (idempotência da RN9).';

revoke execute on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- estornar_pedido — estorno e chargeback notificados (RN14, T39).
--
-- Espelha cancelar_pedido, mas o estado terminal é `estornado`, não `cancelado`:
-- um é decisão do cliente, o outro chega de fora por notificação verificada e
-- precisa de destino próprio (design §2.1). Não move dinheiro — o estorno já
-- aconteceu no Mercado Pago; aqui só refletimos o estado e registramos a
-- devolução (capacidade ou lote, decidida por packages/core). A vaga volta
-- sozinha: `estornado` não está na lista de `vagas_ocupadas`.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.estornar_pedido(
  p_pedido uuid,
  p_devolucao text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.status_pedido;
begin
  select status into v_status from public.pedidos where id = p_pedido for update;

  if not found then
    raise exception 'Pedido % não existe.', p_pedido using errcode = 'P0002';
  end if;

  -- Idempotente: estorno repetido (o Mercado Pago reenvia) não reprocessa.
  if v_status in ('estornado', 'cancelado', 'expirado') then
    return false;
  end if;

  update public.pedidos set status = 'estornado' where id = p_pedido;

  update public.reservas set status = 'cancelada'
    where pedido_id = p_pedido and status <> 'cancelada';

  insert into public.auditoria (tabela, registro_id, acao, dados_antes, dados_depois)
  values ('pedidos', p_pedido, 'estorno',
          jsonb_build_object('status', v_status),
          jsonb_build_object('status', 'estornado', 'devolucao', p_devolucao));

  return true;
end;
$$;

comment on function public.estornar_pedido(uuid, text) is
  'Reflete estorno/chargeback notificado: status estornado, devolução registrada, auditado (RN14). Não movimenta dinheiro.';

revoke execute on function public.estornar_pedido(uuid, text) from anon, authenticated;
