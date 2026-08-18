-- ─────────────────────────────────────────────────────────────────────────────
-- 0011_catalogo_seed — O catálogo real da Napo (NAPO-003, bloco C).
--
-- Vai em migration e não em `supabase/seed.sql` porque o catálogo é configuração
-- do produto, não fixture: precisa existir em local, staging e produção. O
-- `seed.sql` roda só em `db reset` e nunca alcança os ambientes remotos.
--
-- IDs cravados, não `gen_random_uuid()`: o mesmo produto tem de ser a mesma linha
-- nos três ambientes (senão comparar dado entre eles vira tradução de uuid), e o
-- teste de reserva do NAPO-004 já referencia a Margherita por id.
--
-- Rotulagem levantada com o PM em 2026-08-17 (RN2/RN4). Nada aqui é inferido de
-- ficha técnica: o que o PM não confirmou não foi publicado.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.categorias (id, nome, slug, eh_massa, ordem)
values
  ('c0000000-0000-0000-0000-000000000001', 'Salgadas', 'salgadas', false, 1),
  ('c0000000-0000-0000-0000-000000000002', 'Doces',    'doces',    false, 2),
  -- `eh_massa` só aqui: o sub-teto de massa do NAPO-004 vale para a categoria.
  ('c0000000-0000-0000-0000-000000000003', 'Massas',   'massas',   true,  3);

insert into public.faixas_preco (id, nome, preco_centavos, ordem)
values
  ('fa000000-0000-0000-0000-000000000001', 'Tradicional', 3990, 1),
  ('fa000000-0000-0000-0000-000000000002', 'Especial',    4590, 2),
  ('fa000000-0000-0000-0000-000000000003', 'Premium',     4990, 3),
  ('fa000000-0000-0000-0000-000000000004', 'Massa',       1500, 4);

-- ── Os 12 produtos ──────────────────────────────────────────────────────────
--
-- Rotulagem comum a toda pizza: 550 g, validade de 90 dias, 30 cm, 2 porções.
-- Massas: 300 g, 120 dias, sem diâmetro nem porção (o disco é insumo de quem
-- compra, não porção servida).
--
-- `alergenos_pode_conter` é declaração de cozinha compartilhada (RN4), editorial
-- da casa: a avelã é manipulada na bancada dos doces, então o precaucional vale
-- para a categoria doce inteira e não alcança as salgadas. Se a separação de
-- bancada deixar de existir, esta decisão muda antes da publicação (NAPO-021).
--
-- `ranking_mais_pedidas` é o que a operação mede hoje, à mão. Derivar do volume
-- real de vendas depende de pedidos (NAPO-006) e está registrado no ROADMAP.
insert into public.produtos (
  id, categoria_id, faixa_preco_id, nome, slug, denominacao_venda, descricao,
  peso_liquido_g, validade_dias, conservacao, preparo, diametro_cm, porcoes,
  preco_override_centavos, alergenos_contem, alergenos_pode_conter,
  ranking_mais_pedidas, ordem, ativo
)
values
  -- ── Salgadas ──────────────────────────────────────────────────────────────
  ('dddddddd-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001',
   'Margherita', 'margherita', 'Pizza congelada pré-assada de muçarela e tomate',
   'Muçarela, tomate e manjericão sobre a massa de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 1, true),

  ('dddddddd-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001',
   'Calabresa', 'calabresa', 'Pizza congelada pré-assada de calabresa',
   'Calabresa fatiada e cebola sobre a massa de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', 1, 2, true),

  ('dddddddd-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002',
   'Pepperoni', 'pepperoni', 'Pizza congelada pré-assada de pepperoni',
   'Pepperoni e muçarela sobre a massa de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 3, true),

  ('dddddddd-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002',
   'Frango c/ Catupiry', 'frango-com-catupiry', 'Pizza congelada pré-assada de frango com catupiry',
   'Frango desfiado e catupiry sobre a massa de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', 3, 4, true),

  ('dddddddd-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000002',
   'Quatro Queijos', 'quatro-queijos', 'Pizza congelada pré-assada de quatro queijos',
   'Muçarela, provolone, parmesão e gorgonzola sobre a massa de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 5, true),

  ('dddddddd-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000003',
   'Peito de Peru com Gorgonzola', 'peito-de-peru-com-gorgonzola', 'Pizza congelada pré-assada de peito de peru com gorgonzola',
   'Peito de peru e gorgonzola sobre a massa de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', 2, 6, true),

  ('dddddddd-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000003',
   'Lombo Canadense', 'lombo-canadense', 'Pizza congelada pré-assada de lombo canadense',
   'Lombo canadense e muçarela sobre a massa de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{}', null, 7, true),

  -- ── Doces ─────────────────────────────────────────────────────────────────
  -- A avelã aparece em `contem` na Nutella (é receita) e em `pode_conter` nas
  -- outras duas (é a bancada). Repetir avelã nos dois campos da Nutella diria
  -- duas vezes a mesma coisa e enfraqueceria o precaucional onde ele informa.
  ('dddddddd-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000003',
   'Nutella com Avelã', 'nutella-com-avela', 'Pizza doce congelada pré-assada, sabor avelã com creme de cacau',
   'Creme de avelã com cacau e avelã tostada em pedaços, sobre a massa doce de longa fermentação.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{avela,gluten,leite,soja}', '{amendoim,castanhas}', null, 1, true),

  ('dddddddd-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000001',
   'Banana', 'banana', 'Pizza doce congelada pré-assada de banana com canela',
   'Banana, canela e açúcar sobre a massa doce de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite}', '{avela,amendoim,castanhas}', null, 2, true),

  ('dddddddd-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000002',
   'Chocolate', 'chocolate', 'Pizza doce congelada pré-assada de chocolate',
   'Creme de chocolate ao leite sobre a massa doce de longa fermentação, assada na pedra.',
   550, 90, '−18 °C · não recongelar', 'Forno pré-aquecido a 220 °C, direto na grade por 8 a 10 minutos.', 30, 2,
   null, '{gluten,leite,soja}', '{avela,amendoim,castanhas}', null, 3, true),

  -- ── Massas ────────────────────────────────────────────────────────────────
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
