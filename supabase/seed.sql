-- ─────────────────────────────────────────────────────────────────────────────
-- seed — Usuários determinísticos, um por role (+ um segundo cliente).
--
-- Pré-requisito dos testes de RLS: o isolamento entre clientes (T10) e o
-- bloqueio de escalada (T11–T13) só são testáveis com identidades reais e
-- IDs fixos. Rodado por `supabase db reset`. NÃO é dado de produção.
-- ─────────────────────────────────────────────────────────────────────────────

-- Insere em auth.users (a fonte) e deixa o profile explícito logo abaixo — sem
-- trigger de signup automático aqui: o fluxo de auth é NAPO-002.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'cliente1@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'cliente2@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'atendente@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'cozinha@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'gerente@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'admin@napo.test', crypt('napo-seed', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- Perfis correspondentes, um por role.
--
-- NAPO-002: `cliente1` nasce COM telefone validado e `cliente2` SEM — é o par
-- que torna o gate testável à mão sem precisar de dois cadastros novos a cada
-- reset. Equipe fica sem telefone de propósito: ela não passa pelo gate (RN4),
-- e um seed com telefone em todo mundo esconderia uma regressão nisso.
insert into public.profiles (id, nome, email, role, telefone, telefone_validado_em)
values
  ('11111111-1111-1111-1111-111111111111', 'Cliente Um', 'cliente1@napo.test', 'cliente', '+5561991504477', now()),
  ('22222222-2222-2222-2222-222222222222', 'Cliente Dois', 'cliente2@napo.test', 'cliente', null, null),
  ('33333333-3333-3333-3333-333333333333', 'Atendente', 'atendente@napo.test', 'atendente', null, null),
  ('44444444-4444-4444-4444-444444444444', 'Cozinha', 'cozinha@napo.test', 'cozinha', null, null),
  ('55555555-5555-5555-5555-555555555555', 'Gerente', 'gerente@napo.test', 'gerente', null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin', 'admin@napo.test', 'admin', null, null);

-- Consentimentos do cliente já validado, para que o estado do seed seja coerente
-- com o que o fluxo real produz (RN15).
insert into public.consentimentos (profile_id, tipo, versao, ip)
values
  ('11111111-1111-1111-1111-111111111111', 'termos', '0', '127.0.0.1'),
  ('11111111-1111-1111-1111-111111111111', 'privacidade', '0', '127.0.0.1');

-- ─────────────────────────────────────────────────────────────────────────────
-- Operação (NAPO-004). Valores confirmados com o PM em 2026-08-10: entrega
-- apenas na sexta, produção de segunda a sexta. A janela 17h–21h é premissa
-- em aberto (spec §7) — trocá-la é UPDATE, não migration.
--
-- Com um único dia de entrega, o freezer é a restrição dominante: 5 dias de
-- produção acumulam 150, exatamente a capacidade.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.config_operacao default values;

insert into public.dias_semana_entrega (dia_semana, entrega, janela_inicio, janela_fim)
values
  (0, false, '17:00', '21:00'),
  (1, false, '17:00', '21:00'),
  (2, false, '17:00', '21:00'),
  (3, false, '17:00', '21:00'),
  (4, false, '17:00', '21:00'),
  (5, true,  '17:00', '21:00'),
  (6, false, '17:00', '21:00');

insert into public.dias_semana_producao (dia_semana, produz)
values (0, false), (1, true), (2, true), (3, true), (4, true), (5, true), (6, false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo — FIXTURE DE TESTE do NAPO-003 (NÃO é dado de produção).
--
-- Existe por dois motivos: (1) exercitar vitrine, página de produto, SEO e RLS
-- antes do seed real; (2) dar um produto real para as FKs que o 0010 adicionou
-- às tabelas do NAPO-004 — a Margherita usa o id `dddddddd-…-0001` que o teste
-- de reserva (0004) já referencia, então aquele teste segue verde sem mudança.
--
-- O seed de PRODUÇÃO dos 12 produtos (migration 0011) é o bloco C, e depende da
-- rotulagem real levantada pelo PM. A rotulagem abaixo é PLACEHOLDER de teste.
-- Quando 0011 entrar, esta seção sai (senão colide o slug único).
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.categorias (id, nome, slug, eh_massa, ordem)
values
  ('c0000000-0000-0000-0000-000000000001', 'Salgadas', 'salgadas', false, 1),
  ('c0000000-0000-0000-0000-000000000002', 'Doces',    'doces',    false, 2),
  ('c0000000-0000-0000-0000-000000000003', 'Massas',   'massas',   true,  3);

insert into public.faixas_preco (id, nome, preco_centavos, ordem)
values
  ('fa000000-0000-0000-0000-000000000001', 'Tradicional', 3990, 1),
  ('fa000000-0000-0000-0000-000000000002', 'Especial',    4590, 2),
  ('fa000000-0000-0000-0000-000000000003', 'Premium',     4990, 3),
  ('fa000000-0000-0000-0000-000000000004', 'Massa',       1500, 4);

insert into public.produtos (
  id, categoria_id, faixa_preco_id, nome, slug, denominacao_venda, descricao,
  peso_liquido_g, validade_dias, conservacao, preparo, diametro_cm, porcoes,
  preco_override_centavos, alergenos_contem, alergenos_pode_conter,
  ranking_mais_pedidas, ordem, ativo
)
values
  -- Salgadas
  ('dddddddd-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001',
   'Margherita', 'margherita', 'Pizza congelada pré-assada de muçarela e tomate',
   'Muçarela, tomate e manjericão sobre a massa de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', 1, 1, true),
  ('dddddddd-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001',
   'Calabresa', 'calabresa', 'Pizza congelada pré-assada de calabresa',
   'Calabresa fatiada e cebola sobre a massa de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', 2, 2, true),
  ('dddddddd-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002',
   'Pepperoni', 'pepperoni', 'Pizza congelada pré-assada de pepperoni',
   'Pepperoni e muçarela sobre a massa de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', 3, 3, true),
  ('dddddddd-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002',
   'Frango c/ Catupiry', 'frango-com-catupiry', 'Pizza congelada pré-assada de frango com catupiry',
   'Frango desfiado e catupiry sobre a massa de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 4, true),
  ('dddddddd-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002',
   'Quatro Queijos', 'quatro-queijos', 'Pizza congelada pré-assada de quatro queijos',
   'Muçarela, provolone, parmesão e gorgonzola sobre a massa de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 5, true),
  ('dddddddd-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000003',
   'Peito de Peru com Gorgonzola', 'peito-de-peru-com-gorgonzola', 'Pizza congelada pré-assada de peito de peru com gorgonzola',
   'Peito de peru e gorgonzola sobre a massa de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 6, true),
  ('dddddddd-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000003',
   'Lombo Canadense', 'lombo-canadense', 'Pizza congelada pré-assada de lombo canadense',
   'Lombo canadense e muçarela sobre a massa de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 7, true),
  -- Doces
  ('dddddddd-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003',
   'Nutella com Avelã', 'nutella-com-avela', 'Pizza doce congelada pré-assada, sabor avelã com creme de cacau',
   'Creme de avelã com cacau e avelã tostada em pedaços, sobre a massa doce de longa fermentação.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{avela,gluten,leite,soja}', '{amendoim,castanhas}', null, 1, true),
  ('dddddddd-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000001',
   'Banana', 'banana', 'Pizza doce congelada pré-assada de banana com canela',
   'Banana, canela e açúcar sobre a massa doce de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   4200, '{gluten,leite}', '{}', null, 2, true),
  ('dddddddd-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000002',
   'Chocolate', 'chocolate', 'Pizza doce congelada pré-assada de chocolate',
   'Creme de chocolate ao leite sobre a massa doce de longa fermentação, assada na pedra.',
   450, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite,soja}', '{amendoim,castanhas}', null, 3, true),
  -- Massas
  ('dddddddd-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000004',
   'Massa Salgada', 'massa-salgada', 'Massa de pizza salgada congelada',
   'Disco de massa de longa fermentação, pré-assado, pronto para receber o recheio.',
   300, 120, '−18 °C · não recongelar', 'Descongele na geladeira e finalize no forno a 220 °C conforme sua receita.', null, null,
   null, '{gluten}', '{}', null, 1, true),
  ('dddddddd-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000004',
   'Massa Doce', 'massa-doce', 'Massa de pizza doce congelada',
   'Disco de massa doce de longa fermentação, pré-assado, pronto para receber a cobertura.',
   300, 120, '−18 °C · não recongelar', 'Descongele na geladeira e finalize no forno a 220 °C conforme sua receita.', null, null,
   null, '{gluten}', '{}', null, 2, true);
