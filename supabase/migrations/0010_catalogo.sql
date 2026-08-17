-- ─────────────────────────────────────────────────────────────────────────────
-- 0010_catalogo — O catálogo público (NAPO-003).
--
-- Primeira superfície do banco exposta a ANÔNIMO. Três tabelas de configuração
-- de produto (categorias, faixas de preço, produtos) + o enum de alérgeno.
-- Segue o padrão do projeto: RLS deny-by-default, leitura liberada só para o que
-- é público, escrita só para admin. Fecha as FKs que o NAPO-004 deixou pendentes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Alérgenos: enum, não texto livre ────────────────────────────────────────
-- Grafia divergente ("avelã" × "avela") é alérgeno invisível para filtro e para
-- a etiqueta futura (NAPO-011). Lista dos grupos obrigatórios (RDC 26/2015)
-- relevantes ao catálogo. `avela` fica separado de `castanhas` de propósito: a
-- Napo destaca avelã como caso crítico (RN3) e o rótulo precisa nomeá-la.
-- Valor novo aqui é ALTER TYPE — barato enquanto não há produção.
create type public.alergeno as enum (
  'gluten',
  'leite',
  'ovos',
  'soja',
  'amendoim',
  'castanhas',
  'avela',
  'peixe',
  'crustaceos'
);

-- ── Categorias ──────────────────────────────────────────────────────────────
-- `eh_massa` mora aqui, não no produto: o sub-teto de massa (NAPO-004) vale para
-- a categoria inteira. No produto, convidaria divergência entre dois itens da
-- mesma categoria.
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  eh_massa boolean not null default false,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_categorias_updated_at
  before update on public.categorias
  for each row execute function public.set_updated_at();

-- ── Faixas de preço ─────────────────────────────────────────────────────────
-- A operação pensa e reajusta por faixa (39,90 / 45,90 / 49,90 / 15,00). Preço
-- solto por produto transformaria "reajustar a faixa Especial" em N updates com
-- chance de divergir. Centavos em `int`: float erra centavo em soma e o preço
-- será somado a frete/imposto/taxa no NAPO-006/008.
create table public.faixas_preco (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_centavos int not null check (preco_centavos >= 0),
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_faixas_preco_updated_at
  before update on public.faixas_preco
  for each row execute function public.set_updated_at();

-- ── Produtos ────────────────────────────────────────────────────────────────
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias (id),
  faixa_preco_id uuid not null references public.faixas_preco (id),

  -- Nome comercial (muda) × slug (permanente, RN8). Trocar URL indexada custa
  -- mapa de 301 e descarta autoridade — por isso o slug não segue o nome.
  nome text not null,
  slug text not null unique,

  -- Rotulagem obrigatória (RN2). Denominação de venda é o nome LEGAL do produto
  -- (RDC 727), não o comercial.
  denominacao_venda text,
  descricao text,
  peso_liquido_g int check (peso_liquido_g is null or peso_liquido_g > 0),
  validade_dias int check (validade_dias is null or validade_dias > 0),
  conservacao text,
  preparo text,

  -- Exibidos no preview aprovado, fora da lista obrigatória da RN2.
  diametro_cm int check (diametro_cm is null or diametro_cm > 0),
  porcoes smallint check (porcoes is null or porcoes > 0),

  -- Preço herda a faixa; override vence quando presente (RN5).
  preco_override_centavos int check (preco_override_centavos is null or preco_override_centavos >= 0),

  -- Duas colunas separadas: "contém" afirma composição, "pode conter" afirma
  -- risco de contato em cozinha compartilhada (RN4). Fundir perderia a distinção
  -- exatamente onde ela protege alguém.
  alergenos_contem public.alergeno[] not null default '{}',
  alergenos_pode_conter public.alergeno[] not null default '{}',

  -- Ranking factual das "mais pedidas" (1, 2, 3). A home mostra em ordem, e ordem
  -- não cabe em booleano. Rótulo factual só marca o que a casa realmente mede.
  ranking_mais_pedidas smallint check (ranking_mais_pedidas is null or ranking_mais_pedidas between 1 and 3),

  ordem int not null default 0,

  -- Nasce inativo: produto sem rotulagem não pode vazar (RN1/RN2). Publicar é
  -- ato deliberado que exige rotulagem completa (CHECK abaixo).
  ativo boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- RN2 no BANCO, não na tela: publicar produto sem rotulagem passa a ser
  -- impossível, não improvável — vale para seed, admin (NAPO-008) e qualquer
  -- script futuro, sem ninguém precisar lembrar. array_length de '{}' é NULL,
  -- então a checagem de "contém" exige lista não-vazia.
  constraint produtos_rotulagem_completa check (
    not ativo or (
      denominacao_venda is not null
      and peso_liquido_g is not null
      and validade_dias is not null
      and conservacao is not null
      and preparo is not null
      and array_length(alergenos_contem, 1) is not null
    )
  )
);

create trigger trg_produtos_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

-- A consulta da vitrine é exatamente esta: produtos ativos de uma categoria, em
-- ordem. Índice parcial casado com o WHERE da leitura.
create index produtos_categoria_ordem on public.produtos (categoria_id, ordem) where ativo;

-- Dois produtos não disputam a mesma posição no ranking. Sem o índice único, a
-- ordem da home dependeria de tiebreak acidental do banco.
create unique index produtos_ranking_unico on public.produtos (ranking_mais_pedidas)
  where ranking_mais_pedidas is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS (RN12). Catálogo é público para LEITURA e só para leitura. Categorias e
-- faixas são dado de referência sem coluna de estado — públicas inteiras. Em
-- produtos, anônimo e cliente veem apenas o ativo; admin vê tudo (para o painel
-- do NAPO-008). Escrita é só de admin em qualquer das três.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.categorias enable row level security;
alter table public.faixas_preco enable row level security;
alter table public.produtos enable row level security;

grant select on public.categorias to anon, authenticated;
grant select on public.faixas_preco to anon, authenticated;
grant select on public.produtos to anon, authenticated;

grant insert, update, delete on public.categorias to authenticated;
grant insert, update, delete on public.faixas_preco to authenticated;
grant insert, update, delete on public.produtos to authenticated;

create policy "categorias_leitura_publica" on public.categorias for select using (true);
create policy "categorias_admin_escreve" on public.categorias for all
  using (public.is_admin()) with check (public.is_admin());

create policy "faixas_preco_leitura_publica" on public.faixas_preco for select using (true);
create policy "faixas_preco_admin_escreve" on public.faixas_preco for all
  using (public.is_admin()) with check (public.is_admin());

-- Produto inativo é invisível para quem não é admin (RN1/RN18): não basta sumir
-- da listagem — uma URL viva de produto descontinuado continua indexada e vende
-- o que não existe.
create policy "produtos_leitura_publica" on public.produtos for select
  using (ativo or public.is_admin());
create policy "produtos_admin_escreve" on public.produtos for all
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- FKs que o NAPO-004 deixou pendentes (0004 anotou em comentário). O catálogo
-- existe agora, então `produto_id` deixa de ser uuid solto e passa a referenciar
-- produtos de verdade. Sem ON DELETE: apagar produto com lote/reserva vinculado
-- deve falhar barulhento, não arrastar histórico de estoque junto.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.lotes
  add constraint lotes_produto_id_fkey foreign key (produto_id) references public.produtos (id);
alter table public.producao_planejada
  add constraint producao_planejada_produto_id_fkey foreign key (produto_id) references public.produtos (id);
alter table public.reservas
  add constraint reservas_produto_id_fkey foreign key (produto_id) references public.produtos (id);
