-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_operacao_calendario — Configuração da operação e calendário (NAPO-004).
--
-- Estes números decidem o que pode ser vendido. Ficam em tabela, e não em
-- variável de ambiente, por dois motivos: o gerente muda o teto sem deploy, e
-- a mudança fica auditável (ARCHITECTURE §5.3 exige auditoria em capacidade).
--
-- Convenção de dia da semana: 0=domingo … 6=sábado, igual a EXTRACT(DOW).
-- ─────────────────────────────────────────────────────────────────────────────

create type public.tipo_excecao_calendario as enum (
  'sem_producao',
  'sem_entrega',
  'entrega_extra'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- config_operacao — singleton. Os CHECKs não são decoração: teto zero ou
-- percentual acima de 100 quebram o motor de forma silenciosa, e o banco é o
-- único lugar que garante isso em qualquer caminho de escrita.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.config_operacao (
  id uuid primary key default gen_random_uuid(),
  tempo_preparo_horas int not null default 48 check (tempo_preparo_horas > 0),
  teto_forno_dia int not null default 30 check (teto_forno_dia > 0),
  capacidade_freezer int not null default 150 check (capacidade_freezer > 0),
  sub_teto_massa_dia int not null default 6 check (sub_teto_massa_dia >= 0),
  limite_ocupacao_massa_pct int not null default 80
    check (limite_ocupacao_massa_pct between 0 and 100),
  buffer_cutoff_min int not null default 15 check (buffer_cutoff_min >= 0),
  reserva_minutos int not null default 15 check (reserva_minutos > 0),
  horizonte_semanas int not null default 2 check (horizonte_semanas > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice único sobre expressão constante: o banco recusa a segunda linha.
create unique index config_operacao_singleton on public.config_operacao ((true));

comment on table public.config_operacao is
  'Linha única com os limites da operação (NAPO-004). Frete e raio entram em NAPO-005.';

create trigger trg_config_operacao_updated_at
  before update on public.config_operacao
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Calendário. A janela vive na linha do dia da semana, não numa coluna global:
-- quando o sábado abrir, ele poderá ter horário próprio sem migration.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.dias_semana_entrega (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null unique check (dia_semana between 0 and 6),
  entrega boolean not null default false,
  janela_inicio time not null,
  janela_fim time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (janela_fim > janela_inicio)
);

create trigger trg_dias_semana_entrega_updated_at
  before update on public.dias_semana_entrega
  for each row execute function public.set_updated_at();

create table public.dias_semana_producao (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null unique check (dia_semana between 0 and 6),
  produz boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_dias_semana_producao_updated_at
  before update on public.dias_semana_producao
  for each row execute function public.set_updated_at();

-- Uma data tem no máximo uma exceção — `unique` em vez de PK natural para
-- manter o padrão de `id uuid` de ARCHITECTURE §4.2.
create table public.excecoes_calendario (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  tipo public.tipo_excecao_calendario not null,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_excecoes_calendario_updated_at
  before update on public.excecoes_calendario
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS deny-by-default. A assimetria é deliberada: o calendário é público
-- porque a vitrine monta o seletor de data sem sessão; os tetos não são,
-- porque revelam a capacidade instalada e o cálculo já roda no servidor.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.config_operacao enable row level security;
alter table public.dias_semana_entrega enable row level security;
alter table public.dias_semana_producao enable row level security;
alter table public.excecoes_calendario enable row level security;

grant select, insert, update on public.config_operacao to authenticated;

create policy "config_operacao_admin"
  on public.config_operacao
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.dias_semana_entrega to anon, authenticated;
grant insert, update, delete on public.dias_semana_entrega to authenticated;

create policy "dias_semana_entrega_leitura_publica"
  on public.dias_semana_entrega for select using (true);

create policy "dias_semana_entrega_escrita_admin"
  on public.dias_semana_entrega for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.dias_semana_producao to anon, authenticated;
grant insert, update, delete on public.dias_semana_producao to authenticated;

create policy "dias_semana_producao_leitura_publica"
  on public.dias_semana_producao for select using (true);

create policy "dias_semana_producao_escrita_admin"
  on public.dias_semana_producao for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.excecoes_calendario to anon, authenticated;
grant insert, update, delete on public.excecoes_calendario to authenticated;

create policy "excecoes_calendario_leitura_publica"
  on public.excecoes_calendario for select using (true);

create policy "excecoes_calendario_escrita_admin"
  on public.excecoes_calendario for all
  using (public.is_admin()) with check (public.is_admin());
