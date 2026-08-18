-- ─────────────────────────────────────────────────────────────────────────────
-- 0012_enderecos_rls — T16, T19 (RN1, RN13, RN15).
--
-- O isolamento entre clientes é a proteção mais crítica desta spec: endereço com
-- coordenada é onde a pessoa mora. Prova quatro coisas: (1) endereço alheio não
-- existe para quem não é dono — não é "proibido", é invisível; (2) equipe lê e
-- não escreve; (3) o banco recusa dois padrões do mesmo cliente; (4) ninguém
-- apaga endereço.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(15);

-- ── Fixtures (como superusuário) ────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'e-cliente-a@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'e-cliente-b@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'e-atendente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values
  ('50000000-0000-0000-0000-000000000001', 'E Cliente A', 'e-cliente-a@napo.test', 'cliente'),
  ('50000000-0000-0000-0000-000000000002', 'E Cliente B', 'e-cliente-b@napo.test', 'cliente'),
  ('50000000-0000-0000-0000-00000000000a', 'E Atendente', 'e-atendente@napo.test', 'atendente');

insert into public.enderecos
  (id, profile_id, apelido, cep, logradouro, numero, complemento, cidade, uf, lat, lng, distancia_km, atendido, padrao)
values
  ('5e000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
   'Casa', '70862030', 'SQN 210 Bloco C', 's/n', 'Apto 302', 'Brasília', 'DF', -15.7565, -47.8850, 3.40, true, true),
  ('5e000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002',
   'Casa do B', '70302000', 'SCS Quadra 2 Bloco C', '30', 'Sala 401', 'Brasília', 'DF', -15.7980, -47.8920, 9.10, true, true);

-- ── Propriedade estática: is_equipe() fixa search_path ──────────────────────
select ok(
  (
    select array_to_string(proconfig, ',') like 'search_path=%'
    from pg_proc
    where proname = 'is_equipe'
      and pronamespace = 'public'::regnamespace
  ),
  'is_equipe() tem search_path fixo, impedindo desvio por objeto homônimo'
);

-- ── Configuração de área e faixas nasceram com a migration ──────────────────
select is((select count(*)::int from public.faixas_frete), 3,
  'as três faixas de frete são semeadas pela migration (RN7)');
select is((select raio_km from public.config_operacao), 12::numeric(5,2),
  'raio de atuação vive em config_operacao, não no código (RN7)');
select isnt((select lat_cozinha from public.config_operacao), null,
  'a origem de toda distância do sistema está configurada (RN5)');

-- ── T16 (RN1) — endereço alheio não existe para quem não é dono ─────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '50000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from public.enderecos), 1,
  'cliente A enxerga apenas o próprio endereço (T16)');

select is(
  (select count(*)::int from public.enderecos where id = '5e000000-0000-0000-0000-000000000002'),
  0,
  'endereço do cliente B é invisível para A — não encontrado, não proibido (T16)');

-- Editar pelo id alheio não afeta linha nenhuma: a RLS esconde antes de negar.
do $$
declare
  afetadas int;
begin
  update public.enderecos set apelido = 'Sequestrado'
  where id = '5e000000-0000-0000-0000-000000000002';
  get diagnostics afetadas = row_count;
  perform set_config('napo.t16_afetadas', afetadas::text, true);
end $$;

select is(current_setting('napo.t16_afetadas')::int, 0,
  'cliente A não altera endereço de B — 0 linhas afetadas (T16)');

-- Criar endereço em nome de outro é recusado pelo WITH CHECK.
select throws_ok(
  $$insert into public.enderecos (profile_id, apelido, cep, logradouro, numero, cidade, uf, lat, lng)
    values ('50000000-0000-0000-0000-000000000002', 'Plantado', '70862030', 'SQN 210', '1', 'Brasília', 'DF', -15.75, -47.88)$$,
  '42501',
  null,
  'cliente A não cria endereço em nome de B (T16)'
);

-- ── RN13 — o banco recusa o segundo padrão ativo do mesmo cliente ───────────
select throws_ok(
  $$insert into public.enderecos (profile_id, apelido, cep, logradouro, numero, cidade, uf, lat, lng, padrao)
    values ('50000000-0000-0000-0000-000000000001', 'Segundo padrão', '70862030', 'SQN 211', '2', 'Brasília', 'DF', -15.75, -47.88, true)$$,
  '23505',
  null,
  'índice único parcial impede dois endereços padrão por cliente (RN13)'
);

-- ── RN15 — endereço não é apagado ───────────────────────────────────────────
-- O privilégio de DELETE é revogado na migration, não só deixado sem política:
-- sem a revogação isto devolveria zero linha em silêncio e uma política `for
-- all` acrescentada amanhã reabriria o caminho.
select throws_ok(
  $$delete from public.enderecos where id = '5e000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'nem o dono apaga endereço — privilégio revogado, não só sem política (RN15)'
);

-- Cliente não alcança a lista de CEPs barrados: é informação de operação.
select is((select count(*)::int from public.excecoes_area), 0,
  'cliente não lê exceções de área (RN10)');

reset role;

-- ── T19 (RN1) — equipe lê, não escreve ──────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '50000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

-- Conta só os endereços das fixtures, não a tabela inteira: o banco local
-- carrega dado de desenvolvimento, e um teste que depende do total afirma sobre
-- o ambiente em vez de afirmar sobre a política.
select is(
  (select count(*)::int from public.enderecos
   where profile_id in ('50000000-0000-0000-0000-000000000001',
                        '50000000-0000-0000-0000-000000000002')),
  2,
  'atendente lê o endereço dos dois clientes, para suporte e separação (T19)');

do $$
declare
  afetadas int;
begin
  update public.enderecos set apelido = 'Corrigido pelo atendente'
  where id = '5e000000-0000-0000-0000-000000000001';
  get diagnostics afetadas = row_count;
  perform set_config('napo.t19_afetadas', afetadas::text, true);
end $$;

select is(current_setting('napo.t19_afetadas')::int, 0,
  'atendente não reescreve endereço no lugar do cliente (T19)');

select throws_ok(
  $$insert into public.enderecos (profile_id, apelido, cep, logradouro, numero, cidade, uf, lat, lng)
    values ('50000000-0000-0000-0000-000000000001', 'Criado pelo atendente', '70862030', 'SQN 210', '1', 'Brasília', 'DF', -15.75, -47.88)$$,
  '42501',
  null,
  'atendente não cria endereço em nome do cliente (T19)'
);

reset role;

-- Anônimo nem chega à RLS: o privilégio foi revogado na migration. A diferença
-- importa — "0 linhas" depende de política, "permission denied" não depende.
set local role anon;
select throws_ok(
  $$select count(*) from public.enderecos$$,
  '42501',
  null,
  'anônimo não alcança endereço de ninguém (RN1)'
);
reset role;

select * from finish();
rollback;
