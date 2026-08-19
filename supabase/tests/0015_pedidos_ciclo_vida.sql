-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_pedidos_ciclo_vida — T28 (RN21 auditoria) e T39 (RN14 estorno).
--
-- O 0014 provou a atomicidade e a idempotência de confirmar_pagamento; aqui se
-- prova o RASTRO da confirmação e o estado terminal de estorno, que o bloco H
-- (webhook + ciclo de vida) acrescentou por cima.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(9);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'h-cliente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values ('75000000-0000-0000-0000-000000000001', 'H Cliente', 'h-cliente@napo.test', 'cliente');

\set produto '''dddddddd-0000-0000-0000-000000000002'''
\set dia     '''2026-10-16'''

-- ═════════════════════════════════════════════════════════════════════════════
-- T28 — a transição aguardando→pago é auditada (RN21)
-- ═════════════════════════════════════════════════════════════════════════════
insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  ('75ed0000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'aguardando_pagamento',
   :dia, '{}'::jsonb, 7980, 600, 8580, now() + interval '30 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values ('75ed0000-0000-0000-0000-000000000001', :produto, 'Calabresa', 2, 3990);

select is(
  public.confirmar_pagamento('75ed0000-0000-0000-0000-000000000001', 'mp-h-1', 'pix', 'viavel'),
  true,
  'confirmar_pagamento confirma e devolve true');

select is(
  (select count(*)::int from public.auditoria
    where tabela = 'pedidos' and registro_id = '75ed0000-0000-0000-0000-000000000001'
      and acao = 'confirmacao_pagamento'),
  1,
  'T28 — a confirmação deixa exatamente um registro de auditoria');

select is(
  (select dados_antes->>'status' from public.auditoria
    where registro_id = '75ed0000-0000-0000-0000-000000000001' and acao = 'confirmacao_pagamento'),
  'aguardando_pagamento',
  'T28 — a auditoria guarda o estado anterior');

select is(
  (select dados_depois->>'status' from public.auditoria
    where registro_id = '75ed0000-0000-0000-0000-000000000001' and acao = 'confirmacao_pagamento'),
  'pago',
  'T28 — a auditoria guarda o estado posterior');

-- Confirmar de novo (idempotente) não gera segundo registro de auditoria.
select is(
  public.confirmar_pagamento('75ed0000-0000-0000-0000-000000000001', 'mp-h-1', 'pix', 'viavel'),
  false,
  'T7/RN9 — reconfirmar devolve false');

select is(
  (select count(*)::int from public.auditoria
    where registro_id = '75ed0000-0000-0000-0000-000000000001' and acao = 'confirmacao_pagamento'),
  1,
  'T28 — a reconfirmação idempotente não duplica o rastro');

-- ═════════════════════════════════════════════════════════════════════════════
-- T39 — estorno notificado reflete no pedido e devolve a vaga (RN14)
-- ═════════════════════════════════════════════════════════════════════════════
-- O pedido acima está pago e ocupando vaga.
select is(public.vagas_ocupadas(:dia, :produto), 2,
  'T39 — pedido pago ocupa a vaga antes do estorno');

select is(
  public.estornar_pedido('75ed0000-0000-0000-0000-000000000001', 'lote'),
  true,
  'T39 — estornar_pedido reflete o estorno e devolve true');

select is(public.vagas_ocupadas(:dia, :produto), 0,
  'T39/RN14 — estornado devolve a vaga e registra a devolução');

select * from finish();
rollback;
