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
--
-- NAPO-002: `cliente1` nasce COM telefone validado e `cliente2` SEM — é o par
-- que torna o gate testável à mão sem precisar de dois cadastros novos a cada
-- reset. Equipe fica sem telefone de propósito: ela não passa pelo gate (RN4),
-- e um seed com telefone em todo mundo esconderia uma regressão nisso.
insert into public.profiles (id, nome, email, role, telefone, telefone_validado_em)
values
  ('11111111-1111-1111-1111-111111111111', 'Cliente Um', 'cliente1@napo.test', 'cliente', '+5561991504477', now()),
  ('22222222-2222-2222-2222-222222222222', 'Cliente Dois', 'cliente2@napo.test', 'cliente', null, null),
  ('33333333-3333-3333-3333-333333333333', 'Atendente', 'atendente@napo.test', 'atendente', null, null),
  ('44444444-4444-4444-4444-444444444444', 'Cozinha', 'cozinha@napo.test', 'cozinha', null, null),
  ('55555555-5555-5555-5555-555555555555', 'Gerente', 'gerente@napo.test', 'gerente', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin', 'admin@napo.test', 'admin', null, null);

-- Consentimentos do cliente já validado, para que o estado do seed seja coerente
-- com o que o fluxo real produz (RN15).
insert into public.consentimentos (profile_id, tipo, versao, ip)
values
  ('11111111-1111-1111-1111-111111111111', 'termos', '0', '127.0.0.1'),
  ('11111111-1111-1111-1111-111111111111', 'privacidade', '0', '127.0.0.1');

-- ─────────────────────────────────────────────────────────────────────────────
-- Operação (NAPO-004). Valores confirmados com o PM em 2026-08-10: entrega
-- apenas na sexta, produção de segunda a sexta. A janela 17h–21h é premissa
-- em aberto (spec §7) — trocá-la é UPDATE, não migration.
--
-- Com um único dia de entrega, o freezer é a restrição dominante: 5 dias de
-- produção acumulam 150, exatamente a capacidade.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.config_operacao default values;

insert into public.dias_semana_entrega (dia_semana, entrega, janela_inicio, janela_fim)
values
  (0, false, '17:00', '21:00'),
  (1, false, '17:00', '21:00'),
  (2, false, '17:00', '21:00'),
  (3, false, '17:00', '21:00'),
  (4, false, '17:00', '21:00'),
  (5, true,  '17:00', '21:00'),
  (6, false, '17:00', '21:00');

insert into public.dias_semana_producao (dia_semana, produz)
values (0, false), (1, true), (2, true), (3, true), (4, true), (5, true), (6, false);
