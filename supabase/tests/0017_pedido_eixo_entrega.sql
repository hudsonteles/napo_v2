-- ─────────────────────────────────────────────────────────────────────────────
-- 0017_pedido_eixo_entrega — T3, T11, T12, T13 (RN3, RN4).
--
-- ⚠️ `vagas_ocupadas` é lida pelo motor do NAPO-004, que alimenta a vitrine.
-- Errar aqui não quebra o checkout: faz o site vender vaga que não existe, ou
-- esconder vaga que existe. É por isso que este arquivo passa antes de qualquer
-- código de aplicação tocar o novo modelo.
--
-- A armadilha do bloco é a contagem dupla. Antes, `aguardando_pagamento` ficava
-- de fora da soma porque a reserva que o sustentava já contava por ele. Agora
-- que pagamento saiu do eixo de status, o desempate deixa de ser o estado do
-- pedido e passa a ser o vínculo: reserva amarrada a pedido não conta sozinha.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(11);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'i-cliente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values ('a0000000-0000-0000-0000-000000000001', 'I Cliente', 'i-cliente@napo.test', 'cliente');

\set produto '''dddddddd-0000-0000-0000-000000000002'''
\set dia     '''2031-03-07'''

-- ═════════════════════════════════════════════════════════════════════════════
-- T3 — o eixo do dinheiro saiu do pedido (RN3)
-- ═════════════════════════════════════════════════════════════════════════════
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'pedidos'
     and column_name in ('mp_payment_id', 'mp_preference_id', 'forma_pagamento', 'pago_em')),
  0,
  'T3 — nenhum dado de pagamento sobrou como coluna do pedido'
);

select is(
  (select count(*)::int from pg_enum e
   join pg_type t on t.oid = e.enumtypid
   where t.typname = 'status_pedido'
     and e.enumlabel in ('aguardando_pagamento', 'pago', 'estornado')),
  0,
  'T3 — o ciclo de entrega não fala mais de dinheiro'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- T12/T13 — capacidade não sabe de pagamento (RN4)
-- ═════════════════════════════════════════════════════════════════════════════

-- Pedido 1: `novo`, sem cobrança nenhuma. É o pedido de balcão a ser pago na
-- entrega que o NAPO-026 precisa — hoje ele não teria como ocupar vaga.
insert into public.pedidos
  (id, profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values ('a0ed0000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        :dia, '{}'::jsonb, 9000, 1000, 10000, now() + interval '30 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values ('a0ed0000-0000-0000-0000-000000000001', :produto, 'Calabresa', 2, 3990);

select is(public.vagas_ocupadas(:dia, :produto), 2,
  'T12/RN4 — pedido sem cobrança nenhuma ocupa vaga: capacidade não pergunta por dinheiro');

-- A reserva que sustenta esse pedido, já amarrada a ele. Se o vínculo não
-- desempatasse, a mesma vaga seria cobrada duas vezes do estoque.
insert into public.reservas (profile_id, dia_entrega, produto_id, quantidade, expira_em, status, pedido_id)
values ('a0000000-0000-0000-0000-000000000001', :dia, :produto, 2, now() + interval '30 min', 'ativa',
        'a0ed0000-0000-0000-0000-000000000001');

select is(public.vagas_ocupadas(:dia, :produto), 2,
  'T12/RN4 — reserva amarrada ao pedido não conta de novo: a vaga é uma só');

-- Carrinho de outra pessoa, ainda sem pedido: continua contando sozinho.
insert into public.reservas (profile_id, dia_entrega, produto_id, quantidade, expira_em, status)
values ('a0000000-0000-0000-0000-000000000001', :dia, :produto, 3, now() + interval '15 min', 'ativa');

select is(public.vagas_ocupadas(:dia, :produto), 5,
  'T12/RN4 — reserva sem pedido ainda é carrinho no ar e ocupa vaga');

-- Pedido 2: cancelado devolve.
insert into public.pedidos
  (id, profile_id, status, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values ('a0ed0000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'cancelado',
        :dia, '{}'::jsonb, 9000, 1000, 10000, now() + interval '30 min');

insert into public.pedido_itens (pedido_id, produto_id, nome_snapshot, quantidade, preco_unitario_snapshot)
values ('a0ed0000-0000-0000-0000-000000000002', :produto, 'Calabresa', 4, 3990);

select is(public.vagas_ocupadas(:dia, :produto), 5,
  'T13/RN4 — pedido cancelado devolve a vaga');

update public.pedidos set status = 'expirado' where id = 'a0ed0000-0000-0000-0000-000000000002';

select is(public.vagas_ocupadas(:dia, :produto), 5,
  'T13/RN4 — pedido expirado devolve a vaga');

-- ═════════════════════════════════════════════════════════════════════════════
-- T11 — os dois eixos não se confundem (RN3)
-- ═════════════════════════════════════════════════════════════════════════════
insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, mp_payment_id, aprovada_em, forma)
values ('a0ed0000-0000-0000-0000-000000000001', 'online', 10000, 'aprovada', 'mp-i-001', now(), 'pix');

update public.pedidos set status = 'em_producao' where id = 'a0ed0000-0000-0000-0000-000000000001';

select is(
  public.situacao_pagamento('a0ed0000-0000-0000-0000-000000000001')::text,
  'pago',
  'T11 — mover o pedido pela cozinha não toca na situação de pagamento'
);

update public.pedidos set status = 'entregue' where id = 'a0ed0000-0000-0000-0000-000000000001';

select is(
  public.situacao_pagamento('a0ed0000-0000-0000-0000-000000000001')::text,
  'pago',
  'T11 — entregue continua pago sem nenhuma escrita adicional'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- A varredura respeita o dinheiro que entrou (RN4, RN13 do NAPO-006)
-- ═════════════════════════════════════════════════════════════════════════════

-- Pedido 3: vencido e pago. Não pode ser varrido.
insert into public.pedidos
  (id, profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values ('a0ed0000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
        :dia, '{}'::jsonb, 9000, 1000, 10000, now() - interval '5 min');

insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, mp_payment_id, aprovada_em, forma)
values ('a0ed0000-0000-0000-0000-000000000003', 'online', 10000, 'aprovada', 'mp-i-003', now(), 'credit_card');

-- Pedido 4: vencido e sem dinheiro. É o carrinho abandonado.
insert into public.pedidos
  (id, profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
values ('a0ed0000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001',
        :dia, '{}'::jsonb, 9000, 1000, 10000, now() - interval '5 min');

insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, expira_em)
values ('a0ed0000-0000-0000-0000-000000000004', 'online', 10000, 'pendente', now() - interval '5 min');

do $$ begin perform public.expirar_pedidos(); end $$;

select is(
  (select status::text from public.pedidos where id = 'a0ed0000-0000-0000-0000-000000000003'),
  'novo',
  'RN18 — pedido vencido que já foi pago não é varrido: dinheiro que entrou não é recusado'
);

select is(
  (select situacao::text from public.cobrancas
   where pedido_id = 'a0ed0000-0000-0000-0000-000000000004'),
  'expirada',
  'RN11 — expirar o pedido expira junto a cobrança que estava de pé'
);

select * from finish();
rollback;
