-- ─────────────────────────────────────────────────────────────────────────────
-- T16, T19 (RN1) — Isolamento de endereços e leitura-sem-escrita da equipe.
--
-- O dado mais sensível do projeto (onde a pessoa mora). Prova que: (1) o
-- endereço de um cliente é INVISÍVEL para outro — não "proibido", inexistente
-- (T16); (2) a equipe LÊ o endereço para dar suporte, mas não ESCREVE no lugar
-- do cliente (T19). Fixtures próprias com rollback ao fim, no molde do 0002.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(7);

-- ── Fixtures (como superusuário) ────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 't-endA@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 't-endB@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 't-atendente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values
  ('20000000-0000-0000-0000-000000000001', 'T Endereço A', 't-endA@napo.test', 'cliente'),
  ('20000000-0000-0000-0000-000000000002', 'T Endereço B', 't-endB@napo.test', 'cliente'),
  ('20000000-0000-0000-0000-000000000003', 'T Atendente', 't-atendente@napo.test', 'atendente');

-- Endereço do cliente A.
insert into public.enderecos (id, profile_id, logradouro, numero, cidade, uf, lat, lng, atendido, padrao)
values (
  '2ddddddd-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'SQN 210 Bloco C', '302', 'Brasília', 'DF', -15.780000, -47.890000, true, true
);

-- ── T19 (propriedade) — is_equipe() distingue equipe de cliente ──────────────
select is(
  (select array_to_string(proconfig, ',') like 'search_path=%'
   from pg_proc
   where proname = 'is_equipe' and pronamespace = 'public'::regnamespace),
  true,
  'is_equipe() tem search_path fixo, como is_admin (T19)'
);

-- ── T16 — cliente B não enxerga o endereço de A ─────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.enderecos),
  0,
  'cliente B não vê nenhum endereço — o de A é invisível, não proibido (T16)'
);

-- UPDATE em endereço alheio não afeta linha alguma: a RLS esconde a linha.
do $$
declare afetadas int;
begin
  update public.enderecos set rotulo = 'Hack'
  where id = '2ddddddd-0000-0000-0000-000000000001';
  get diagnostics afetadas = row_count;
  perform set_config('napo.t16_afetadas', afetadas::text, true);
end $$;

select is(
  current_setting('napo.t16_afetadas')::int,
  0,
  'cliente B não altera endereço de A — 0 linhas afetadas (T16)'
);

reset role;

-- ── T19 — atendente LÊ o endereço, mas não escreve ──────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.enderecos),
  1,
  'atendente lê o endereço do cliente para dar suporte (T19)'
);

-- UPDATE pela equipe: a política de update exige profile_id = auth.uid(), então
-- a linha do cliente A é invisível para escrita → 0 linhas afetadas.
do $$
declare afetadas int;
begin
  update public.enderecos set rotulo = 'Editado pela equipe'
  where id = '2ddddddd-0000-0000-0000-000000000001';
  get diagnostics afetadas = row_count;
  perform set_config('napo.t19_afetadas', afetadas::text, true);
end $$;

select is(
  current_setting('napo.t19_afetadas')::int,
  0,
  'atendente não altera endereço do cliente — 0 linhas afetadas (T19)'
);

-- INSERT em nome de outro é barrado pelo with check (profile_id = auth.uid()).
select throws_ok(
  $$insert into public.enderecos (profile_id, logradouro, numero, cidade, uf, lat, lng)
    values ('20000000-0000-0000-0000-000000000001', 'Fraude', '1', 'Brasília', 'DF', -15.79, -47.88)$$,
  '42501',
  null,
  'atendente não cria endereço em nome do cliente (T19)'
);

reset role;

-- Confirma (superusuário) que o rótulo original permaneceu intacto.
select is(
  (select rotulo from public.enderecos where id = '2ddddddd-0000-0000-0000-000000000001'),
  null,
  'endereço de A permanece intacto após as tentativas de escrita alheia (T16/T19)'
);

select * from finish();
rollback;
