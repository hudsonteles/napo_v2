-- ─────────────────────────────────────────────────────────────────────────────
-- T16 (RN3) — Calendário é público; configuração de capacidade não é.
--
-- A vitrine precisa saber que sexta é dia de entrega para montar o seletor de
-- data sem sessão. Os tetos de forno e freezer são outra coisa: revelam a
-- capacidade instalada do negócio e não são necessários no browser, porque o
-- cálculo de disponibilidade roda no servidor.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(7);

-- ── Anônimo: calendário legível ─────────────────────────────────────────────
set local role anon;

select ok(
  (select count(*) from public.dias_semana_entrega) > 0,
  'anon lê dias_semana_entrega (a vitrine monta o seletor sem sessão)'
);

select ok(
  (select count(*) from public.dias_semana_producao) > 0,
  'anon lê dias_semana_producao'
);

select lives_ok(
  'select 1 from public.excecoes_calendario',
  'anon lê excecoes_calendario sem erro, mesmo vazia'
);

-- Escrita no calendário é recusada para quem não é admin.
select throws_ok(
  $$insert into public.excecoes_calendario (data, tipo, motivo)
    values ('2026-12-25', 'sem_producao', 'anon nao deveria conseguir')$$,
  '42501',
  null,
  'anon não escreve no calendário'
);

-- Configuração de capacidade não é pública.
select is(
  (select count(*)::int from public.config_operacao),
  0,
  'anon não enxerga config_operacao (tetos não vão para o browser)'
);

reset role;

-- ── Cliente autenticado: também não enxerga a configuração ──────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.config_operacao),
  0,
  'cliente autenticado não enxerga config_operacao'
);

reset role;

-- ── Admin: enxerga a configuração ───────────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (select count(*)::int from public.config_operacao),
  1,
  'admin enxerga a linha única de config_operacao'
);

reset role;

select * from finish();
rollback;
