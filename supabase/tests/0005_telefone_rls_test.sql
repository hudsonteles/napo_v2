-- ─────────────────────────────────────────────────────────────────────────────
-- T26, T29, T36, T44 — Desafios inalcançáveis, unicidade de telefone validado
-- e leitura de consentimentos.
--
-- Fixtures próprias (IDs 20000000-…), independentes do seed, com rollback ao
-- fim. Mesmo padrão do 0002: autentica trocando o role do Postgres e populando
-- o claim `sub`.
--
-- T27 (ninguém altera a própria role) NÃO é reimplementado aqui — já é provado
-- por 0002_profiles_rls_test.sql (T11 do NAPO-001), e o trigger é o mesmo.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(10);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 't2-cliente1@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 't2-cliente2@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 't2-admin@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values
  ('20000000-0000-0000-0000-000000000001', 'T2 Cliente 1', 't2-cliente1@napo.test', 'cliente'),
  ('20000000-0000-0000-0000-000000000002', 'T2 Cliente 2', 't2-cliente2@napo.test', 'cliente'),
  ('20000000-0000-0000-0000-00000000000a', 'T2 Admin', 't2-admin@napo.test', 'admin');

insert into public.telefone_verificacoes (profile_id, telefone, codigo_hash, expira_em)
values ('20000000-0000-0000-0000-000000000001', '+5561988887777', 'hash-irrelevante', now() + interval '10 minutes');

insert into public.consentimentos (profile_id, tipo, versao, ip)
values
  ('20000000-0000-0000-0000-000000000001', 'termos', '0', '203.0.113.10'),
  ('20000000-0000-0000-0000-000000000002', 'termos', '0', '203.0.113.11');

insert into public.auditoria (tabela, registro_id, acao, profile_id, motivo)
values ('profiles', '20000000-0000-0000-0000-000000000001', 'validacao_manual', '20000000-0000-0000-0000-00000000000a', 'fixture');

-- ── T26 — desafios são inalcançáveis pela chave anônima ─────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.telefone_verificacoes),
  0,
  'usuário autenticado não lê nenhum desafio, nem o próprio (T26)'
);

select throws_ok(
  $$ insert into public.telefone_verificacoes (profile_id, telefone, codigo_hash, expira_em)
     values ('20000000-0000-0000-0000-000000000001', '+5561999999999', 'forjado', now() + interval '10 minutes') $$,
  '42501',
  null,
  'usuário autenticado não grava desafio (T26)'
);

-- ── T36 — consentimento é privado de cada um ────────────────────────────────
select is(
  (select count(*)::int from public.consentimentos),
  1,
  'cliente lê apenas o próprio consentimento (T36)'
);

-- ── Auditoria é invisível para quem não é admin ─────────────────────────────
select is(
  (select count(*)::int from public.auditoria),
  0,
  'cliente não enxerga auditoria (T35)'
);

-- ── termos_versoes precisa ser legível ANTES de haver sessão ────────────────
reset role;
set local role anon;

select cmp_ok(
  (select count(*)::int from public.termos_versoes),
  '>=',
  2,
  'termos e privacidade são legíveis sem sessão — a tela de cadastro depende disso (T36)'
);

select throws_ok(
  $$ insert into public.termos_versoes (tipo, versao, conteudo) values ('termos', 'x', 'forjado') $$,
  '42501',
  null,
  'anônimo não publica versão de termos (T36)'
);

reset role;

-- ── Admin enxerga auditoria ─────────────────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

-- Conta só o que este teste produziu: `auditoria` é acumulativa e o banco local
-- carrega o rastro de qualquer uso anterior. Contagem global deixaria o teste
-- vermelho por motivo que não é regressão.
select is(
  (
    select count(*)::int
    from public.auditoria
    where registro_id = '20000000-0000-0000-0000-000000000001'
  ),
  1,
  'admin enxerga a auditoria (T33)'
);

reset role;

-- ── T29/T44 — unicidade do telefone validado ────────────────────────────────
-- Dois cadastros PODEM estar tentando o mesmo número ao mesmo tempo: alguém
-- errou a conta e recomeçou. O que o índice impede é os dois terminarem válidos.
update public.profiles set telefone = '+5561988887777' where id = '20000000-0000-0000-0000-000000000001';
update public.profiles set telefone = '+5561988887777' where id = '20000000-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.profiles where telefone = '+5561988887777'),
  2,
  'dois perfis não validados coexistem com o mesmo número (T29)'
);

update public.profiles set telefone_validado_em = now() where id = '20000000-0000-0000-0000-000000000001';

select throws_ok(
  $$ update public.profiles set telefone_validado_em = now() where id = '20000000-0000-0000-0000-000000000002' $$,
  '23505',
  null,
  'segundo perfil não consegue validar o mesmo número (T29, T44)'
);

-- ── Formato E.164 é imposto pelo banco ──────────────────────────────────────
select throws_ok(
  $$ update public.profiles set telefone = '61991504477' where id = '20000000-0000-0000-0000-00000000000a' $$,
  '23514',
  null,
  'telefone fora do formato E.164 é recusado pelo check (RN8)'
);

select * from finish();
rollback;
