-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_profiles — Identidade e papel. A espinha do modelo de acesso.
--
-- `profiles` entra agora, embora login seja NAPO-002: sem ao menos uma tabela
-- real com role e política não há como provar que RLS e o trigger funcionam.
-- Entra a espinha (identidade + papel) e nada mais.
-- ─────────────────────────────────────────────────────────────────────────────

-- Papéis mutuamente exclusivos. Enum nativo: o banco recusa valor inválido sem
-- check constraint nem validação na aplicação.
create type public.user_role as enum (
  'cliente',
  'atendente',
  'cozinha',
  'gerente',
  'admin'
);

-- Espelha auth.users. FK ON DELETE CASCADE: apagar o usuário apaga o perfil.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  email text,
  role public.user_role not null default 'cliente',
  -- Campos de telefone nascem NULOS e sem lógica — o gate por WhatsApp é NAPO-002.
  -- Criá-los aqui evita migration em tabela já povoada depois.
  telefone text,
  telefone_validado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de cada usuário (auth.users). Guarda role (RBAC) e telefone (gate NAPO-002, ainda sem lógica).';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS deny-by-default: liga a RLS e declara apenas o que é permitido.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Privilégios de tabela para o usuário logado. A RLS acima é o que de fato
-- restringe QUAIS linhas; sem estes grants o usuário não alcançaria a tabela.
-- `anon` fica de fora de propósito: profile só existe para quem está logado.
grant select, insert, update on public.profiles to authenticated;

-- SELECT: cada um vê o próprio registro; admin vê todos.
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  using (id = auth.uid() or public.is_admin());

-- INSERT: cada um cria o próprio registro; admin cria qualquer um.
create policy "profiles_insert_self_or_admin"
  on public.profiles
  for insert
  with check (id = auth.uid() or public.is_admin());

-- UPDATE: cada um edita o próprio registro; admin edita todos.
-- A imutabilidade de `role` NÃO vive aqui — vive no trigger abaixo, que distingue
-- "editar o próprio nome" (permitido) de "promover a si mesmo" (proibido).
create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- impedir_auto_promocao (RN2): nenhum usuário altera a própria role.
-- A proibição vive NO BANCO, não na aplicação. Alteração de role só é aceita
-- quando o autor é admin ou o processo é service_role (servidor confiável).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.impedir_auto_promocao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- role inalterada → nada a checar (permite editar nome, telefone, etc.).
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- Alteração de role: só admin ou service_role.
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  raise exception 'Alteração de role não permitida: apenas admin ou service_role (RN2).'
    using errcode = '42501';
end;
$$;

create trigger trg_impedir_auto_promocao
  before update on public.profiles
  for each row execute function public.impedir_auto_promocao();
