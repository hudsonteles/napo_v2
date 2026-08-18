-- ─────────────────────────────────────────────────────────────────────────────
-- 0012_enderecos_frete — Endereços do cliente e frete por faixa (NAPO-005).
--
-- Primeira tabela com o dado MAIS sensível do projeto: onde a pessoa mora, com
-- coordenada. Isolamento entre clientes (RN1) é a proteção central desta spec —
-- por isso a RLS aqui é mais restritiva que a do catálogo: nada é público de
-- endereço, e só o dono escreve. Equipe lê para dar suporte e separar a entrega.
--
-- Frete é configuração de produto (faixas, raio, piso de frete grátis): vive em
-- tabela/colunas, alterável por UPDATE sem deploy (RN7), e o seed entra na
-- própria migration para existir nos três ambientes (mesmo critério do catálogo
-- em 0011). A regra que transforma distância em valor mora em packages/core.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- is_equipe(): o usuário corrente é da equipe interna (qualquer papel != cliente)?
-- Mesma disciplina de is_admin (0001): SECURITY DEFINER para não recorrer na RLS
-- de profiles, search_path fixo contra escalada por objeto homônimo. Usada pelas
-- políticas de leitura de suporte — equipe VÊ endereço para atender e separar a
-- entrega, mas nunca escreve no lugar do cliente (RN1).
-- ─────────────────────────────────────────────────────────────────────────────
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
      and p.role <> 'cliente'
  );
end;
$$;

comment on function public.is_equipe() is
  'Verdadeiro se o usuário corrente tem papel de equipe (atendente/cozinha/gerente/admin). SECURITY DEFINER evita recursão de RLS em profiles.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ceps — cache de CEP. Não é PII: logradouro é dado público. Existe para não
-- pagar latência de terceiro duas vezes pelo mesmo CEP e para o cadastro seguir
-- quando ViaCEP e BrasilAPI caem juntas (RN2). PK natural (o próprio CEP): a
-- chave de negócio é única e é sempre por ela que se consulta.
-- ─────────────────────────────────────────────────────────────────────────────
create type public.fonte_cep as enum ('viacep', 'brasilapi', 'manual');

create table public.ceps (
  cep text primary key check (cep ~ '^[0-9]{8}$'),
  logradouro text,
  bairro text,
  cidade text,
  uf text check (uf is null or char_length(uf) = 2),
  fonte public.fonte_cep not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ceps is
  'Cache de CEP (dado público, não-PII). Evita repetir a chamada a ViaCEP/BrasilAPI e sustenta o cadastro quando ambas caem (RN2).';

create trigger trg_ceps_updated_at
  before update on public.ceps
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- faixas_frete — a faixa da distância define o valor (RN7). Centavos em `int`
-- pelo mesmo motivo do catálogo: o valor será somado a subtotal, imposto e taxa
-- de cartão no NAPO-006/008. Intervalo semiaberto [km_de, km_ate) é resolvido na
-- regra pura (packages/core); aqui o banco só guarda os limites.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.faixas_frete (
  id uuid primary key default gen_random_uuid(),
  km_de numeric(6, 2) not null check (km_de >= 0),
  km_ate numeric(6, 2) not null,
  valor_centavos int not null check (valor_centavos >= 0),
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (km_ate > km_de)
);

comment on table public.faixas_frete is
  'Faixas de frete por distância rodoviária (RN7). Leitura pública: a página de entrega exibe os valores.';

create trigger trg_faixas_frete_updated_at
  before update on public.faixas_frete
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- excecoes_area — bloqueio recusa região dentro do raio; liberação atende fora
-- dele (RN10). `motivo` é NOT NULL de propósito: exceção sem motivo é dívida —
-- seis meses depois ninguém sabe por que aquele CEP está barrado.
-- ─────────────────────────────────────────────────────────────────────────────
create type public.tipo_excecao_area as enum ('bloqueio', 'liberacao');

create table public.excecoes_area (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_excecao_area not null,
  cep_prefixo text not null check (cep_prefixo ~ '^[0-9]{1,8}$'),
  motivo text not null check (char_length(trim(motivo)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.excecoes_area is
  'Exceções de área por prefixo de CEP: vencem o raio (RN10). Motivo obrigatório.';

create trigger trg_excecoes_area_updated_at
  before update on public.excecoes_area
  for each row execute function public.set_updated_at();

-- A avaliação de área busca por prefixo em toda criação de endereço.
create index excecoes_area_cep_prefixo on public.excecoes_area (cep_prefixo);

-- ─────────────────────────────────────────────────────────────────────────────
-- enderecos — o dado do cliente. Guarda DUAS coordenadas: a que o geocoding
-- devolveu (lat_geocode/lng_geocode) e a final após o ajuste do pin (lat/lng).
-- Sem as duas, medir o deslocamento da RN6 depois do fato é impossível — e é
-- esse delta que separa "corrigiu a porta" de "arrastou para baratear o frete".
--
-- distancia_km é cache (RN12); distancia_estimada e precisa_conferencia são o
-- que impede uma estimativa silenciosa virar rota de entrega (RN11/RN6).
-- atendido é resultado CONGELADO da avaliação de área no cadastro (RN9), não
-- derivação em leitura: mudar o raio não pode revogar retroativamente e em
-- silêncio o endereço de quem já comprou.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.enderecos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  rotulo text,

  cep text,
  logradouro text not null,
  -- Número aceita 's/n' (RN3): endereço de quadra não tem número numérico.
  numero text not null,
  -- Obrigatório em endereço de quadra/condomínio (RN3) — validado na aplicação,
  -- que é quem sabe se o logradouro é de quadra; o banco não infere isso.
  complemento text,
  bairro text,
  cidade text not null,
  uf text not null check (char_length(uf) = 2),
  referencia text,

  -- Coordenada do geocoding (a porta segundo o mapa) e a final (após o pin).
  lat_geocode numeric(9, 6),
  lng_geocode numeric(9, 6),
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,

  -- Distância rodoviária, cache (RN12). numeric, não float: 12,00 km compara com
  -- o raio sem surpresa de ponto flutuante na borda exata da faixa.
  distancia_km numeric(6, 2),
  distancia_estimada boolean not null default false,
  precisa_conferencia boolean not null default false,

  -- Resultado congelado da avaliação de área (RN9). motivo_area registra a
  -- exceção quando foi ela que decidiu (RN10).
  atendido boolean not null default false,
  motivo_area text,

  padrao boolean not null default false,
  ativo boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.enderecos is
  'Endereços do cliente com coordenada — o dado mais sensível do projeto (RN1). Distância e atendimento são cache congelado no cadastro (RN9/RN12).';

create trigger trg_enderecos_updated_at
  before update on public.enderecos
  for each row execute function public.set_updated_at();

-- A consulta real é "meus endereços ativos".
create index enderecos_profile_ativo on public.enderecos (profile_id) where ativo;

-- RN13 vira impossível de violar, inclusive por script: no máximo um padrão ativo
-- por cliente. Índice único parcial em vez de trigger — o banco garante sozinho.
create unique index enderecos_padrao_unico on public.enderecos (profile_id)
  where padrao and ativo;

-- ─────────────────────────────────────────────────────────────────────────────
-- config_operacao ganha os parâmetros de frete/área. Colunas com default: o
-- backfill aplica os valores à linha singleton já existente (seed) em todos os
-- ambientes onde a migration roda — é o que o §2.4 do design pede sem depender
-- do seed.sql (que só corre local). raio 12 km, frete grátis R$ 150, fator de
-- correção da estimativa 1,35 (razão rodoviária/reta típica de Brasília), limite
-- de ajuste do pin 300 m (RN6).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.config_operacao
  add column raio_km numeric(5, 2) not null default 12
    check (raio_km > 0),
  add column frete_gratis_centavos int not null default 15000
    check (frete_gratis_centavos >= 0),
  add column fator_distancia_estimada numeric(3, 2) not null default 1.35
    check (fator_distancia_estimada >= 1),
  add column limite_ajuste_pin_m int not null default 300
    check (limite_ajuste_pin_m > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed das faixas (RN7). Vai na migration, não no seed.sql: precisa existir em
-- staging e prod, não só no reset local. Semiaberto na regra pura — aqui só os
-- limites: 0–4 R$ 6, 4–8 R$ 10, 8–12 R$ 14.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.faixas_frete (km_de, km_ate, valor_centavos, ordem)
values
  (0, 4, 600, 1),
  (4, 8, 1000, 2),
  (8, 12, 1400, 3);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS deny-by-default. A matriz (design §2.4) é mais fechada que a do catálogo
-- porque endereço é PII: nada de anônimo, e cliente só toca as próprias linhas.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.ceps enable row level security;
alter table public.faixas_frete enable row level security;
alter table public.excecoes_area enable row level security;
alter table public.enderecos enable row level security;

-- ── ceps: cache público de logradouro. Escrito pelo servidor (usuário logado ao
-- consultar um CEP novo), lido por qualquer autenticado. Anônimo fica de fora. ──
grant select, insert, update on public.ceps to authenticated;

create policy "ceps_leitura_autenticado" on public.ceps for select
  using (true);
create policy "ceps_escrita_autenticado" on public.ceps for insert
  with check (true);
create policy "ceps_atualiza_autenticado" on public.ceps for update
  using (true) with check (true);

-- ── faixas_frete: leitura pública (a página de entrega exibe os valores);
-- escrita só admin (até o admin do NAPO-008, via SQL). ──
grant select on public.faixas_frete to anon, authenticated;
grant insert, update, delete on public.faixas_frete to authenticated;

create policy "faixas_frete_leitura_publica" on public.faixas_frete for select
  using (true);
create policy "faixas_frete_admin_escreve" on public.faixas_frete for all
  using (public.is_admin()) with check (public.is_admin());

-- ── excecoes_area: leitura só equipe (revela onde a casa bloqueia/libera);
-- escrita só admin. Cliente e anônimo não alcançam. ──
grant select on public.excecoes_area to authenticated;
grant insert, update, delete on public.excecoes_area to authenticated;

create policy "excecoes_area_leitura_equipe" on public.excecoes_area for select
  using (public.is_equipe());
create policy "excecoes_area_admin_escreve" on public.excecoes_area for all
  using (public.is_admin()) with check (public.is_admin());

-- ── enderecos: o dono toca só as próprias linhas; equipe LÊ (suporte e
-- separação de entrega) e não escreve. Sem DELETE — remover é desativar (RN15).
-- A ausência de política de delete + ausência de grant fecham as duas portas. ──
grant select, insert, update on public.enderecos to authenticated;

-- SELECT: dono vê as suas, equipe vê todas (para atender). anon nunca.
create policy "enderecos_leitura_dono_ou_equipe" on public.enderecos for select
  using (profile_id = auth.uid() or public.is_equipe());

-- INSERT/UPDATE: só o próprio dono. Equipe cai aqui e é recusada — lê, não
-- escreve (RN1). with check no insert impede criar endereço em nome de outro.
create policy "enderecos_insere_dono" on public.enderecos for insert
  with check (profile_id = auth.uid());
create policy "enderecos_atualiza_dono" on public.enderecos for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
