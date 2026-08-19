-- ─────────────────────────────────────────────────────────────────────────────
-- 0013_pedidos — A primeira tabela que registra dinheiro (NAPO-006).
--
-- Três decisões estruturais moram aqui e não no código:
--   1. Snapshot é coluna, não FK (RN4). Preço e nome são CÓPIA do dia da venda;
--      apontar para a faixa faria um reajuste reescrever a margem de meses
--      passados.
--   2. `mp_payment_id` tem índice único parcial (RN9). A idempotência do webhook
--      é garantida pelo banco: duas notificações simultâneas viram violação de
--      constraint, não dois consumos de capacidade. `select` antes de `insert`
--      não resolve — ambas passariam pelo select antes de qualquer insert.
--   3. `custo_unitario_snapshot` nasce NULL e fica NULL até o BOM do NAPO-008.
--      Nulo desde o nascimento é a única forma honesta de dizer "nunca soubemos
--      este custo"; a coluna criada depois convidaria a preencher pedido antigo
--      com o custo de então — a mentira que a RN4 existe para impedir.
-- ─────────────────────────────────────────────────────────────────────────────

-- `expirado` distingue abandono de decisão (RN13 vs RN14); `estornado` dá
-- destino à notificação de estorno e chargeback (RN14).
create type public.status_pedido as enum (
  'aguardando_pagamento',
  'pago',
  'expirado',
  'em_producao',
  'pronto',
  'em_rota',
  'entregue',
  'cancelado',
  'estornado'
);

create type public.canal_pedido as enum ('site', 'balcao', 'whatsapp');

-- O Simples exige a segregação por atividade na declaração mensal (NAPO-018).
-- Nasce agora para a costura fiscal do NAPO-011 não precisar de backfill.
create type public.atividade_fiscal as enum ('congelado_industrializado', 'fresca_balcao');

-- Espelha `Veredito` de packages/core (conflito.ts). Quem decide é o núcleo; o
-- banco só grava — acrescentar a regra aqui a faria existir em dois lugares.
create type public.veredito_viabilidade as enum ('viavel', 'cutoff_vencido', 'sem_vaga');

-- Número que o cliente fala no telefone e a cozinha escreve na caixa (RN16).
-- Sequência dedicada em vez de aleatório curto: não colide e ordena. Cancelar
-- não devolve o número — `nextval` nunca recua.
create sequence public.pedidos_numero_seq start with 1000;

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('public.pedidos_numero_seq'),
  profile_id uuid not null references public.profiles (id),

  status public.status_pedido not null default 'aguardando_pagamento',
  canal public.canal_pedido not null default 'site',
  atividade_fiscal public.atividade_fiscal not null default 'congelado_industrializado',

  dia_entrega date not null,

  -- Endereço inteiro copiado (RN4): editar o cadastro não reescreve para onde a
  -- entrega foi. jsonb e não colunas porque nada aqui é consultado por campo.
  endereco_snapshot jsonb not null,
  endereco_id uuid references public.enderecos (id),

  subtotal_centavos int not null check (subtotal_centavos >= 0),
  frete_centavos int not null check (frete_centavos >= 0),
  total_centavos int not null check (total_centavos >= 0),

  -- Veredito da RN11: dinheiro que entrou não é recusado, mas fica marcado.
  veredito public.veredito_viabilidade,

  -- Hold de capacidade que sustentou a cobrança (RN7).
  reserva_id uuid references public.reservas (id),
  -- Mesmo instante do vencimento da reserva e da cobrança (RN7, RN13).
  expira_em timestamptz not null,

  forma_pagamento text,
  mp_preference_id text,
  mp_payment_id text,
  pago_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- O total é sempre derivável: divergência aqui é bug de cálculo virando
  -- cobrança errada, e o banco recusa antes de virar dinheiro.
  constraint pedidos_total_confere check (total_centavos = subtotal_centavos + frete_centavos),
  -- Pedido pago sem identificador do pagamento é pedido sem prova de pagamento.
  constraint pedidos_pago_tem_pagamento
    check (status <> 'pago' or (mp_payment_id is not null and pago_em is not null))
);

comment on table public.pedidos is
  'Pedido do canal próprio (NAPO-006). Snapshot de preço e endereço é obrigatório: editar cadastro não reescreve histórico (RN4).';

create trigger trg_pedidos_updated_at
  before update on public.pedidos
  for each row execute function public.set_updated_at();

-- Idempotência do webhook aplicada pelo banco (RN9). Parcial porque pedido
-- ainda não pago não tem pagamento — e vários NULL não colidem.
create unique index pedidos_mp_payment_unico
  on public.pedidos (mp_payment_id) where mp_payment_id is not null;

-- Listagem da conta (prepara NAPO-007).
create index pedidos_do_dono on public.pedidos (profile_id, created_at desc);

-- Leitura de `vagas_ocupadas` (0014). Sem ele o motor varre a tabela inteira a
-- cada consulta de disponibilidade — a rota mais quente do site.
create index pedidos_dia_status on public.pedidos (dia_entrega, status);

-- Varredura da RN13/RN19: parcial, para não ler pedido já resolvido.
create index pedidos_aguardando_expiram on public.pedidos (expira_em)
  where status = 'aguardando_pagamento';

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  produto_id uuid not null references public.produtos (id),

  nome_snapshot text not null check (length(trim(nome_snapshot)) > 0),
  quantidade int not null check (quantidade > 0),
  preco_unitario_snapshot int not null check (preco_unitario_snapshot >= 0),
  -- NULL até o BOM do NAPO-008 existir. Ver cabeçalho desta migration.
  custo_unitario_snapshot int check (custo_unitario_snapshot >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Uma linha por produto: quantidade é campo, não repetição de linha. Sem isso
  -- `vagas_ocupadas` somaria certo mas o carrinho exibiria o item duas vezes.
  unique (pedido_id, produto_id)
);

create trigger trg_pedido_itens_updated_at
  before update on public.pedido_itens
  for each row execute function public.set_updated_at();

create index pedido_itens_do_pedido on public.pedido_itens (pedido_id);
-- `vagas_ocupadas` soma por produto dentro dos pedidos de um dia.
create index pedido_itens_por_produto on public.pedido_itens (produto_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- pagamento_eventos — toda notificação recebida, verificada ou não.
--
-- Dá endereço físico ao "registra e alerta" das RN10/RN19 antes de o admin do
-- NAPO-008 existir, e é a única evidência disponível quando alguém perguntar
-- por que um pedido não confirmou. `pedido_id` é nulável de propósito:
-- notificação para pedido desconhecido é exatamente o que se quer registrar.
-- ─────────────────────────────────────────────────────────────────────────────
create type public.resultado_evento_pagamento as enum (
  'confirmado',
  'duplicado',
  'assinatura_invalida',
  'valor_divergente',
  'pagamento_nao_aprovado',
  'pedido_desconhecido',
  'erro'
);

create table public.pagamento_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos (id) on delete set null,
  mp_payment_id text,
  resultado public.resultado_evento_pagamento not null,
  detalhe text,
  corpo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pagamento_eventos is
  'Trilha do webhook de pagamento (RN10, RN19). Nunca exposta ao cliente: é operação.';

create trigger trg_pagamento_eventos_updated_at
  before update on public.pagamento_eventos
  for each row execute function public.set_updated_at();

create index pagamento_eventos_do_pedido on public.pagamento_eventos (pedido_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- config_operacao — prazo do pagamento (RN7).
--
-- Coluna própria, não reúso de `reserva_minutos`: a reserva da vitrine e a
-- reserva de quem está pagando têm motivos diferentes para durar o que duram, e
-- amarrá-las faria mexer numa mexer na outra.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.config_operacao
  add column pagamento_minutos int not null default 30 check (pagamento_minutos > 0);

comment on column public.config_operacao.pagamento_minutos is
  'Prazo do checkout: vale ao mesmo tempo para a reserva e para a cobrança (RN7). Alterável sem deploy.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
--
-- Pedido é dinheiro. Políticas SEPARADAS por comando, no padrão de `enderecos`
-- (0012): equipe lê para operar, ninguém escreve pelo cliente.
--
-- INSERT e UPDATE são revogados de `authenticated` inteiramente: o pedido nasce
-- e muda de estado por rota de servidor (service_role), porque preço, frete e
-- veredito são decididos no servidor (RN3, RN11). Uma política de insert com
-- `profile_id = auth.uid()` bastaria para o isolamento e ainda deixaria o
-- cliente escolher o próprio `total_centavos` — isolamento correto, cobrança
-- errada.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.pagamento_eventos enable row level security;

revoke all on public.pedidos from anon;
revoke all on public.pedido_itens from anon;
revoke all on public.pagamento_eventos from anon, authenticated;
revoke insert, update, delete, truncate on public.pedidos from authenticated;
revoke insert, update, delete, truncate on public.pedido_itens from authenticated;

grant select on public.pedidos to authenticated;
grant select on public.pedido_itens to authenticated;

create policy "pedidos_dono_le"
  on public.pedidos for select to authenticated
  using (profile_id = auth.uid());

create policy "pedidos_equipe_le"
  on public.pedidos for select to authenticated
  using (public.is_equipe());

create policy "pedido_itens_dono_le"
  on public.pedido_itens for select to authenticated
  using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_itens.pedido_id and p.profile_id = auth.uid()
    )
  );

create policy "pedido_itens_equipe_le"
  on public.pedido_itens for select to authenticated
  using (public.is_equipe());

-- pagamento_eventos: negação EXPLÍCITA, não ausência de política.
--
-- O privilégio revogado acima já fecha o acesso e erra alto. A política existe
-- por cima porque o invariante do NAPO-001 exige política em toda tabela — e
-- porque ausência de política é indistinguível de esquecimento: quem amanhã
-- acrescentar um `grant select` encontraria a tabela aberta. `using (false)`
-- diz, em uma linha, que nenhuma sessão de navegador lê esta trilha. Quem lê é
-- o servidor (service_role ignora RLS); a tela de operação é NAPO-008.
create policy "pagamento_eventos_nenhuma_sessao"
  on public.pagamento_eventos for select
  using (false);
