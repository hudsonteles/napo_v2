-- ─────────────────────────────────────────────────────────────────────────────
-- 0016_cobrancas — a espinha de cobrança, parte 1 de 2 (NAPO-025, RN1–RN2, RN7).
--
-- Expand: a casa nova é construída e o dado se muda. A 0017 derruba a antiga.
-- Rodar as duas como uma só significaria que uma falha no meio deixa a tabela
-- sem para onde voltar.
--
-- O que muda de fundo: pagamento deixa de ser um punhado de campos no pedido e
-- vira entidade. Um pedido tem 0..n cobranças — zero quando o pagamento é na
-- entrega e ainda não começou, várias quando o cartão recusou e o cliente
-- tentou de novo. A segunda tentativa é o caso comum, não a exceção.
-- ─────────────────────────────────────────────────────────────────────────────

-- `point` já nasce no vocabulário mesmo entrando só no NAPO-027: valor de enum
-- é barato de acrescentar e caro de remover, e a conciliação vai ler cobrança
-- de maquininha gravada antes de existir tela para ela.
create type public.cobranca_instrumento as enum ('online', 'pix_qr', 'link', 'dinheiro', 'point');

create type public.cobranca_situacao as enum ('pendente', 'aprovada', 'recusada', 'expirada', 'estornada');

create type public.situacao_pagamento_pedido as enum (
  'sem_pagamento',
  'aguardando',
  'parcial',
  'pago',
  'estornado'
);

-- Momento é parte do contrato do pedido, não preferência de tela. Nasce agora
-- com todos os valores para o NAPO-026 não precisar de backfill; o R1 só
-- exercita `antecipado`. Mesmo padrão já usado com `atividade_fiscal` (0013).
create type public.momento_pagamento as enum ('antecipado', 'no_ato', 'na_entrega', 'a_combinar');

alter table public.pedidos
  add column momento_pagamento public.momento_pagamento not null default 'antecipado';

create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,

  instrumento public.cobranca_instrumento not null,
  situacao public.cobranca_situacao not null default 'pendente',
  valor_centavos int not null check (valor_centavos > 0),

  -- NULL quando quem cobrou foi o próprio cliente no site.
  criada_por uuid references public.profiles (id),
  -- Dinheiro não tem gateway: a confirmação é declaração de alguém, e esse
  -- alguém precisa ter nome para o acerto do vendedor ser possível (RN7).
  operador_id uuid references public.profiles (id),

  mp_payment_id text,
  -- O motivo cru da recusa fica para auditoria e conciliação. A tela nunca o
  -- exibe: o cliente lê a nossa mensagem por família de motivo (RN13).
  mp_status_detail text,
  forma text,

  -- Mesmo instante do vencimento da reserva do pedido (RN11). Copiado no
  -- insert e não recalculado: a cobrança sabe quando morre sem consultar o
  -- pedido a cada leitura. NULL para instrumento que não vence sozinho.
  expira_em timestamptz,
  aprovada_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cobrancas_dinheiro_tem_operador
    check (instrumento <> 'dinheiro' or situacao <> 'aprovada' or operador_id is not null),
  -- Cobrança aprovada sem prova de pagamento é o mesmo buraco que a
  -- `pedidos_pago_tem_pagamento` fechava, deslocado para a entidade certa.
  constraint cobrancas_aprovada_tem_rastro
    check (situacao <> 'aprovada' or instrumento = 'dinheiro' or mp_payment_id is not null)
);

comment on table public.cobrancas is
  'Tentativa de receber um valor de um pedido (NAPO-025). A situação de pagamento do pedido é derivada daqui, nunca gravada (RN2).';

create trigger trg_cobrancas_updated_at
  before update on public.cobrancas
  for each row execute function public.set_updated_at();

-- Índice da chave estrangeira e da agregação da derivação, na mesma linha: toda
-- leitura de pedido passa por aqui.
create index cobrancas_do_pedido on public.cobrancas (pedido_id, situacao);

-- Idempotência da confirmação (RN16), migrada de `pedidos`: o identificador é
-- do pagamento, não do pedido. Duas notificações simultâneas viram violação de
-- restrição, não dois consumos de capacidade.
create unique index cobrancas_mp_payment_unico
  on public.cobrancas (mp_payment_id) where mp_payment_id is not null;

-- RN10 aplicada pelo banco: duplo clique, retry de rede ou reenvio do
-- formulário não viram duas cobranças. O serviço captura a violação e devolve a
-- que já existe. Só depois de a primeira virar `recusada` é que a próxima cabe.
create unique index cobrancas_uma_pendente_por_pedido
  on public.cobrancas (pedido_id) where situacao = 'pendente';

-- Varredura de vencimento; parcial para não ler cobrança já resolvida.
create index cobrancas_pendentes_vencendo
  on public.cobrancas (expira_em) where situacao = 'pendente';

-- Sem índice em `criada_por` e `operador_id` de propósito: nenhuma consulta do
-- R1 filtra por eles, não há cascade, e o acerto por operador é NAPO-026 — que
-- é quem vai saber a forma real da consulta.

-- ─────────────────────────────────────────────────────────────────────────────
-- A derivação (RN2)
--
-- Não existe caminho no sistema que "marque o pedido como pago": ele está pago
-- porque tem cobrança aprovada que cobre o total. Campo mantido por trigger
-- seria o mesmo esquecimento com outro culpado.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.situacao_pagamento(p_pedido_id uuid)
returns public.situacao_pagamento_pedido
language sql
stable
set search_path = ''
as $$
  with aprovado as (
    select coalesce(sum(c.valor_centavos), 0) as centavos, count(*) as tentativas
    from public.cobrancas c
    where c.pedido_id = p_pedido_id and c.situacao = 'aprovada'
  )
  select case
    when exists (
      select 1 from public.cobrancas c
      where c.pedido_id = p_pedido_id and c.situacao = 'estornada'
    ) then 'estornado'
    -- `tentativas > 0` guarda o pedido de total zero: sem ele, um pedido sem
    -- cobrança nenhuma satisfaria `0 >= 0` e nasceria pago.
    when (select tentativas from aprovado) > 0
     and (select centavos from aprovado)
         >= (select p.total_centavos from public.pedidos p where p.id = p_pedido_id)
      then 'pago'
    when (select centavos from aprovado) > 0 then 'parcial'
    when exists (
      select 1 from public.cobrancas c
      where c.pedido_id = p_pedido_id
        and c.situacao = 'pendente'
        and (c.expira_em is null or c.expira_em > now())
    ) then 'aguardando'
    else 'sem_pagamento'
  end::public.situacao_pagamento_pedido;
$$;

-- View comum no schema `public` é exposta pelo PostgREST e roda com os direitos
-- de quem a criou — ignoraria a RLS de `pedidos` e devolveria pedido alheio a
-- quem chamasse a API REST com uma sessão válida. `security_invoker` faz a RLS
-- das tabelas de baixo valer para quem chama; o revoke abaixo é a segunda
-- camada, no padrão do NAPO-005: privilégio revogado, não política ausente.
create view public.pedidos_com_pagamento with (security_invoker = on) as
select p.*, public.situacao_pagamento(p.id) as situacao_pagamento
from public.pedidos p;

revoke all on public.pedidos_com_pagamento from anon, authenticated;
grant select on public.pedidos_com_pagamento to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cobrança é operação, não conteúdo de cliente.
--
-- O privilégio revogado já fecha o acesso e erra alto. A política existe por
-- cima porque o invariante do NAPO-001 exige política em toda tabela — e porque
-- ausência de política é indistinguível de esquecimento. Quem lê é o servidor.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.cobrancas enable row level security;

revoke all on public.cobrancas from anon, authenticated;

create policy "cobrancas_nenhuma_sessao"
  on public.cobrancas for select
  using (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill — o histórico se muda para a casa nova.
--
-- Só pedido que tem `mp_payment_id` vira cobrança: pedido aguardando pagamento
-- nunca teve tentativa registrada, e inventar uma cobrança pendente para ele
-- seria fabricar um fato. Sem cobrança, a derivação responde `sem_pagamento` —
-- que é a verdade.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.cobrancas
  (pedido_id, instrumento, valor_centavos, situacao, mp_payment_id, forma, aprovada_em, expira_em, created_at)
select
  p.id,
  'online',
  p.total_centavos,
  case when p.status = 'estornado' then 'estornada' else 'aprovada' end::public.cobranca_situacao,
  p.mp_payment_id,
  p.forma_pagamento,
  coalesce(p.pago_em, p.created_at),
  p.expira_em,
  p.created_at
from public.pedidos p
where p.mp_payment_id is not null;
