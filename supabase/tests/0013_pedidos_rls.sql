-- ─────────────────────────────────────────────────────────────────────────────
-- 0013_pedidos_rls — T17, T22, T23, T24 (RN16, RN17).
--
-- Pedido é dinheiro: prova (1) que pedido alheio é invisível, não "proibido";
-- (2) que a equipe lê e não escreve; (3) que nem o dono escreve — pedido nasce
-- e muda por servidor; (4) que o número é único, sequencial e não reciclado.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(18);

-- ── Fixtures (como superusuário) ────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p-cliente-a@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p-cliente-b@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'p-atendente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'p-gerente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values
  ('60000000-0000-0000-0000-000000000001', 'P Cliente A', 'p-cliente-a@napo.test', 'cliente'),
  ('60000000-0000-0000-0000-000000000002', 'P Cliente B', 'p-cliente-b@napo.test', 'cliente'),
  ('60000000-0000-0000-0000-00000000000a', 'P Atendente', 'p-atendente@napo.test', 'atendente'),
  ('60000000-0000-0000-0000-00000000000b', 'P Gerente',   'p-gerente@napo.test',   'gerente');

insert into public.pedidos
  (id, profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  ('60ed0000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   current_date + 3, '{"logradouro":"SQN 210 Bloco C","numero":"s/n"}'::jsonb, 12970, 600, 13570, now() + interval '30 min'),
  ('60ed0000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002',
   current_date + 3, '{"logradouro":"SCS Quadra 2","numero":"30"}'::jsonb, 3990, 1000, 4990, now() + interval '30 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values
  ('60ed0000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'Calabresa', 2, 3990);

-- ── T17 — número é único, sequencial e não reciclado (RN16) ─────────────────
select isnt(
  (select numero from public.pedidos where id = '60ed0000-0000-0000-0000-000000000001'),
  (select numero from public.pedidos where id = '60ed0000-0000-0000-0000-000000000002'),
  'T17 — dois pedidos recebem números distintos'
);

select ok(
  (select numero from public.pedidos where id = '60ed0000-0000-0000-0000-000000000002')
  > (select numero from public.pedidos where id = '60ed0000-0000-0000-0000-000000000001'),
  'T17 — o número cresce com a ordem de criação'
);

select ok(
  (select numero from public.pedidos where id = '60ed0000-0000-0000-0000-000000000001') >= 1000,
  'T17 — a sequência começa em 1000, não em 1'
);

-- Cancelar não devolve o número à sequência: nextval nunca recua.
update public.pedidos set status = 'cancelado' where id = '60ed0000-0000-0000-0000-000000000002';
insert into public.pedidos
  (id, profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  ('60ed0000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001',
   current_date + 3, '{}'::jsonb, 3990, 600, 4590, now() + interval '30 min');

select ok(
  (select numero from public.pedidos where id = '60ed0000-0000-0000-0000-000000000003')
  > (select numero from public.pedidos where id = '60ed0000-0000-0000-0000-000000000002'),
  'T17 — número de pedido cancelado não é reaproveitado'
);

-- ── Invariantes de integridade que o banco recusa ───────────────────────────
select throws_ok(
  $$insert into public.pedidos (profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
    values ('60000000-0000-0000-0000-000000000001', current_date + 3, '{}'::jsonb, 12970, 600, 99999, now())$$,
  '23514',
  null,
  'total que não é subtotal + frete é recusado pelo banco'
);

select throws_ok(
  $$insert into public.pedidos (profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
    values ('60000000-0000-0000-0000-000000000001', 'pago', current_date + 3, '{}'::jsonb, 3990, 600, 4590, now())$$,
  '23514',
  null,
  'pedido pago sem identificador de pagamento é recusado (sem prova de pagamento)'
);

select throws_ok(
  $$insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
    values ('60ed0000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'Calabresa', 1, 3990)$$,
  '23505',
  null,
  'o mesmo produto duas vezes no mesmo pedido é recusado: quantidade é campo, não linha repetida'
);

-- Idempotência do webhook garantida pelo índice, não pela aplicação (RN9).
update public.pedidos
  set status = 'pago', mp_payment_id = 'mp-1', pago_em = now()
  where id = '60ed0000-0000-0000-0000-000000000001';

select throws_ok(
  $$update public.pedidos set status = 'pago', mp_payment_id = 'mp-1', pago_em = now()
    where id = '60ed0000-0000-0000-0000-000000000003'$$,
  '23505',
  null,
  'T35/RN9 — o mesmo mp_payment_id não confirma dois pedidos'
);

-- ── T23 — cliente A não lê pedido de B (RN17) ───────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.pedidos where id = '60ed0000-0000-0000-0000-000000000002'),
  0,
  'T23 — pedido do cliente B é invisível para A: não é proibido, não existe'
);

select is(
  (select count(*)::int from public.pedidos where profile_id = auth.uid()),
  2,
  'T23 — cliente A lê os próprios pedidos'
);

select is(
  (select count(*)::int from public.pedido_itens),
  1,
  'T23 — itens seguem a visibilidade do pedido dono'
);

-- ── T22 — nem o dono escreve: pedido nasce e muda por servidor (RN17) ───────
select throws_ok(
  $$update public.pedidos set status = 'pago' where profile_id = auth.uid()$$,
  '42501',
  null,
  'T22 — o dono não altera o status do próprio pedido'
);

select throws_ok(
  $$insert into public.pedidos (profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
    values (auth.uid(), current_date + 3, '{}'::jsonb, 1, 0, 1, now())$$,
  '42501',
  null,
  'T22 — o cliente não cria pedido direto: preço e frete são decididos no servidor'
);

select throws_ok(
  $$delete from public.pedidos where profile_id = auth.uid()$$,
  '42501',
  null,
  'T22 — pedido não é apagado por ninguém'
);

-- ── T24 — equipe lê tudo, escreve nada (RN17) ──────────────────────────────
set local request.jwt.claims = '{"sub":"60000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::int from public.pedidos),
  3,
  'T24 — atendente lê todos os pedidos para operar'
);

select throws_ok(
  $$insert into public.pedidos (profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
    values ('60000000-0000-0000-0000-000000000001', current_date + 3, '{}'::jsonb, 1, 0, 1, now())$$,
  '42501',
  null,
  'T24 — atendente não cria pedido em nome do cliente'
);

set local request.jwt.claims = '{"sub":"60000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.pedidos),
  3,
  'T24 — gerente lê todos os pedidos'
);

-- ── pagamento_eventos é operação: nem cliente nem equipe alcançam ───────────
select throws_ok(
  $$select count(*) from public.pagamento_eventos$$,
  '42501',
  null,
  'trilha do webhook não é exposta a nenhuma sessão de navegador'
);

select * from finish();
rollback;
