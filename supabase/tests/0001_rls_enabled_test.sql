-- ─────────────────────────────────────────────────────────────────────────────
-- T9 (RN1) — Nenhuma tabela do schema public sem proteção.
--
-- O cenário mais importante do spec: continua valendo para tabelas que AINDA NÃO
-- existem, criadas em NAPO-002 a NAPO-009. Uma tabela nova sem RLS ou sem
-- política reprova o CI automaticamente, sem depender de ninguém lembrar.
--
-- Escrito em pgTAP puro (sem a extensão basejump), conforme design.md §8:
-- a verificação é uma consulta a catálogos do Postgres, não uma conveniência.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(2);

-- Toda tabela BASE do schema public tem RLS habilitada.
select is(
  (
    select count(*)::int
    from pg_tables t
    join pg_class c on c.relname = t.tablename
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
    where t.schemaname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  0,
  'Toda tabela do schema public tem RLS habilitada (RN1)'
);

-- Toda tabela do schema public tem ao menos uma política declarada.
select is(
  (
    select count(*)::int
    from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = t.tablename
      )
  ),
  0,
  'Toda tabela do schema public tem ao menos uma política declarada (RN1)'
);

select * from finish();
rollback;
