-- ─────────────────────────────────────────────────────────────────────────────
-- 0007_telefone — Unicidade do telefone validado e o registro dos desafios.
--
-- As colunas `telefone` e `telefone_validado_em` já existiam desde 0002, nulas e
-- sem lógica. Aqui elas ganham regra.
-- ─────────────────────────────────────────────────────────────────────────────

-- E.164 restrito a celular brasileiro. O mesmo formato que `normalizarTelefoneBR`
-- produz em packages/core — divergência entre os dois faria a unicidade comparar
-- strings diferentes para o mesmo número.
alter table public.profiles
  add constraint profiles_telefone_e164 check (telefone ~ '^\+55[1-9]{2}9\d{8}$');

comment on column public.profiles.telefone is
  'Celular em E.164 (+55DDD9XXXXXXXX). Único entre contas validadas (RN9).';

-- Único PARCIAL: dois cadastros podem estar tentando o mesmo número ao mesmo
-- tempo (alguém errou a conta e recomeçou); só não podem terminar os dois
-- validados. A corrida é decidida aqui, não por leitura prévia na aplicação.
create unique index profiles_telefone_validado_unico
  on public.profiles (telefone)
  where telefone_validado_em is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- telefone_verificacoes — o desafio emitido e, ao mesmo tempo, o contador do
-- rate limit: uma linha por envio, com hora e IP, responde os tetos da RN7 sem
-- armazenamento adicional.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.telefone_verificacoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  telefone text not null,
  -- HMAC-SHA256 com pepper fora do banco. Espaço de 10^6 é pequeno demais para
  -- uma KDF proteger contra dump; segredo que não está no banco, não.
  codigo_hash text not null,
  tentativas smallint not null default 0,
  expira_em timestamptz not null,
  validado_em timestamptz,
  -- Envio que falhou na origem: o desafio morre e NÃO conta contra o teto
  -- diário — cobrar do usuário por indisponibilidade nossa seria dobrar a falha.
  invalidado_em timestamptz,
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.telefone_verificacoes is
  'Desafios de OTP. Inalcançável por chave anônima — só a service_role em Route Handler (RN6).';

create trigger trg_telefone_verificacoes_updated_at
  before update on public.telefone_verificacoes
  for each row execute function public.set_updated_at();

-- Os três índices são as três consultas que existem: teto por número, teto por
-- IP e busca do desafio ativo da pessoa.
create index telefone_verificacoes_por_numero on public.telefone_verificacoes (telefone, created_at desc);
create index telefone_verificacoes_por_ip on public.telefone_verificacoes (ip, created_at desc);
create index telefone_verificacoes_por_profile on public.telefone_verificacoes (profile_id, created_at desc);

alter table public.telefone_verificacoes enable row level security;

-- Negação explícita em vez de "nenhuma política": o teste do NAPO-001 exige
-- política declarada, e negar de propósito precisa ser distinguível de esquecer
-- de declarar na hora de ler o arquivo. Sem grants, ninguém alcança a tabela.
create policy "telefone_verificacoes_sem_acesso_direto"
  on public.telefone_verificacoes
  for select
  using (false);
