-- ─────────────────────────────────────────────────────────────────────────────
-- 0016_cobrancas — T5–T9, T16, T33 e as garantias de banco de T19 e T28
-- (RN1, RN2, RN7, RN10, RN16).
--
-- A derivação vem primeiro porque é a resposta para "esse pedido foi pago?".
-- Errar aqui não quebra o checkout: faz a casa acreditar em dinheiro que não
-- entrou, ou cobrar de novo quem já pagou.
--
-- Nenhuma asserção menciona `pedidos.status`: o eixo de entrega é reescrito na
-- 0017 e este arquivo não pode depender do vocabulário de nenhum dos dois lados.
-- ─────────────────────────────────────────────────────────────────────────────
begin;
select plan(16);

-- ── Fixtures ────────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'h-cliente@napo.test', crypt('x', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'h-operador@napo.test', crypt('x', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, nome, email, role)
values
  ('90000000-0000-0000-0000-000000000001', 'H Cliente',  'h-cliente@napo.test',  'cliente'),
  ('90000000-0000-0000-0000-00000000000a', 'H Operador', 'h-operador@napo.test', 'atendente');

-- Seis pedidos de R$ 100,00, um por estado da derivação.
insert into public.pedidos
  (id, profile_id, dia_entrega, endereco_snapshot, subtotal_centavos, frete_centavos, total_centavos, expira_em)
select
  ('90ed0000-0000-0000-0000-00000000000' || n)::uuid,
  '90000000-0000-0000-0000-000000000001',
  '2030-10-04', '{}'::jsonb, 9000, 1000, 10000, now() + interval '30 min'
from generate_series(1, 6) as n;

-- ═════════════════════════════════════════════════════════════════════════════
-- Derivação (RN2) — a situação de pagamento sai das cobranças, nunca de um campo
-- ═════════════════════════════════════════════════════════════════════════════

-- Pedido 1 — nenhuma cobrança.
select is(
  public.situacao_pagamento('90ed0000-0000-0000-0000-000000000001')::text,
  'sem_pagamento',
  'T5 — pedido sem cobrança nenhuma não está aguardando nada'
);

-- Pedido 2 — uma cobrança pendente dentro do prazo.
insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, expira_em)
values ('90ed0000-0000-0000-0000-000000000002', 'online', 10000, 'pendente', now() + interval '30 min');

select is(
  public.situacao_pagamento('90ed0000-0000-0000-0000-000000000002')::text,
  'aguardando',
  'T5 — cobrança pendente dentro do prazo é aguardando'
);

-- Pedido 3 — pendente vencida: o dinheiro não vem mais, mesmo antes da varredura.
insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, expira_em)
values ('90ed0000-0000-0000-0000-000000000003', 'online', 10000, 'pendente', now() - interval '1 min');

select is(
  public.situacao_pagamento('90ed0000-0000-0000-0000-000000000003')::text,
  'sem_pagamento',
  'T5 — pendente vencida deixa de contar como aguardando antes mesmo da varredura'
);

-- Pedido 4 — aprovada que cobre o total.
insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, mp_payment_id, aprovada_em, forma)
values ('90ed0000-0000-0000-0000-000000000004', 'online', 10000, 'aprovada', 'mp-h-004', now(), 'pix');

select is(
  public.situacao_pagamento('90ed0000-0000-0000-0000-000000000004')::text,
  'pago',
  'T6 — aprovada que cobre o total deixa o pedido pago'
);

-- Pedido 5 — sinal: metade aprovada. Sai de graça do modelo de 0..n cobranças.
insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, mp_payment_id, aprovada_em, forma)
values ('90ed0000-0000-0000-0000-000000000005', 'link', 5000, 'aprovada', 'mp-h-005', now(), 'pix');

select is(
  public.situacao_pagamento('90ed0000-0000-0000-0000-000000000005')::text,
  'parcial',
  'T7 — aprovada que não cobre o total é pagamento parcial, não pago'
);

-- Pedido 6 — três recusas seguidas não somam dinheiro nenhum.
insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao)
values
  ('90ed0000-0000-0000-0000-000000000006', 'online', 10000, 'recusada'),
  ('90ed0000-0000-0000-0000-000000000006', 'online', 10000, 'recusada'),
  ('90ed0000-0000-0000-0000-000000000006', 'online', 10000, 'recusada');

select is(
  public.situacao_pagamento('90ed0000-0000-0000-0000-000000000006')::text,
  'sem_pagamento',
  'T9 — tentativa recusada não é dinheiro: três delas continuam somando zero'
);

-- Estorno vence tudo: o pedido 4 estava pago e passa a estornado.
update public.cobrancas set situacao = 'estornada'
where pedido_id = '90ed0000-0000-0000-0000-000000000004';

select is(
  public.situacao_pagamento('90ed0000-0000-0000-0000-000000000004')::text,
  'estornado',
  'T8 — estorno vence a soma: o pedido deixa de estar pago'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- Restrições — o que o banco recusa (RN7, RN10, RN16)
-- ═════════════════════════════════════════════════════════════════════════════

select throws_ok(
  $$insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, aprovada_em)
    values ('90ed0000-0000-0000-0000-000000000001', 'dinheiro', 10000, 'aprovada', now())$$,
  '23514',
  null,
  'T16/RN7 — dinheiro aprovado sem operador identificado é recusado pelo banco'
);

select lives_ok(
  $$insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, aprovada_em, operador_id)
    values ('90ed0000-0000-0000-0000-000000000001', 'dinheiro', 10000, 'aprovada', now(),
            '90000000-0000-0000-0000-00000000000a')$$,
  'T16/RN7 — com operador gravado, a declaração de dinheiro é aceita'
);

select throws_ok(
  $$insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, aprovada_em)
    values ('90ed0000-0000-0000-0000-000000000002', 'online', 10000, 'aprovada', now())$$,
  '23514',
  null,
  'RN1 — cobrança de gateway aprovada sem rastro do pagamento é recusada'
);

-- Duplo clique (RN10): o índice parcial é quem garante, não o serviço.
select throws_ok(
  $$insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, expira_em)
    values ('90ed0000-0000-0000-0000-000000000002', 'online', 10000, 'pendente', now() + interval '30 min')$$,
  '23505',
  null,
  'T19/RN10 — segunda cobrança pendente no mesmo pedido viola a restrição'
);

update public.cobrancas set situacao = 'recusada'
where pedido_id = '90ed0000-0000-0000-0000-000000000002' and situacao = 'pendente';

select lives_ok(
  $$insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, expira_em)
    values ('90ed0000-0000-0000-0000-000000000002', 'online', 10000, 'pendente', now() + interval '30 min')$$,
  'T19/RN12 — recusada a primeira, a nova tentativa cabe no mesmo pedido'
);

select throws_ok(
  $$insert into public.cobrancas (pedido_id, instrumento, valor_centavos, situacao, mp_payment_id, aprovada_em, forma)
    values ('90ed0000-0000-0000-0000-000000000003', 'online', 10000, 'aprovada', 'mp-h-005', now(), 'pix')$$,
  '23505',
  null,
  'T28/RN16 — o mesmo pagamento do gateway não confirma duas cobranças'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- T33 — cobrança é operação, não conteúdo de cliente (RN1)
-- ═════════════════════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$select 1 from public.cobrancas$$,
  '42501',
  null,
  'T33 — nem o dono do pedido alcança a tabela de cobranças pelo navegador'
);

-- A view junta pedido e dinheiro: exposta pelo PostgREST, seria o mesmo furo
-- por outra porta. O privilégio revogado erra alto antes de a RLS ser discutida.
select throws_ok(
  $$select 1 from public.pedidos_com_pagamento$$,
  '42501',
  null,
  'T33 — a view derivada também não é alcançável por sessão de navegador'
);

reset role;

select is(
  (select situacao_pagamento::text from public.pedidos_com_pagamento
   where id = '90ed0000-0000-0000-0000-000000000005'),
  'parcial',
  'RN2 — a view é o que a aplicação lê, e ela traz a situação derivada'
);

select * from finish();
rollback;
