-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_capacidade — O que o motor lê para prometer (NAPO-004).
--
-- Só o mínimo que a disponibilidade consulta: lote pronto (ATP), produção já
-- comprometida (CTP) e reserva viva. Movimentos de estoque, ajuste com motivo,
-- FEFO e auditoria são NAPO-008 — quem opera o estoque é o admin.
--
-- `produto_id` fica SEM foreign key: a tabela `produtos` nasce em NAPO-003.
-- A FK entra lá, junto com o catálogo.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.status_reserva as enum (
  'ativa',
  'consumida',
  'expirada',
  'cancelada'
);

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null,
  quantidade int not null check (quantidade >= 0),
  produzido_em date not null,
  validade date not null,
  -- Lote casado com um dia de entrega; NULL = livre para qualquer dia.
  dia_entrega_alocado date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (validade >= produzido_em)
);

create trigger trg_lotes_updated_at
  before update on public.lotes
  for each row execute function public.set_updated_at();

-- Ordenar por validade é o acesso do ATP e o que prepara o FEFO de NAPO-008.
create index lotes_produto_validade on public.lotes (produto_id, validade) where ativo;

create table public.producao_planejada (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  produto_id uuid not null,
  quantidade int not null check (quantidade > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_producao_planejada_updated_at
  before update on public.producao_planejada
  for each row execute function public.set_updated_at();

create index producao_planejada_data on public.producao_planejada (data);

-- ─────────────────────────────────────────────────────────────────────────────
-- reservas — o hold do checkout. Sem job de expiração: toda leitura filtra por
-- `expira_em > now()`, então a reserva morta é invisível no instante em que
-- vence. Um job de limpeza é housekeeping, não correção.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  dia_entrega date not null,
  produto_id uuid not null,
  quantidade int not null check (quantidade > 0),
  expira_em timestamptz not null,
  status public.status_reserva not null default 'ativa',
  -- Preenchido quando o pagamento confirma. Sem FK: `pedidos` é NAPO-006.
  pedido_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_reservas_updated_at
  before update on public.reservas
  for each row execute function public.set_updated_at();

-- Índice parcial: a consulta quente é "quantas reservas vivas neste dia".
create index reservas_dia_ativas on public.reservas (dia_entrega, produto_id)
  where status = 'ativa';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS. Estoque é informação de operação: no browser vira dado de concorrente.
-- O endpoint público devolve apenas o agregado, lido pelo servidor.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.lotes enable row level security;
alter table public.producao_planejada enable row level security;
alter table public.reservas enable row level security;

grant select, insert, update, delete on public.lotes to authenticated;
create policy "lotes_admin" on public.lotes for all
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.producao_planejada to authenticated;
create policy "producao_planejada_admin" on public.producao_planejada for all
  using (public.is_admin()) with check (public.is_admin());

-- O cliente enxerga a própria reserva (para o checkout mostrar o tempo restante),
-- nunca a de outro. A criação passa pela RPC, que é SECURITY DEFINER.
grant select on public.reservas to authenticated;
create policy "reservas_select_own_or_admin" on public.reservas for select
  using (profile_id = auth.uid() or public.is_admin());
