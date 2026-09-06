-- ─────────────────────────────────────────────────────────────────────────────
-- 0014_pedidos_funcoes — T33, T34, T35, T9, T10, T11, T15 (RN7, RN9, RN12, RN13, RN14).
--
-- ⚠️ T33 e T34 vêm PRIMEIRO de propósito. `vagas_ocupadas` é lida pelo motor de
-- disponibilidade do NAPO-004, que alimenta a vitrine: errar aqui não quebra o
-- checkout, quebra o site (design.md §8). O resto do bloco só faz sentido se
-- estas duas passam.
--
-- Nota de honestidade herdada do 0004: pgTAP roda em sessão única, então a
-- corrida real entre transações não é provada aqui. O que se prova é a
-- contagem, a recusa e a declaração do advisory lock.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(26);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'f-cliente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values ('70000000-0000-0000-0000-000000000001', 'F Cliente', 'f-cliente@napo.test', 'cliente');

-- Produto real do catálogo (0011) — pedido_itens tem FK para produtos.
\set produto '''dddddddd-0000-0000-0000-000000000002'''
\set outro   '''dddddddd-0000-0000-0000-000000000001'''
\set dia     '''2030-09-06'''

-- ═════════════════════════════════════════════════════════════════════════════
-- T33 — vagas_ocupadas conta reserva viva E pedido ativo (RN12)
-- ═════════════════════════════════════════════════════════════════════════════
insert into public.reservas (profile_id, dia_entrega, produto_id, quantidade, expira_em, status)
values ('70000000-0000-0000-0000-000000000001', :dia, :produto, 2, now() + interval '20 min', 'ativa');

select is(public.vagas_ocupadas(:dia, :produto), 2,
  'T33 — reserva viva sozinha conta (comportamento que já existia no NAPO-004)');

insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  ('70ed0000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'novo',
   :dia, '{}'::jsonb, 11970, 600, 12570, now() + interval '30 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values ('70ed0000-0000-0000-0000-000000000001', :produto, 'Calabresa', 3, 3990);

select is(public.vagas_ocupadas(:dia, :produto), 5,
  'T33 — carrinho no ar (2) + pedido vivo (3) = 5 vagas ocupadas');

select is(public.vagas_ocupadas(:dia, :outro), 0,
  'T33 — a contagem é por produto: outro sabor não é afetado');

select is(public.vagas_ocupadas('2030-09-13', :produto), 0,
  'T33 — a contagem é por dia: outra fornada não é afetada');

-- ═════════════════════════════════════════════════════════════════════════════
-- T34 — vagas_ocupadas ignora o que não ocupa (RN12, RN13)
-- ═════════════════════════════════════════════════════════════════════════════
insert into public.reservas (profile_id, dia_entrega, produto_id, quantidade, expira_em, status)
values ('70000000-0000-0000-0000-000000000001', '2030-09-20', :produto, 4, now() - interval '1 min', 'ativa');

select is(public.vagas_ocupadas('2030-09-20', :produto), 0,
  'T34 — reserva vencida não ocupa (invisível sem job de limpeza)');

insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  ('70ed0000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'expirado',
   '2030-09-20', '{}'::jsonb, 3990, 600, 4590, now() - interval '1 min'),
  ('70ed0000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', 'cancelado',
   '2030-09-20', '{}'::jsonb, 3990, 600, 4590, now() - interval '1 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values
  ('70ed0000-0000-0000-0000-000000000002', :produto, 'Calabresa', 5, 3990),
  ('70ed0000-0000-0000-0000-000000000003', :produto, 'Calabresa', 7, 3990);

select is(public.vagas_ocupadas('2030-09-20', :produto), 0,
  'T34 — pedido expirado e cancelado não ocupam vaga');

-- INVERTIDO no NAPO-025 (RN4): pedido recém-criado passa a ocupar vaga. O
-- desempate contra a reserva que o sustenta deixou de ser o status e virou o
-- vínculo `reservas.pedido_id` — provado em 0017_pedido_eixo_entrega.sql.
insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  ('70ed0000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001', 'novo',
   '2030-09-20', '{}'::jsonb, 3990, 600, 4590, now() + interval '30 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values ('70ed0000-0000-0000-0000-000000000004', :produto, 'Calabresa', 9, 3990);

select is(public.vagas_ocupadas('2030-09-20', :produto), 9,
  'T34/RN4 — pedido novo sem cobrança nenhuma ocupa vaga: capacidade não pergunta por dinheiro');

-- Estados que ocupam de verdade (a pizza existe ou vai existir).
update public.pedidos set status = 'em_producao' where id = '70ed0000-0000-0000-0000-000000000004';
select is(public.vagas_ocupadas('2030-09-20', :produto), 9,
  'T34 — em_producao ocupa vaga');

update public.pedidos set status = 'entregue' where id = '70ed0000-0000-0000-0000-000000000004';
select is(public.vagas_ocupadas('2030-09-20', :produto), 9,
  'T34 — entregue ocupa: a pizza saiu daquela fornada');

update public.pedidos set status = 'cancelado' where id = '70ed0000-0000-0000-0000-000000000004';
select is(public.vagas_ocupadas('2030-09-20', :produto), 0,
  'T34/RN4 — encerrado devolve a vaga; estorno agora chega aqui como cancelamento');

-- ═════════════════════════════════════════════════════════════════════════════
-- reservar_carrinho — tudo ou nada, sob um lock só (RN7)
-- ═════════════════════════════════════════════════════════════════════════════
select ok(
  (select array_to_string(proconfig, ',') like 'search_path=%'
   from pg_proc where proname = 'reservar_carrinho' and pronamespace = 'public'::regnamespace),
  'reservar_carrinho tem search_path fixo'
);

select ok(
  (select prosrc like '%pg_advisory_xact_lock%'
   from pg_proc where proname = 'reservar_carrinho' and pronamespace = 'public'::regnamespace),
  'reservar_carrinho declara o advisory lock que serializa o dia'
);

-- Dia limpo, teto de 10 por produto.
select is(
  jsonb_array_length(public.reservar_carrinho(
    '2030-09-27',
    '[{"produto_id":"dddddddd-0000-0000-0000-000000000002","quantidade":2},
      {"produto_id":"dddddddd-0000-0000-0000-000000000001","quantidade":1}]'::jsonb,
    '70000000-0000-0000-0000-000000000001',
    '[{"produto_id":"dddddddd-0000-0000-0000-000000000002","limite":10},
      {"produto_id":"dddddddd-0000-0000-0000-000000000001","limite":10}]'::jsonb,
    30
  )),
  2,
  'reservar_carrinho cria uma reserva por item e devolve as duas'
);

select is(public.vagas_ocupadas('2030-09-27', :produto), 2,
  'reservar_carrinho ocupa a vaga do primeiro item');

-- T36 — se um item não cabe, NADA é reservado.
select throws_ok(
  $$select public.reservar_carrinho(
      '2030-09-27',
      '[{"produto_id":"dddddddd-0000-0000-0000-000000000002","quantidade":1},
        {"produto_id":"dddddddd-0000-0000-0000-000000000001","quantidade":99}]'::jsonb,
      '70000000-0000-0000-0000-000000000001',
      '[{"produto_id":"dddddddd-0000-0000-0000-000000000002","limite":10},
        {"produto_id":"dddddddd-0000-0000-0000-000000000001","limite":10}]'::jsonb,
      30)$$,
  'P0001',
  null,
  'T36 — item que não cabe derruba o carrinho inteiro'
);

select is(public.vagas_ocupadas('2030-09-27', :produto), 2,
  'T36 — a recusa não deixou reserva parcial do item que cabia'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- confirmar_pagamento — atômico e idempotente (RN9, RN12)
-- ═════════════════════════════════════════════════════════════════════════════
insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values
  ('70ed0000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000001', 'novo',
   '2026-10-02', '{}'::jsonb, 7980, 600, 8580, now() + interval '30 min');

-- A reserva nasce amarrada ao pedido (NAPO-025): é o vínculo que impede a
-- contagem dupla, e não mais o fato de o pedido estar fora da soma.
insert into public.reservas (id, profile_id, dia_entrega, produto_id, quantidade, expira_em, status, pedido_id)
values ('7e5e0000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001',
        '2026-10-02', :produto, 2, now() + interval '30 min', 'ativa',
        '70ed0000-0000-0000-0000-000000000005');

update public.pedidos set reserva_id = '7e5e0000-0000-0000-0000-000000000001'
  where id = '70ed0000-0000-0000-0000-000000000005';

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values ('70ed0000-0000-0000-0000-000000000005', :produto, 'Calabresa', 2, 3990);

insert into public.cobrancas (id, pedido_id, instrumento, valor_centavos, situacao, expira_em)
values ('7c0b0000-0000-0000-0000-000000000001', '70ed0000-0000-0000-0000-000000000005',
        'online', 8580, 'pendente', now() + interval '30 min');

select is(
  public.confirmar_pagamento('7c0b0000-0000-0000-0000-000000000001', 'mp-conf-1', 'pix', 'viavel'),
  true,
  'confirmar_pagamento aprova a cobrança e devolve true'
);

select is(
  public.situacao_pagamento('70ed0000-0000-0000-0000-000000000005')::text,
  'pago',
  'T9/RN2 — o pedido passa a estar pago pela derivação, sem ninguém escrever nele'
);

select is(
  (select status::text from public.reservas where id = '7e5e0000-0000-0000-0000-000000000001'),
  'consumida',
  'T9/RN12 — a reserva vira consumida e quem ocupa a vaga passa a ser o pedido'
);

select is(public.vagas_ocupadas('2026-10-02', :produto), 2,
  'T9/RN12 — a vaga continua ocupada depois de a reserva ser consumida');

select is(
  public.confirmar_pagamento('7c0b0000-0000-0000-0000-000000000001', 'mp-conf-1', 'pix', 'viavel'),
  false,
  'T7/RN16 — confirmar de novo devolve false sem reprocessar'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- cancelar_pedido e expirar_pedidos (RN13, RN14)
-- ═════════════════════════════════════════════════════════════════════════════
select is(
  public.cancelar_pedido('70ed0000-0000-0000-0000-000000000005', 'capacidade'),
  true,
  'T10 — cancelar devolve true'
);

select is(public.vagas_ocupadas('2026-10-02', :produto), 0,
  'T10/RN14 — cancelamento antes do cutoff devolve a vaga ao dia');

-- T15 — pedido vencido expira e libera a reserva.
insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em, reserva_id)
select '70ed0000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000001', 'novo',
       '2026-10-09', '{}'::jsonb, 3990, 600, 4590, now() - interval '1 min', r.id
from public.reservas r
where r.dia_entrega = '2030-09-27' and r.produto_id = :produto
limit 1;

-- O vínculo que a varredura usa para devolver a vaga é `reservas.pedido_id`,
-- não `pedidos.reserva_id` — este último guarda só a primeira reserva de um
-- carrinho de vários produtos e por isso não serve de chave (NAPO-025).
update public.reservas set pedido_id = '70ed0000-0000-0000-0000-000000000006'
where id = (select reserva_id from public.pedidos
            where id = '70ed0000-0000-0000-0000-000000000006');

-- A varredura é global, mas a asserção não pode ser: banco de desenvolvimento
-- acumula pedido vencido de uso real, e afirmar "expirou exatamente 1" só passa
-- em banco recém-resetado (falhou com 3 em 2026-09-05). Contar os vencidos no
-- mesmo instante preserva o que a asserção provava — que pedido dentro do prazo
-- não é varrido junto — sem depender do estado da máquina.
create temporary table t15_vencidos on commit drop as
select count(*)::int as total
from public.pedidos p
where p.status = 'novo'
  and p.expira_em <= now()
  and public.situacao_pagamento(p.id) = 'sem_pagamento';

select is(public.expirar_pedidos(), (select total from t15_vencidos),
  'T15 — a varredura expira os pedidos vencidos, e nenhum dentro do prazo');

select is(
  (select status::text from public.pedidos where id = '70ed0000-0000-0000-0000-000000000006'),
  'expirado',
  'T15/RN13 — o pedido vencido fica expirado'
);

select is(public.vagas_ocupadas('2030-09-27', :produto), 0,
  'T15/RN13 — expirar libera a reserva e a vaga volta para a fila');

select * from finish();
rollback;
