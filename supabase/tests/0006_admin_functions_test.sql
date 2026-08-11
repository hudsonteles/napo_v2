-- ─────────────────────────────────────────────────────────────────────────────
-- T32-T35 — Override de admin e promoção de papel.
--
-- As duas funções são SECURITY DEFINER: executam com os privilégios do dono e
-- portanto ignoram RLS. É exatamente por isso que precisam de teste — uma
-- checagem de autor esquecida aqui vale escalada de privilégio para qualquer
-- usuário autenticado.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(9);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 't3-cliente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 't3-gerente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 't3-admin@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values
  ('30000000-0000-0000-0000-000000000001', 'T3 Cliente', 't3-cliente@napo.test', 'cliente'),
  ('30000000-0000-0000-0000-000000000009', 'T3 Gerente', 't3-gerente@napo.test', 'gerente'),
  ('30000000-0000-0000-0000-00000000000a', 'T3 Admin', 't3-admin@napo.test', 'admin');

-- ── Propriedade estática: search_path fixo nas duas funções ─────────────────
select is(
  (
    select count(*)::int
    from pg_proc
    where proname in ('validar_telefone_manual', 'promover_usuario')
      and pronamespace = 'public'::regnamespace
      and array_to_string(proconfig, ',') like 'search_path=%'
  ),
  2,
  'as duas funções SECURITY DEFINER têm search_path fixo (T32)'
);

-- ── T32 — quem não é admin não executa ──────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '30000000-0000-0000-0000-000000000009', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ select public.validar_telefone_manual('30000000-0000-0000-0000-000000000001', '+5561977776666', 'tentativa indevida') $$,
  '42501',
  null,
  'gerente não valida telefone manualmente (T32)'
);

select throws_ok(
  $$ select public.promover_usuario('30000000-0000-0000-0000-000000000001', 'admin', 'tentativa indevida') $$,
  '42501',
  null,
  'gerente não promove ninguém (T32)'
);

reset role;

select is(
  (select count(*)::int from public.auditoria),
  0,
  'tentativa recusada não gera linha de auditoria (T32)'
);

-- ── T33/T34 — admin executa, com motivo obrigatório ─────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '30000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

select throws_ok(
  $$ select public.validar_telefone_manual('30000000-0000-0000-0000-000000000001', '+5561977776666', '   ') $$,
  '22023',
  null,
  'motivo em branco é recusado (T34)'
);

select lives_ok(
  $$ select public.validar_telefone_manual('30000000-0000-0000-0000-000000000001', '+5561977776666', 'WhatsApp do cliente sem sinal — validado por ligação') $$,
  'admin valida telefone manualmente (T33)'
);

-- ── T35 — nem o admin escreve auditoria à mão ───────────────────────────────
select throws_ok(
  $$ insert into public.auditoria (tabela, registro_id, acao, motivo) values ('profiles', '30000000-0000-0000-0000-000000000001', 'forjado', 'forjado') $$,
  '42501',
  null,
  'admin não insere auditoria diretamente (T35)'
);

select lives_ok(
  $$ select public.promover_usuario('30000000-0000-0000-0000-000000000001', 'cozinha', 'contratação de agosto') $$,
  'admin promove usuário (T33)'
);

reset role;

-- ── Efeitos persistidos, com rastro completo ────────────────────────────────
select is(
  (
    select count(*)::int
    from public.profiles p
    join public.auditoria a
      on a.registro_id = p.id
     and a.profile_id = '30000000-0000-0000-0000-00000000000a'
     and a.motivo is not null
    where p.id = '30000000-0000-0000-0000-000000000001'
      and p.telefone = '+5561977776666'
      and p.telefone_validado_em is not null
      and p.role = 'cozinha'
  ),
  2,
  'telefone validado e papel promovido, cada um com sua linha de auditoria (T33)'
);

select * from finish();
rollback;
