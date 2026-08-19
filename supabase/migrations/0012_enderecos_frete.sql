-- ─────────────────────────────────────────────────────────────────────────────
-- 0012_enderecos_frete — Endereços do cliente, área de entrega e frete (NAPO-005).
--
-- Traz o dado mais sensível do projeto: onde a pessoa mora, com coordenada.
-- Isolamento por dono é a proteção central desta migration (RN1) — equipe lê
-- para dar suporte e separar entrega, nunca escreve no lugar do cliente.
--
-- Configuração (raio, faixas, exceções, origem) mora em tabela e não em código
-- porque abrir região nova ou reajustar frete não pode depender de deploy (RN7).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── is_equipe(): o usuário corrente pertence à operação? ────────────────────
-- Mesma disciplina de is_admin() (0001): SECURITY DEFINER para não disparar a
-- RLS de `profiles` dentro de uma política que consulta `profiles` — recursão
-- infinita —, e `search_path` fixo, sem o qual SECURITY DEFINER vira vetor de
-- escalada por objeto homônimo. `cozinha` fica de fora: quem monta a pizza não
-- precisa do endereço de ninguém (princípio do menor privilégio).
create or replace function public.is_equipe()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('atendente', 'gerente', 'admin')
  );
end;
$$;

comment on function public.is_equipe() is
  'Verdadeiro se o usuário corrente é atendente, gerente ou admin. SECURITY DEFINER para evitar recursão de RLS em profiles (NAPO-005 RN1).';

-- ── Origem e parâmetros de área na configuração da operação ─────────────────
-- A coordenada da cozinha é a origem de TODA distância do sistema. Fica aqui, ao
-- lado do raio, para mudar de endereço ser um UPDATE — não um deploy.
alter table public.config_operacao
  add column lat_cozinha numeric(9,6) not null default -15.850018
    check (lat_cozinha between -90 and 90),
  add column lng_cozinha numeric(9,6) not null default -47.972645
    check (lng_cozinha between -180 and 180),
  add column raio_km numeric(5,2) not null default 12
    check (raio_km > 0),
  add column frete_gratis_centavos int not null default 15000
    check (frete_gratis_centavos >= 0),
  -- Razão entre asfalto e linha reta em Brasília (RN11). Entre 1,3 e 1,4 pela
  -- geografia do lago; abaixo de 1 seria estimar rodovia mais curta que a reta.
  add column fator_distancia_estimada numeric(3,2) not null default 1.35
    check (fator_distancia_estimada >= 1),
  add column limite_ajuste_pin_m int not null default 300
    check (limite_ajuste_pin_m > 0);

comment on column public.config_operacao.lat_cozinha is
  'Origem de toda distância do sistema — Sria II QE 38 CL 2, Guará, Brasília-DF.';

-- ── Cache de CEP ────────────────────────────────────────────────────────────
-- Não é PII: logradouro é dado público. Existe para não pagar latência de
-- terceiro duas vezes pelo mesmo CEP e para o cadastro seguir funcionando
-- quando ViaCEP e BrasilAPI caem juntas (RN2).
create table public.ceps (
  cep text primary key check (cep ~ '^[0-9]{8}$'),
  logradouro text,
  bairro text,
  cidade text not null,
  uf text not null check (length(uf) = 2),
  fonte text not null check (fonte in ('viacep', 'brasilapi', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ceps is
  'Cache de CEP (NAPO-005 RN2). Dado público de logradouro, não PII. Serverless não tem processo longevo — cache em memória morreria a cada cold start.';

create trigger trg_ceps_updated_at
  before update on public.ceps
  for each row execute function public.set_updated_at();

-- ── Faixas de frete ─────────────────────────────────────────────────────────
-- Intervalo [km_de, km_ate): 4,00 km é a faixa de cima. A última fecha à
-- direita na aplicação, porque seu fim é o raio e 12,00 km é atendido (RN9).
-- Centavos em int pelo mesmo motivo do catálogo: o valor será somado a subtotal,
-- imposto e taxa de cartão.
create table public.faixas_frete (
  id uuid primary key default gen_random_uuid(),
  km_de numeric(5,2) not null check (km_de >= 0),
  km_ate numeric(5,2) not null,
  valor_centavos int not null check (valor_centavos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (km_ate > km_de),
  unique (km_de)
);

create trigger trg_faixas_frete_updated_at
  before update on public.faixas_frete
  for each row execute function public.set_updated_at();

-- ── Exceções de área ────────────────────────────────────────────────────────
-- `motivo` é NOT NULL de propósito: exceção sem motivo é dívida — seis meses
-- depois ninguém sabe por que aquele CEP está barrado (RN10).
create type public.tipo_excecao_area as enum ('bloqueio', 'liberacao');

create table public.excecoes_area (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_excecao_area not null,
  cep_prefixo text not null unique check (cep_prefixo ~ '^[0-9]{3,8}$'),
  motivo text not null check (length(trim(motivo)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index excecoes_area_prefixo on public.excecoes_area (cep_prefixo);

create trigger trg_excecoes_area_updated_at
  before update on public.excecoes_area
  for each row execute function public.set_updated_at();

-- ── Endereços ───────────────────────────────────────────────────────────────
create table public.enderecos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  apelido text not null check (length(trim(apelido)) > 0),

  -- Endereço de Brasília não é "rua e número" (RN3): o logradouro devolvido pelo
  -- CEP é sempre editável, o número aceita 's/n' — por isso text, não int — e o
  -- complemento é campo próprio, exigido para quadra e condomínio na aplicação.
  cep text not null check (cep ~ '^[0-9]{8}$'),
  logradouro text not null check (length(trim(logradouro)) > 0),
  numero text not null check (length(trim(numero)) > 0),
  complemento text,
  bairro text,
  cidade text not null,
  uf text not null check (length(uf) = 2),
  referencia text,

  -- Duas coordenadas, não uma. Sem guardar o ponto que o geocoding devolveu,
  -- medir o deslocamento da RN6 depois do fato é impossível — e é esse delta que
  -- separa "corrigiu a porta" de "arrastou para baratear o frete".
  lat_geocode numeric(9,6) check (lat_geocode between -90 and 90),
  lng_geocode numeric(9,6) check (lng_geocode between -180 and 180),
  lat numeric(9,6) not null check (lat between -90 and 90),
  lng numeric(9,6) not null check (lng between -180 and 180),

  -- Distância é cache (RN12): recalcula só quando a coordenada muda.
  -- numeric, não float: 12,00 km precisa comparar com o raio sem surpresa de
  -- ponto flutuante na borda exata.
  distancia_km numeric(6,2) check (distancia_km >= 0),
  distancia_estimada boolean not null default false,
  precisa_conferencia boolean not null default false,

  -- Resultado CONGELADO da avaliação de área, não derivação em tempo de leitura:
  -- mudar o raio não pode revogar retroativamente e em silêncio o endereço de
  -- quem já comprou (RN9).
  atendido boolean not null default false,
  motivo_nao_atendido text,

  padrao boolean not null default false,
  ativo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.enderecos is
  'Endereço do cliente com coordenada (NAPO-005). O dado mais sensível do projeto — RLS por dono, equipe só lê.';

create trigger trg_enderecos_updated_at
  before update on public.enderecos
  for each row execute function public.set_updated_at();

-- A consulta real é "meus endereços ativos".
create index enderecos_do_dono on public.enderecos (profile_id) where ativo;

-- RN13 vira impossível de violar, inclusive por script: o banco recusa o
-- segundo padrão ativo do mesmo cliente.
create unique index enderecos_um_padrao_por_dono
  on public.enderecos (profile_id) where padrao and ativo;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.ceps enable row level security;
alter table public.faixas_frete enable row level security;
alter table public.excecoes_area enable row level security;
alter table public.enderecos enable row level security;

-- O Supabase concede ALL em toda tabela nova de `public` a anon/authenticated
-- por default privilege — sem RLS a tabela nasceria aberta. Aqui a RLS resolve o
-- acesso, mas os privilégios que NENHUMA política deveria destravar são
-- revogados explicitamente: privilégio revogado erra alto, política ausente
-- devolve zero linha em silêncio, e uma política `for all` acrescentada por
-- descuido amanhã reabriria o que só a revogação fecha.
revoke all on public.enderecos from anon;
revoke delete, truncate on public.enderecos from authenticated;
revoke all on public.ceps from anon;
revoke insert, update, delete, truncate on public.ceps from authenticated;
revoke all on public.excecoes_area from anon;
revoke truncate on public.excecoes_area from authenticated;
revoke insert, update, delete, truncate on public.faixas_frete from anon;
revoke truncate on public.faixas_frete from authenticated;

-- ceps: o servidor escreve (service_role ignora RLS); quem está logado lê para
-- o formulário de cadastro não bater no terceiro de novo.
grant select on public.ceps to authenticated;

create policy "ceps_leitura_autenticada"
  on public.ceps for select to authenticated using (true);

-- faixas_frete: leitura pública de propósito. A página de entrega precisa exibir
-- os valores, que hoje estão cravados na copy do site.
grant select on public.faixas_frete to anon, authenticated;
grant insert, update, delete on public.faixas_frete to authenticated;

create policy "faixas_frete_leitura_publica"
  on public.faixas_frete for select using (true);

create policy "faixas_frete_escrita_admin"
  on public.faixas_frete for all
  using (public.is_admin()) with check (public.is_admin());

-- excecoes_area: nem anônimo nem cliente. A lista de CEPs barrados é informação
-- de operação — e a decisão de área já chega pronta ao cliente.
grant select on public.excecoes_area to authenticated;
grant insert, update, delete on public.excecoes_area to authenticated;

create policy "excecoes_area_leitura_equipe"
  on public.excecoes_area for select
  using (public.is_equipe());

create policy "excecoes_area_escrita_admin"
  on public.excecoes_area for all
  using (public.is_admin()) with check (public.is_admin());

-- enderecos: o coração da RN1. Políticas SEPARADAS por comando, não um `for all`
-- com OR — equipe lê, e só o dono escreve. Um `for all` que aceitasse is_equipe()
-- daria ao atendente o poder de reescrever o endereço do cliente.
grant select, insert, update on public.enderecos to authenticated;

create policy "enderecos_dono_le"
  on public.enderecos for select to authenticated
  using (profile_id = auth.uid());

create policy "enderecos_equipe_le"
  on public.enderecos for select to authenticated
  using (public.is_equipe());

create policy "enderecos_dono_cria"
  on public.enderecos for insert to authenticated
  with check (profile_id = auth.uid());

-- Sem `for delete`: endereço não é apagado, é desativado (RN15). A ausência de
-- política é a regra — deny-by-default recusa o DELETE de qualquer um.
create policy "enderecos_dono_edita"
  on public.enderecos for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ── Seed de configuração de produto ─────────────────────────────────────────
-- Vai na migration, não em script: as faixas e o raio precisam existir iguais
-- nos três ambientes, mesmo critério do catálogo em 0011. Ids cravados para a
-- faixa ser a mesma linha em local, staging e produção.
insert into public.faixas_frete (id, km_de, km_ate, valor_centavos) values
  ('f6e70000-0000-0000-0000-000000000001', 0, 4, 600),
  ('f6e70000-0000-0000-0000-000000000002', 4, 8, 1000),
  ('f6e70000-0000-0000-0000-000000000003', 8, 12, 1400);

-- As três faixas cobrem o custo de referência de R$ 9,60 por entrega (rota de 10
-- entregas / 30 pizzas / ~60 km ≈ R$ 96); a de 0–4 km cobre com folga e sustenta
-- a de 8–12 km. Reajustar é UPDATE — o simulador de viabilidade é NAPO-008.

-- A linha singleton de config_operacao já existe (0003); os defaults acima
-- valem para ela. Explicitar aqui deixa o valor visível a quem lê a migration.
update public.config_operacao set
  lat_cozinha = -15.850018,
  lng_cozinha = -47.972645,
  raio_km = 12,
  frete_gratis_centavos = 15000,
  fator_distancia_estimada = 1.35,
  limite_ajuste_pin_m = 300;
