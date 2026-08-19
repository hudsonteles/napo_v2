-- ─────────────────────────────────────────────────────────────────────────────
-- 0014_pedidos_funcoes — Atomicidade do checkout (NAPO-006).
--
-- ⚠️ REGRA HERDADA DO 0005, QUE CONTINUA VALENDO: nenhuma função aqui calcula
-- disponibilidade nem decide viabilidade. Os limites chegam prontos de
-- `packages/core`, e o veredito da RN11 chega pronto de `avaliarViabilidade`.
-- Acrescentar um `if` de negócio faz a regra existir em dois lugares — o risco
-- registrado em design.md §8 do NAPO-004. O que mora aqui é só o que exige
-- transação: contar sob lock, confirmar sem duplicar, devolver vaga.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- vagas_ocupadas — REESCRITA. Função compartilhada com o motor do NAPO-004.
--
-- Antes contava só reserva viva, com o comentário de que "pedidos pagos entram
-- aqui em NAPO-006". É este o momento.
--
-- Quem ocupa vaga: reserva viva OU pedido em estado que consome a fornada.
-- `aguardando_pagamento` fica de FORA de propósito — a vaga dele já está contada
-- pela reserva que o sustenta (RN7), e contar os dois cobraria a mesma vaga
-- duas vezes do estoque. `entregue` continua ocupando: a pizza saiu daquela
-- fornada. `expirado`, `cancelado` e `estornado` devolvem.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.vagas_ocupadas(p_dia date, p_produto uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select sum(quantidade) from public.reservas
    where dia_entrega = p_dia
      and produto_id = p_produto
      and status = 'ativa'
      and expira_em > now()
  ), 0)::int
  + coalesce((
    select sum(i.quantidade)
    from public.pedido_itens i
    join public.pedidos p on p.id = i.pedido_id
    where p.dia_entrega = p_dia
      and i.produto_id = p_produto
      and p.status in ('pago', 'em_producao', 'pronto', 'em_rota', 'entregue')
  ), 0)::int;
$$;

comment on function public.vagas_ocupadas(date, uuid) is
  'Vagas vivas de um produto num dia: reserva ativa + pedido que consome a fornada (RN12). Lida pelo motor do NAPO-004 — mudar aqui muda a vitrine.';

-- ─────────────────────────────────────────────────────────────────────────────
-- reservar_carrinho — generaliza `reservar_capacidade` (RN7).
--
-- Um advisory lock POR DIA para o carrinho inteiro, não um por item. Três
-- chamadas de `reservar_capacidade` em sequência reservariam parcialmente
-- quando o terceiro item não coubesse, e o desfazimento precisaria funcionar
-- exatamente no cenário em que algo já falhou. Aqui a transação desfaz.
--
-- `p_limites` chega calculado por packages/core, item a item, no mesmo contrato
-- do `p_limite` que a função antiga recebia: é o total tolerado para o dia, já
-- somado às ocupadas — não o que sobra.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reservar_carrinho(
  p_dia date,
  p_itens jsonb,
  p_profile uuid,
  p_limites jsonb,
  p_minutos int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_produto uuid;
  v_quantidade int;
  v_limite int;
  v_ocupadas int;
  v_reservas jsonb := '[]'::jsonb;
  v_reserva public.reservas;
begin
  if jsonb_array_length(p_itens) = 0 then
    raise exception 'Carrinho vazio não reserva vaga.' using errcode = '22023';
  end if;

  -- Serializa o dia inteiro uma vez só, mesma chave do 0005 para que as duas
  -- funções nunca corram em paralelo sobre a mesma fornada.
  perform pg_advisory_xact_lock(hashtext(p_dia::text));

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_produto := (v_item->>'produto_id')::uuid;
    v_quantidade := (v_item->>'quantidade')::int;

    if v_quantidade <= 0 then
      raise exception 'Quantidade da reserva deve ser positiva.' using errcode = '22023';
    end if;

    select (l->>'limite')::int into v_limite
    from jsonb_array_elements(p_limites) l
    where (l->>'produto_id')::uuid = v_produto;

    if v_limite is null then
      raise exception 'Sem limite informado para o produto %.', v_produto using errcode = '22023';
    end if;

    v_ocupadas := public.vagas_ocupadas(p_dia, v_produto);

    if v_ocupadas + v_quantidade > v_limite then
      raise exception 'Sem vaga para % em % (ocupadas %, limite %).',
        v_produto, p_dia, v_ocupadas, v_limite
        using errcode = 'P0001';
    end if;

    insert into public.reservas (profile_id, dia_entrega, produto_id, quantidade, expira_em)
    values (p_profile, p_dia, v_produto, v_quantidade, now() + make_interval(mins => p_minutos))
    returning * into v_reserva;

    v_reservas := v_reservas || jsonb_build_object(
      'id', v_reserva.id,
      'produto_id', v_reserva.produto_id,
      'quantidade', v_reserva.quantidade,
      'expira_em', v_reserva.expira_em
    );
  end loop;

  return v_reservas;
end;
$$;

comment on function public.reservar_carrinho(date, jsonb, uuid, jsonb, int) is
  'Reserva o carrinho inteiro sob um único advisory lock do dia: tudo ou nada (RN7). Limites vêm prontos de packages/core.';

revoke execute on function public.reservar_carrinho(date, jsonb, uuid, jsonb, int) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- confirmar_pagamento — o ponto onde o dinheiro vira pedido (RN9, RN11, RN12).
--
-- Devolve `false` quando o pedido já está pago: é a resposta idempotente que o
-- webhook precisa para responder 200 sem reprocessar. O índice único de
-- `mp_payment_id` é a garantia dura; este `if` é o caminho limpo.
--
-- `p_veredito` chega decidido por `avaliarViabilidade` (packages/core). Esta
-- função NÃO recusa pagamento aprovado por falta de vaga — grava o veredito e
-- confirma (RN11): dinheiro que entrou não é recusado.
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
      and profile_id = (select profile_id from public.pedidos where id = p_pedido)
      and dia_entrega = (select dia_entrega from public.pedidos where id = p_pedido)
      and produto_id in (select produto_id from public.pedido_itens where pedido_id = p_pedido);

  return true;
end;
$$;

comment on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) is
  'Confirma o pagamento e consome a reserva, atômico. false = já estava pago (idempotência da RN9).';

revoke execute on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- cancelar_pedido — devolve capacidade ou lote (RN14).
--
-- `p_devolucao` chega de `devolucaoPorCancelamento` (packages/core): antes do
-- cutoff volta vaga de forno, depois volta lote pronto. A função registra e
-- libera; NÃO decide qual dos dois é, e NÃO move dinheiro — estorno é manual no
-- painel do Mercado Pago.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cancelar_pedido(
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

  if v_status in ('cancelado', 'expirado', 'estornado') then
    return false;
  end if;

  update public.pedidos set status = 'cancelado' where id = p_pedido;

  update public.reservas set status = 'cancelada'
    where pedido_id = p_pedido and status <> 'cancelada';

  -- `lote` significa que a pizza existe e volta vendável para outro dia. Quem
  -- recoloca o lote em estoque é o NAPO-008; aqui fica o registro de que a
  -- devolução é de lote e não de capacidade.
  insert into public.auditoria (tabela, registro_id, acao, dados_antes, dados_depois)
  values ('pedidos', p_pedido, 'cancelamento',
          jsonb_build_object('status', v_status),
          jsonb_build_object('status', 'cancelado', 'devolucao', p_devolucao));

  return true;
end;
$$;

comment on function public.cancelar_pedido(uuid, text) is
  'Cancela e libera a vaga; registra se a devolução é capacidade ou lote (RN14). Não movimenta dinheiro.';

revoke execute on function public.cancelar_pedido(uuid, text) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- expirar_pedidos — carrinho abandonado devolve a vaga (RN13).
--
-- Sem `pg_cron`, mesmo critério do NAPO-004: o agendamento mora fora do banco
-- enquanto não houver ambiente publicado. Idempotente — rodar duas vezes
-- seguidas não muda nada além da primeira.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.expirar_pedidos()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expirados int;
begin
  with vencidos as (
    update public.pedidos set status = 'expirado'
    where status = 'aguardando_pagamento' and expira_em <= now()
    returning id, reserva_id
  ), liberadas as (
    update public.reservas set status = 'expirada'
    where id in (select reserva_id from vencidos where reserva_id is not null)
    returning 1
  )
  select count(*)::int into v_expirados from vencidos;

  return v_expirados;
end;
$$;

comment on function public.expirar_pedidos() is
  'Expira pedidos vencidos e libera as reservas (RN13). Idempotente; chamada por rota de manutenção.';

revoke execute on function public.expirar_pedidos() from anon, authenticated;
