-- ─────────────────────────────────────────────────────────────────────────────
-- T15, T18, T19 (RN10, RN11) — Estoque privado e reserva que não estoura o teto.
--
-- Nota de honestidade sobre T18: pgTAP roda em sessão única, então nenhum teste
-- aqui prova a corrida real entre duas transações. O que é provado: (a) a
-- contagem recusa a vaga além do limite, e (b) a função declara o advisory
-- lock que serializa o trecho crítico. A corrida em si é garantida pelo lock,
-- verificado estruturalmente.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(7);

-- Fixtures: produto fictício (a tabela `produtos` chega em NAPO-003) e lotes.
insert into public.lotes (produto_id, quantidade, produzido_em, validade, dia_entrega_alocado)
values ('dddddddd-0000-0000-0000-000000000001', 10, '2026-08-10', '2026-09-30', '2026-08-14');

insert into public.producao_planejada (data, produto_id, quantidade)
values ('2026-08-13', 'dddddddd-0000-0000-0000-000000000001', 5);

-- ── T15 — estoque não vaza para o cliente ───────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;

select is((select count(*)::int from public.lotes), 0,
  'cliente não enxerga lotes (T15)');

select is((select count(*)::int from public.producao_planejada), 0,
  'cliente não enxerga producao_planejada (T15)');

reset role;

-- ── T18 — a reserva respeita o limite recebido ──────────────────────────────
-- Limite 1: a primeira reserva entra, a segunda é recusada.
select lives_ok(
  $$select public.reservar_capacidade(
      '2026-08-14'::date, 'dddddddd-0000-0000-0000-000000000001'::uuid, 1,
      '11111111-1111-1111-1111-111111111111'::uuid, 1)$$,
  'primeira reserva ocupa a última vaga (T18)'
);

select throws_ok(
  $$select public.reservar_capacidade(
      '2026-08-14'::date, 'dddddddd-0000-0000-0000-000000000001'::uuid, 1,
      '22222222-2222-2222-2222-222222222222'::uuid, 1)$$,
  'P0001',
  null,
  'segunda reserva é recusada antes de qualquer cobrança (T18)'
);

-- O lock que serializa o trecho crítico está declarado na função.
select ok(
  (select pg_get_functiondef(p.oid) like '%pg_advisory_xact_lock%'
   from pg_proc p where p.proname = 'reservar_capacidade'
     and p.pronamespace = 'public'::regnamespace),
  'reservar_capacidade serializa por advisory lock do dia (T18)'
);

-- ── T19 — reserva expirada devolve a vaga, sem job ──────────────────────────
update public.reservas
   set expira_em = now() - interval '1 minute'
 where dia_entrega = '2026-08-14';

select is(
  public.vagas_ocupadas('2026-08-14'::date, 'dddddddd-0000-0000-0000-000000000001'::uuid),
  0,
  'reserva vencida some da contagem no instante em que expira (T19)'
);

select lives_ok(
  $$select public.reservar_capacidade(
      '2026-08-14'::date, 'dddddddd-0000-0000-0000-000000000001'::uuid, 1,
      '22222222-2222-2222-2222-222222222222'::uuid, 1)$$,
  'a vaga liberada pela expiração volta a ser vendável (T19)'
);

select * from finish();
rollback;
