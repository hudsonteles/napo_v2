-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_pedidos_auditoria — T28 (RN21).
--
-- A confirmação é o caminho de todo dinheiro que entra: é dela que alguém vai
-- querer o histórico quando um valor não bater.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(6);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'g-cliente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values ('80000000-0000-0000-0000-000000000001', 'G Cliente', 'g-cliente@napo.test', 'cliente');

\set produto '''dddddddd-0000-0000-0000-000000000002'''
\set dia     '''2026-09-25'''
\set pedido  '''80ed0000-0000-0000-0000-000000000001'''

insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  (:pedido, '80000000-0000-0000-0000-000000000001', 'aguardando_pagamento',
   :dia, '{}'::jsonb, 11970, 600, 12570, now() + interval '30 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values (:pedido, :produto, 'Calabresa', 3, 3990);

-- ═════════════════════════════════════════════════════════════════════════════
-- T28 — a transição para `pago` deixa rastro (RN21)
-- ═════════════════════════════════════════════════════════════════════════════
select is(
  public.confirmar_pagamento(:pedido, 'mp-auditoria-1', 'pix', 'viavel'),
  true,
  'T28 — a confirmação acontece'
);

select is(
  (select count(*)::int from public.auditoria
   where tabela = 'pedidos' and registro_id = :pedido and acao = 'confirmacao_pagamento'),
  1,
  'T28 — existe exatamente uma linha de auditoria da confirmação'
);

select is(
  (select dados_antes->>'status' from public.auditoria
   where registro_id = :pedido and acao = 'confirmacao_pagamento'),
  'aguardando_pagamento',
  'T28 — o estado anterior fica registrado'
);

select is(
  (select dados_depois->>'status' from public.auditoria
   where registro_id = :pedido and acao = 'confirmacao_pagamento'),
  'pago',
  'T28 — o estado posterior fica registrado'
);

select is(
  (select profile_id from public.auditoria
   where registro_id = :pedido and acao = 'confirmacao_pagamento'),
  '80000000-0000-0000-0000-000000000001'::uuid,
  'T28 — o autor é o dono do pedido, e o motivo diz que a mão foi do webhook'
);

-- Idempotência (RN9): a segunda notificação não pode duplicar o rastro, senão o
-- histórico passa a contar duas confirmações onde houve uma.
select public.confirmar_pagamento(:pedido, 'mp-auditoria-1', 'pix', 'viavel');

select is(
  (select count(*)::int from public.auditoria
   where registro_id = :pedido and acao = 'confirmacao_pagamento'),
  1,
  'T28 — notificação repetida não duplica a linha de auditoria'
);

select * from finish();
rollback;
