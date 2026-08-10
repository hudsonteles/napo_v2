-- ─────────────────────────────────────────────────────────────────────────────
-- T10–T13 (RN1, RN2) — Isolamento entre clientes e imutabilidade de role.
--
-- Fixtures próprias (IDs 10000000-…), independentes do seed: o teste cria os
-- usuários que precisa dentro da transação e faz rollback ao fim. Autentica
-- trocando o role do Postgres para `authenticated` e populando o claim JWT
-- `sub` — é assim que auth.uid() e auth.role() enxergam o "usuário logado".
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(8);

-- ── Fixtures (como superusuário) ────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 't-cliente1@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 't-cliente2@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 't-admin@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values
  ('10000000-0000-0000-0000-000000000001', 'T Cliente 1', 't-cliente1@napo.test', 'cliente'),
  ('10000000-0000-0000-0000-000000000002', 'T Cliente 2', 't-cliente2@napo.test', 'cliente'),
  ('10000000-0000-0000-0000-00000000000a', 'T Admin', 't-admin@napo.test', 'admin');

-- ── Propriedade estática: is_admin() fixa search_path (T12) ──────────────────
select ok(
  (
    select array_to_string(proconfig, ',') like 'search_path=%'
    from pg_proc
    where proname = 'is_admin'
      and pronamespace = 'public'::regnamespace
  ),
  'is_admin() tem search_path fixo, impedindo desvio por objeto homônimo (T12)'
);

-- ── T10 — cliente não enxerga dado de outro cliente ─────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '10000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.profiles),
  1,
  'cliente autenticado enxerga apenas o próprio profile (T10)'
);

-- ── T11 — usuário não promove a si mesmo ────────────────────────────────────
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501',
  'Alteração de role não permitida: apenas admin ou service_role (RN2).',
  'cliente não promove a si mesmo — trigger rejeita (T11)'
);

-- ── T12 — escalada indireta também é bloqueada ──────────────────────────────
-- Ainda autenticado como cliente1, tentar mudar o role de OUTRO usuário não
-- afeta nenhuma linha (RLS esconde a linha). Capturamos a contagem afetada num
-- bloco DO — CTE que modifica dados não pode ser subconsulta de uma asserção.
do $$
declare
  afetadas int;
begin
  update public.profiles set role = 'admin'
  where id = '10000000-0000-0000-0000-000000000002';
  get diagnostics afetadas = row_count;
  perform set_config('napo.t12_afetadas', afetadas::text, true);
end $$;

select is(
  current_setting('napo.t12_afetadas')::int,
  0,
  'cliente não altera role de outro usuário — 0 linhas afetadas (T12)'
);

select is(
  public.is_admin(),
  false,
  'is_admin() retorna falso para o cliente (T12)'
);

reset role;

-- Confirma (como superusuário) que a role do cliente permaneceu intacta após T11.
select is(
  (select role::text from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'cliente',
  'role permanece cliente após tentativa de auto-promoção (T11)'
);

-- ── T13 — admin altera role, como esperado ──────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '10000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

select lives_ok(
  $$ update public.profiles set role = 'cozinha' where id = '10000000-0000-0000-0000-000000000002' $$,
  'admin consegue alterar a role de um cliente (T13)'
);

reset role;

select is(
  (select role::text from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  'cozinha',
  'alteração de role pelo admin é persistida (T13)'
);

select * from finish();
rollback;
