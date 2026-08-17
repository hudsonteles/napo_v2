-- ─────────────────────────────────────────────────────────────────────────────
-- 0010_catalogo_rls — T8, T16, T17, T18 (RN2, RN12, RN1).
--
-- A primeira superfície do banco exposta a anônimo. Prova três coisas: (1) o
-- CHECK de rotulagem impede publicar produto incompleto; (2) anônimo lê o
-- catálogo ATIVO e nada além dele; (3) anônimo não escreve. O seed já traz 12
-- produtos ativos, 3 categorias e 4 faixas — a fixture aqui só acrescenta um
-- produto INATIVO e incompleto, que serve ao T8 e ao T18.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(12);

-- Produto inativo e sem rotulagem (o insert passa porque o CHECK só exige
-- rotulagem quando ativo = true).
insert into public.produtos (id, categoria_id, faixa_preco_id, nome, slug, ativo)
values ('eeeeeeee-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        'fa000000-0000-0000-0000-000000000001',
        'Descontinuada', 'descontinuada', false);

-- ── T8 (RN2) — CHECK barra publicar produto incompleto ──────────────────────
-- Roda como superuser de propósito: RLS é irrelevante aqui, o que se prova é o
-- CHECK. Ativar sem rotulagem tem de ser impossível, não improvável.
select throws_ok(
  $$update public.produtos set ativo = true where slug = 'descontinuada'$$,
  '23514',
  null,
  'CHECK recusa ativar produto sem rotulagem (T8)'
);

-- ── Anônimo daqui para baixo ────────────────────────────────────────────────
set local role anon;

-- T16 — lê o catálogo público (só o ativo)
select is((select count(*)::int from public.produtos), 12,
  'anon vê os 12 produtos ativos, não o inativo (T16)');
select is((select count(*)::int from public.categorias), 3,
  'anon lê categorias (T16)');
select is((select count(*)::int from public.faixas_preco), 4,
  'anon lê faixas_preco (T16)');

-- T16 — e nada além dele: deny-by-default devolve vazio nas demais tabelas
select is((select count(*)::int from public.profiles), 0,
  'anon não alcança profiles (T16)');
select is((select count(*)::int from public.lotes), 0,
  'anon não alcança lotes (T16)');
select is((select count(*)::int from public.reservas), 0,
  'anon não alcança reservas (T16)');
select is((select count(*)::int from public.auditoria), 0,
  'anon não alcança auditoria (T16)');

-- T18 (RN1/RN12) — produto inativo é invisível para anônimo
select is((select count(*)::int from public.produtos where slug = 'descontinuada'), 0,
  'anon não vê produto inativo (T18)');

-- ── T17 (RN12) — anônimo não escreve ────────────────────────────────────────
-- INSERT é barrado pela RLS (não há política permissiva de escrita para anon).
select throws_ok(
  $$insert into public.produtos (categoria_id, faixa_preco_id, nome, slug)
    values ('c0000000-0000-0000-0000-000000000001',
            'fa000000-0000-0000-0000-000000000001', 'Hack', 'hack')$$,
  '42501',
  null,
  'anon não insere em produtos (T17)'
);

-- UPDATE/DELETE não lançam: a RLS torna as linhas invisíveis, então a operação
-- atinge zero linhas. É o mesmo efeito — anon não muda nada.
select is_empty(
  $$update public.produtos set nome = 'Hack' where slug = 'margherita' returning 1$$,
  'anon não atualiza produtos: zero linhas afetadas (T17)'
);
select is_empty(
  $$delete from public.produtos where slug = 'margherita' returning 1$$,
  'anon não remove produtos: zero linhas afetadas (T17)'
);

reset role;

select * from finish();
rollback;
