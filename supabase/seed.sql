-- ─────────────────────────────────────────────────────────────────────────────
-- seed — Usuários determinísticos, um por role (+ um segundo cliente).
--
-- Pré-requisito dos testes de RLS: o isolamento entre clientes (T10) e o
-- bloqueio de escalada (T11–T13) só são testáveis com identidades reais e
-- IDs fixos. Rodado por `supabase db reset`. NÃO é dado de produção.
-- ─────────────────────────────────────────────────────────────────────────────

-- Insere em auth.users (a fonte) e deixa o profile explícito logo abaixo — sem
-- trigger de signup automático aqui: o fluxo de auth é NAPO-002.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'cliente1@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'cliente2@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'atendente@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'cozinha@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'gerente@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'admin@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- Perfis correspondentes, um por role.
insert into public.profiles (id, nome, email, role)
values
  ('11111111-1111-1111-1111-111111111111', 'Cliente Um', 'cliente1@napo.test', 'cliente'),
  ('22222222-2222-2222-2222-222222222222', 'Cliente Dois', 'cliente2@napo.test', 'cliente'),
  ('33333333-3333-3333-3333-333333333333', 'Atendente', 'atendente@napo.test', 'atendente'),
  ('44444444-4444-4444-4444-444444444444', 'Cozinha', 'cozinha@napo.test', 'cozinha'),
  ('55555555-5555-5555-5555-555555555555', 'Gerente', 'gerente@napo.test', 'gerente'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin', 'admin@napo.test', 'admin');
