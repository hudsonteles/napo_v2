-- ─────────────────────────────────────────────────────────────────────────────
-- 0017_pedido_eixo_entrega — a espinha de cobrança, parte 2 de 2 (RN3, RN4).
--
-- Contract: a casa antiga é derrubada. O pedido para de saber de dinheiro.
--
-- O `status` passava a vida misturando duas perguntas — "esse pedido foi pago?"
-- e "onde está a pizza?". Separá-las não é arrumação: é o que torna expressável
-- o pedido de balcão que ocupa vaga de forno sem ter pago nada (NAPO-026).
--
-- ⚠️ `vagas_ocupadas` é lida pelo motor do NAPO-004 e alimenta a vitrine.
-- Coberta por pgTAP em 0017_pedido_eixo_entrega.sql antes deste arquivo existir.
-- ─────────────────────────────────────────────────────────────────────────────

-- A view faz `select p.*` e por isso depende de cada coluna e do tipo do
-- status: com ela de pé, Postgres recusa tanto o drop quanto a conversão.
-- Cai primeiro e é recriada no fim, sobre o pedido já sem dinheiro.
drop view public.pedidos_com_pagamento;

-- O índice parcial tem o valor antigo no predicado e impediria a conversão.
drop index if exists public.pedidos_aguardando_expiram;

-- Cobrança aprovada é a prova agora, e ela mora em outra tabela.
alter table public.pedidos drop constraint pedidos_pago_tem_pagamento;

drop index if exists public.pedidos_mp_payment_unico;

alter table public.pedidos
  drop column mp_preference_id,
  drop column mp_payment_id,
  drop column forma_pagamento,
  drop column pago_em;

-- Postgres não remove valor de enum: o tipo é recriado e a coluna convertida
-- com mapa explícito. `pago` vira `novo` porque o pedido pago ainda não entrou
-- em produção — o que ele era no eixo do dinheiro agora se pergunta às
-- cobranças. `estornado` vira `cancelado` porque é isso que ele é do lado da
-- entrega: pedido encerrado que devolveu a vaga.
alter type public.status_pedido rename to status_pedido_ate_0016;

create type public.status_pedido as enum (
  'novo',
  'em_producao',
  'pronto',
  'em_rota',
  'entregue',
  'cancelado',
  'expirado'
);

alter table public.pedidos alter column status drop default;

alter table public.pedidos
  alter column status type public.status_pedido
  using (
    case status::text
      when 'aguardando_pagamento' then 'novo'
      when 'pago' then 'novo'
      when 'estornado' then 'cancelado'
      else status::text
    end
  )::public.status_pedido;

alter table public.pedidos alter column status set default 'novo';

comment on column public.pedidos.status is
  'Ciclo de vida da entrega, não do dinheiro (RN3). Se o pedido foi pago pergunta-se a public.situacao_pagamento().';

-- Varredura da RN13/RN19, agora sobre o vocabulário novo.
create index pedidos_aguardando_expiram on public.pedidos (expira_em)
  where status = 'novo';

-- ─────────────────────────────────────────────────────────────────────────────
-- reservas.pedido_id passa a ser preenchido no nascimento do pedido, não na
-- confirmação. É o vínculo que desempata a contagem: sem ele, `vagas_ocupadas`
-- precisaria adivinhar quais reservas soltas pertencem a qual pedido — que é o
-- que a antiga fazia por perfil, dia e produto, e só funcionava porque pedido
-- não pago ficava fora da soma.
-- ─────────────────────────────────────────────────────────────────────────────
update public.reservas r
   set pedido_id = p.id
  from public.pedidos p
 where p.reserva_id = r.id and r.pedido_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- vagas_ocupadas — REESCRITA (RN4).
--
-- Ocupa vaga: reserva ativa ainda não amarrada a um pedido (carrinho no ar) e
-- pedido não encerrado, seja lá o que tenha acontecido com o dinheiro dele.
-- A função deixa de conhecer o vocabulário de pagamento — e fica mais simples
-- do que era.
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
      and pedido_id is null
      and expira_em > now()
  ), 0)::int
  + coalesce((
    select sum(i.quantidade)
    from public.pedido_itens i
    join public.pedidos p on p.id = i.pedido_id
    where p.dia_entrega = p_dia
      and i.produto_id = p_produto
      and p.status not in ('cancelado', 'expirado')
  ), 0)::int;
$$;

comment on function public.vagas_ocupadas(date, uuid) is
  'Vagas vivas de um produto num dia: carrinho no ar + pedido não encerrado (RN4). Lida pelo motor do NAPO-004 — mudar aqui muda a vitrine.';

-- ─────────────────────────────────────────────────────────────────────────────
-- confirmar_pagamento — agora aprova a COBRANÇA, não o pedido (RN2, RN16).
--
-- O que continua igual: é atômico, devolve `false` quando não havia o que
-- confirmar (idempotência que o webhook usa para responder 200 sem
-- reprocessar), grava o veredito da RN11 e não recusa dinheiro que entrou.
-- O que muda: não existe mais `status = 'pago'` para escrever.
-- ─────────────────────────────────────────────────────────────────────────────
-- `create or replace` recusa renomear parâmetro (42P13), e o primeiro argumento
-- deixa de ser o pedido para ser a cobrança. A assinatura de tipos é a mesma,
-- então o drop é obrigatório.
drop function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade);

create function public.confirmar_pagamento(
  p_cobranca uuid,
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
  v_situacao public.cobranca_situacao;
  v_pedido uuid;
  v_profile uuid;
  v_antes public.situacao_pagamento_pedido;
begin
  select situacao, pedido_id into v_situacao, v_pedido
  from public.cobrancas where id = p_cobranca
  for update;

  if not found then
    raise exception 'Cobrança % não existe.', p_cobranca using errcode = 'P0002';
  end if;

  if v_situacao = 'aprovada' then
    return false;
  end if;

  select profile_id into v_profile from public.pedidos where id = v_pedido;
  v_antes := public.situacao_pagamento(v_pedido);

  update public.cobrancas set
    situacao = 'aprovada',
    mp_payment_id = p_payment_id,
    forma = p_forma,
    aprovada_em = now()
  where id = p_cobranca;

  update public.pedidos set veredito = p_veredito where id = v_pedido;

  -- A reserva cumpriu o papel: quem ocupa a vaga daqui em diante é o pedido.
  update public.reservas
    set status = 'consumida'
    where pedido_id = v_pedido and status = 'ativa';

  -- RN21, herdada da 0015: a confirmação é o caminho de todo dinheiro que
  -- entra, e é dela que alguém vai querer o histórico quando um valor não
  -- bater. Na mesma transação — rastro que pode faltar não é rastro. O registro
  -- continua indexado pelo PEDIDO, que é por onde se procura.
  insert into public.auditoria (tabela, registro_id, acao, profile_id, dados_antes, dados_depois, motivo)
  values (
    'pedidos',
    v_pedido,
    'confirmacao_pagamento',
    v_profile,
    jsonb_build_object('situacao_pagamento', v_antes),
    jsonb_build_object(
      'situacao_pagamento', public.situacao_pagamento(v_pedido),
      'cobranca_id', p_cobranca,
      'mp_payment_id', p_payment_id,
      'forma', p_forma,
      'veredito', p_veredito
    ),
    'confirmação pelo webhook de pagamento'
  );

  return true;
end;
$$;

comment on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) is
  'Aprova a cobrança e consome a reserva, atômico. false = já estava aprovada (idempotência da RN16).';

revoke execute on function public.confirmar_pagamento(uuid, text, text, public.veredito_viabilidade) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- cancelar_pedido — sem `estornado` no eixo de entrega (RN14).
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

  if v_status in ('cancelado', 'expirado') then
    return false;
  end if;

  update public.pedidos set status = 'cancelado' where id = p_pedido;

  update public.reservas set status = 'cancelada'
    where pedido_id = p_pedido and status <> 'cancelada';

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
-- O critério deixa de ser o status e passa a ser a derivação: expira o pedido
-- vencido que não tem dinheiro nenhum. Pedido vencido **pago** não é varrido —
-- dinheiro que entrou não é recusado (RN18), e quem resolve o dia inviável é a
-- casa, por telefone. A cobrança que estava de pé vence junto, um relógio só.
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
    update public.pedidos p set status = 'expirado'
    where p.status = 'novo'
      and p.expira_em <= now()
      and public.situacao_pagamento(p.id) = 'sem_pagamento'
    returning p.id
  ), cobrancas_mortas as (
    update public.cobrancas c set situacao = 'expirada'
    where c.pedido_id in (select id from vencidos) and c.situacao = 'pendente'
    returning 1
  ), liberadas as (
    update public.reservas r set status = 'expirada'
    where r.pedido_id in (select id from vencidos) and r.status = 'ativa'
    returning 1
  )
  select count(*)::int into v_expirados from vencidos;

  return v_expirados;
end;
$$;

comment on function public.expirar_pedidos() is
  'Expira pedidos vencidos sem pagamento e libera reservas e cobranças (RN13). Idempotente; chamada por rota de manutenção.';

revoke execute on function public.expirar_pedidos() from anon, authenticated;

create view public.pedidos_com_pagamento with (security_invoker = on) as
select p.*, public.situacao_pagamento(p.id) as situacao_pagamento
from public.pedidos p;

revoke all on public.pedidos_com_pagamento from anon, authenticated;
grant select on public.pedidos_com_pagamento to service_role;

drop type public.status_pedido_ate_0016;
