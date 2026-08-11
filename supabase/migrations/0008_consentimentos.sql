-- ─────────────────────────────────────────────────────────────────────────────
-- 0008_consentimentos — LGPD: o que a pessoa aceitou, em qual versão do texto.
--
-- O consentimento aponta para a versão textual, não para um booleano: "aceitou
-- os termos" sem dizer QUAIS termos não prova nada. Nasce nesta spec porque
-- consentimento não é preenchível retroativamente — qualquer conta criada antes
-- da coleta ficaria com a lacuna aberta para sempre.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.tipo_consentimento as enum ('termos', 'privacidade', 'marketing');

create table public.termos_versoes (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_consentimento not null,
  versao text not null,
  conteudo text not null,
  vigente boolean not null default false,
  publicado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo, versao)
);

comment on table public.termos_versoes is
  'Textos legais versionados. Leitura pública: a tela de cadastro precisa mostrar antes de haver sessão.';

create trigger trg_termos_versoes_updated_at
  before update on public.termos_versoes
  for each row execute function public.set_updated_at();

-- Uma versão vigente por tipo. Sem isso, "qual texto a pessoa aceitou hoje?"
-- passaria a depender de ordenação por data, que empata.
create unique index termos_versoes_vigente_por_tipo
  on public.termos_versoes (tipo)
  where vigente;

create table public.consentimentos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tipo public.tipo_consentimento not null,
  versao text not null,
  aceito_em timestamptz not null default now(),
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Reaceitar a mesma versão é ruído, não informação nova. Versão nova gera
  -- linha nova, e é isso que sustenta o histórico.
  unique (profile_id, tipo, versao)
);

comment on table public.consentimentos is
  'Aceites registrados com versão, data e IP (RN15). Marketing é opt-in separado e opcional.';

create trigger trg_consentimentos_updated_at
  before update on public.consentimentos
  for each row execute function public.set_updated_at();

create index consentimentos_por_profile on public.consentimentos (profile_id, tipo);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.termos_versoes enable row level security;
alter table public.consentimentos enable row level security;

grant select on public.termos_versoes to anon, authenticated;
grant select on public.consentimentos to authenticated;

create policy "termos_versoes_leitura_publica"
  on public.termos_versoes
  for select
  using (true);

-- Escrita de texto legal é ato editorial de admin. Sem grant de INSERT para
-- anon/authenticated, a política nem chega a ser consultada por eles.
create policy "termos_versoes_escrita_admin"
  on public.termos_versoes
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Cada um lê o próprio consentimento; admin lê todos (atendimento e prova).
-- A escrita acontece pela service_role no ato do cadastro: consentimento que o
-- próprio titular pode inserir depois não prova quando foi dado.
create policy "consentimentos_select_self_or_admin"
  on public.consentimentos
  for select
  using (profile_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Versão zero dos textos. Vai na migration, não no seed: produção também
-- precisa dela para o cadastro funcionar, e `seed.sql` só roda em local.
-- O texto publicado (v1) é o NAPO-003.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.termos_versoes (tipo, versao, conteudo, vigente)
values
  ('termos', '0',
   'Versão provisória. Ao criar sua conta na Napo você concorda em fornecer dados verdadeiros de contato e endereço para viabilizar a entrega dos pedidos. O texto definitivo será publicado antes do lançamento e você será avisado para aceitá-lo.',
   true),
  ('privacidade', '0',
   'Versão provisória. A Napo trata seu nome, e-mail, telefone e endereço com a única finalidade de processar e entregar seus pedidos, conforme a Lei 13.709/2018 (LGPD). Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing. O texto definitivo será publicado antes do lançamento.',
   true),
  ('marketing', '0',
   'Versão provisória. Autorizo a Napo a me enviar novidades e promoções pelo WhatsApp. Posso revogar esta autorização a qualquer momento pela minha conta ou respondendo à própria mensagem.',
   true);
