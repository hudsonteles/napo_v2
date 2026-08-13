# 🏗️ Design: Site público, catálogo e SEO

**ID:** NAPO-003
**Status:** Aprovado
**Data:** 2026-08-12
**Spec de negócio:** [`spec.md`](./spec.md)
**Plano de execução:** [`plan.md`](./plan.md)

> 📌 Este documento define o **COMO** (técnico). Documenta **decisões e o porquê** —
> não repete o que schema, tipos e JSX vão dizer.
> Dono primário: **Tech Lead / agente implementador**.

---

## 1. Mapa de Impacto

| Arquivo / diretório | Ação | Motivo |
|---|---|---|
| `supabase/migrations/0010_catalogo.sql` | Criar | Schema do catálogo, RLS de leitura pública, FKs que o NAPO-004 deixou pendentes |
| `supabase/migrations/0011_catalogo_seed.sql` | Criar | Os 12 produtos como dado versionado (não é dado de teste — precisa existir em prod) |
| `packages/db/src/types.generated.ts` | Modificar | Regenerado por `pnpm db:types` |
| `packages/core/src/catalogo/` | Criar | `preco.ts`, `rotulagem.ts`, `tipos.ts` + testes — regra pura de preço efetivo e completude |
| `packages/core/src/index.ts` | Modificar | Exporta o novo domínio |
| `packages/ui/src/components/badge.tsx` | Criar | Primitivo shadcn ausente; selo de ranking, alérgeno e esgotado |
| `packages/ui/src/components/seletor-quantidade.tsx` | Criar | Controle −/n/+ com teto; usado no card, na página de produto e reaproveitado pelo carrinho (NAPO-006) |
| `packages/ui/src/components/button.tsx` | Modificar | `w-full` é fixo hoje; o site precisa de botão de largura natural |
| `packages/ui/src/patterns/cabecalho-site.tsx` · `rodape-site.tsx` | Criar | Shell compartilhada por todas as rotas de `(site)` |
| `apps/web/app/(site)/layout.tsx` | Criar | Shell + metadata base do site público |
| `apps/web/app/(site)/page.tsx` | Criar | Home |
| `apps/web/app/(site)/sabores/page.tsx` | Criar | Vitrine |
| `apps/web/app/(site)/sabores/[slug]/page.tsx` | Criar | Página de produto |
| `apps/web/app/(site)/como-aquecer/page.tsx` | Criar | Preparo e FAQ |
| `apps/web/app/(site)/eventos/page.tsx` | Criar | Porta de entrada de eventos: serviço, faixas de preço e CTA de WhatsApp (RN16). Conteúdo estático — o simulador é item próprio do ROADMAP |
| `apps/web/app/(site)/legal/termos/page.tsx` · `legal/privacidade/page.tsx` | Criar | Rotas com conteúdo provisório (texto real é NAPO-009) |
| `apps/web/app/(site)/not-found.tsx` | Criar | 404 da marca (RN1) |
| `apps/web/app/sitemap.ts` · `robots.ts` | Criar | Convenção nativa do Next; gerados no build |
| `apps/web/app/page.tsx` | Deletar | Tela de verificação descartável do NAPO-001; a home real assume a raiz |
| `apps/web/src/features/catalogo/` | Criar | `services/` (leitura, JSON-LD), `components/` (`CardProduto`, `BlocoRotulagem`, `EstadoDisponibilidade`, `SeletorFornada`, `BarraFornada`), `index.ts` |
| `apps/web/src/features/disponibilidade/services/produtos.ts` | Modificar | Deriva a lista do catálogo em vez da query string |
| `apps/web/app/api/disponibilidade/route.ts` | Modificar | Sem `?produtos=`, responde sobre todo o catálogo ativo |
| `apps/web/public/produtos/` | Criar | Fotos do ensaio pré-otimizadas (quadradas, para máscara circular) + placeholder dos 3 sabores ainda sem foto |
| `supabase/tests/0010_catalogo_rls.sql` | Criar | pgTAP da RN12 |
| `ARCHITECTURE.md` | Modificar | §7.3 ganha `Product` + `Offer` ao lado de `Restaurant` |

**Fora do mapa, deliberadamente:** `packages/ui/src/tokens.css` (a base do NAPO-002 é revisada, não reescrita — qualquer token novo é exceção a justificar), tabelas de pedido/carrinho (NAPO-006) e qualquer rota de admin (NAPO-008).

---

## 2. Decisões de Schema

### 2.1 Mudanças

Três tabelas em `0010_catalogo.sql`: `categorias`, `faixas_preco`, `produtos` — colunas conforme spec R1 §4, acrescidas dos campos de rotulagem da RN2. Mais o enum `public.alergeno`.

Decisões que o SQL não explica sozinho:

- **Preço em `int` de centavos, não `numeric` nem `float`.** Float erra centavo em soma, e o preço vai ser somado com frete, imposto e taxa de cartão no NAPO-006/008. `numeric` seria correto também, mas obriga a converter em toda fronteira JS; centavo inteiro atravessa JSON sem perda e o `packages/core` já opera assim.
- **`eh_massa` mora na categoria, não no produto.** O sub-teto de massa (RN8 do NAPO-004) vale para a categoria inteira. Colocar no produto convida a divergência entre dois produtos da mesma categoria.
- **Alérgenos como `alergeno[]`, em duas colunas separadas** (`alergenos_contem` e `alergenos_pode_conter`). São declarações juridicamente distintas: uma afirma composição, a outra afirma risco de contato. Fundir em uma coluna com flag perde a distinção exatamente onde ela protege alguém.
- **Enum em vez de texto livre** porque alérgeno com grafia divergente ("avelã" × "avela") é alérgeno invisível para filtro e para a etiqueta futura.
- **`ranking_mais_pedidas smallint` (1, 2, 3 · nulo · único) no lugar do booleano `destaque`** da spec R1 §4. A home mostra "As mais pedidas" em ordem, e ordem não cabe em booleano nem em enum. Índice único parcial (`where ranking_mais_pedidas is not null`) impede dois produtos disputando a mesma posição — sem isso, a ordem da home passaria a depender de tiebreak acidental do banco. O rótulo exibido é factual, então o campo só pode ser preenchido com o que a casa realmente mede.
- **A RN2 é `CHECK` no banco, não validação de tela.** `check (not ativo or (denominacao_venda is not null and peso_liquido_g is not null and validade_dias is not null and conservacao is not null and preparo is not null and array_length(alergenos_contem, 1) is not null))`. Publicar produto sem rotulagem passa a ser impossível, não improvável — a regra vale para seed, para o admin do NAPO-008 e para qualquer script futuro, sem ninguém precisar lembrar dela.
- **FKs que o NAPO-004 deixou pendentes entram aqui:** `lotes.produto_id`, `producao_planejada.produto_id` e `reservas.produto_id` passam a referenciar `produtos`, como a migration `0004` anotou em comentário.

### 2.2 Alternativas de modelagem descartadas

- **Tabela `alergenos` + junção** — normalização correta para um catálogo que fosse editável por usuário. Para 8 valores fixos por norma sanitária, troca uma coluna legível por dois joins em toda leitura de página.
- **Alérgenos derivados do BOM (ficha técnica)** — parece mais correto, e é o que o NAPO-008 vai permitir cruzar. Mas "pode conter" nasce de contato cruzado na cozinha, que o BOM não modela: é declaração editorial da casa. Derivar automaticamente produziria uma lista tecnicamente completa e sanitariamente incompleta.
- **`preco` direto no produto, sem faixas** — a operação pensa em faixas (39,90 / 45,90 / 49,90 / 15,00) e reajusta por faixa. Preço solto por produto transformaria "reajustar a faixa Especial" em 5 updates independentes, com chance de divergir.

### 2.3 Decisões de índice / performance

- `produtos (slug)` **único** — é o acesso da página de produto e a garantia da RN8.
- `produtos (categoria_id, ordem) where ativo` — é literalmente a consulta da vitrine.
- Nada além disso. O catálogo tem 12 linhas; índice a mais aqui é cerimônia, não performance.

### 2.4 Migration

- `0010_catalogo.sql` — estrutura, RLS, FKs pendentes.
- `0011_catalogo_seed.sql` — os 12 produtos, categorias e faixas.
- **Seed do catálogo vai em migration, não em `supabase/seed.sql`.** O `seed.sql` existente é explicitamente dado de teste, roda só em `db reset` e nunca alcança staging ou produção. O catálogo precisa existir nos três ambientes: é configuração do produto, não fixture.
- Reversível: as três tabelas nascem aqui, então `drop` limpa sem perda de dado de cliente. As FKs adicionadas às tabelas do NAPO-004 são o único ponto que exige atenção ao reverter.

---

## 3. Decisões de Contrato

### 3.1 Leitura do catálogo — sem endpoint novo

As páginas de `(site)` são Server Components que leem o catálogo direto pelo client Supabase no build (SSG). Não existe `GET /api/produtos`: criar endpoint para a própria página consumir adicionaria um salto de rede sem nenhum consumidor externo. Quando o NAPO-006 precisar do catálogo no cliente, ele terá o contexto de carrinho.

### 3.2 `GET /api/disponibilidade` — muda a origem da lista de produtos

Hoje a rota exige `?produtos=id,id&massas=id`, porque o catálogo não existia — o próprio `services/produtos.ts` documenta isso como transição. Agora:

- **sem `?produtos=`** → a rota carrega todos os produtos ativos do catálogo e deriva `ehMassa` de `categorias.eh_massa`;
- **com `?produtos=`** → comportamento atual preservado, para não quebrar o contrato que o NAPO-004 já entregou e testou.

A resposta não muda de formato. `dynamic = 'force-dynamic'` permanece: disponibilidade nunca vem de cache.

### 3.3 Convenção de resposta

Inalterada (`ARCHITECTURE.md` §4.2).

---

## 4. Decisões de UI

### 4.1 Auditoria de Reuso

| Elemento da tela | Decisão | Origem / justificativa |
|---|---|---|
| Botão (CTA, links de ação) | 🔧 **ESTENDER** | `Button` existe, mas nasceu para formulário de auth com `w-full` fixo. Adicionar largura natural como variante de `size` — não criar segundo botão |
| Card de produto (moldura) | ♻️ **REUSAR** | `Card` do catálogo, com `className` de composição |
| Selo de alérgeno / esgotado / ranking | ✨ **CRIAR** | `Badge` — primitivo shadcn que o NAPO-002 não precisou. É o veículo da RN3 |
| Seletor de quantidade (−/n/+) | ✨ **CRIAR** | `SeletorQuantidade` em `packages/ui` — nasce aqui limitado ao estoque da fornada e é o mesmo controle que o carrinho do NAPO-006 vai usar |
| Seletor de fornada | ✨ **CRIAR na feature** | `SeletorFornada` — lê `GET /api/disponibilidade` e governa a disponibilidade de toda a página (RN13) |
| Logotipo | ♻️ **REUSAR** | `<Marca>` — regra inviolável de `ARCHITECTURE.md` §2.2.2 |
| Cabeçalho e rodapé do site | ✨ **CRIAR** | `cabecalho-site` e `rodape-site` em `patterns/` — compartilhados por 7 rotas, é a definição de pattern |
| `<CardProduto>`, `<BlocoRotulagem>`, `<EstadoDisponibilidade>` | ✨ **CRIAR na feature** | Servem só ao catálogo; por `ARCHITECTURE.md` §3.2 pertencem a `features/catalogo`, não a `packages/ui` |
| Tipografia, cores, raios | ♻️ **REUSAR** | `tokens.css` do NAPO-002. Token novo aqui é exceção que exige justificativa |

### 4.2 Composição

```
app/(site)/layout.tsx ── <CabecalhoSite> · {children} · <RodapeSite>
   │
   ├─ page.tsx ................ hero (eixo da marca) → destaques → prova física → área de entrega
   ├─ sabores/page.tsx ........ filtro por categoria → grid de <CardProduto>
   ├─ sabores/[slug]/page.tsx . galeria → preço + <EstadoDisponibilidade> → CTA → <BlocoRotulagem> → preparo
   ├─ como-aquecer/page.tsx ... passo a passo + FAQ
   ├─ legal/* ................. texto provisório
   └─ not-found.tsx ........... 404 da marca
```

### 4.3 Estados visuais

| Região | Estados |
|---|---|
| `<CardProduto>` | disponível · escasso (quantidade real) · esgotado · destaque |
| `<EstadoDisponibilidade>` | carregando (skeleton na altura final) · disponível · escasso · esgotado · **indeterminado** (motor fora do ar — não afirma nada) |
| CTA de compra | desabilitado com microcopy honesto (canal ainda não aberto) — único estado no R1 |
| Imagem de produto | placeholder na proporção final · foto real, sem diferença de layout entre os dois |
| Vitrine | lista completa · filtro por categoria aplicado |

### 4.4 Preview Visual Aprovado

**Aprovado por Hudson (PM) em 2026-08-13**, após 5 rodadas de iteração no Gate Visual A.
Mecanismo: **HTML standalone + Tailwind v4 via CDN + `@theme` espelhando `packages/ui/src/tokens.css`** (Receita R1 da matriz — projeto Next + Tailwind, então as classes migram quase 1:1 para JSX).
Modelo: **B — múltiplos arquivos**, um por jornada.

#### 4.4.1 Arquivos de preview

| Arquivo | Rota(s) coberta(s) |
|---|---|
| [`preview-home.html`](./preview-home.html) | `/` |
| [`preview-sabores.html`](./preview-sabores.html) | `/sabores` |
| [`preview-produto.html`](./preview-produto.html) | `/sabores/[slug]` |
| [`preview-conteudo.html`](./preview-conteudo.html) | `/como-aquecer` · `/eventos` · `/legal/*` · `not-found` |
| [`preview-cards.html`](./preview-cards.html) | Nenhuma — registro da decisão de card (A1/A2/A3 + selos). **Não implementar** |

`fotos/` contém as 9 fotos de produto já cortadas em quadrado (900×900) e comprimidas para ≤150 KB, mais `forno` e `capa`. São as mesmas que o bloco C2 leva para `apps/web/public/produtos/`. Originais em `docs/images/ensaio/`.

#### 4.4.2 Componentes do catálogo usados

| Elemento | Componente | Origem |
|---|---|---|
| Logotipo (header, rodapé) | `<Marca>` | `packages/ui/src/components/marca.tsx` |
| Botões e CTAs | `<Button>` variantes `default` · `outline` · `ghost` | `packages/ui` (estendido: largura natural) |
| Molduras de conteúdo | `<Card>` | `packages/ui` |
| Ícones | `lucide-react` | dependência já adotada |
| Tokens (cor, raio, fonte) | `tokens.css` | `packages/ui` — **nenhum token novo** |

#### 4.4.3 Componentes novos a criar

| Componente | Onde vive | Por que os existentes não servem |
|---|---|---|
| `<CabecalhoSite>` · `<RodapeSite>` | `packages/ui/src/patterns/` | Shell repetida em 7 rotas; `<AuthCard>` é moldura de formulário centrado, não navegação de site |
| `<Badge>` | `packages/ui/src/components/` | Não existe primitivo de rótulo; é o veículo do ranking, do alérgeno e do carimbo de esgotado |
| `<SeletorQuantidade>` | `packages/ui/src/components/` | Controle −/n/+ com teto de estoque; `<Input>` numérico não entrega o alvo de toque nem o limite |
| `<CardProduto>` | `features/catalogo/components/` | **Variação A3 (painel)**: disco a 74% dentro de painel `superficie-alta` com sombra, bloco de dados em `superficie`. Serve só ao catálogo (`ARCHITECTURE.md` §3.2) |
| `<SeletorFornada>` | `features/catalogo/components/` | Escolha da data de entrega (RN13); governa a disponibilidade da página inteira |
| `<BarraFornada>` | `features/catalogo/components/` | Ocupação do forno (`47/130`) — elemento narrativo, aparece em home e vitrine |
| `<BlocoRotulagem>` | `features/catalogo/components/` | Rotulagem legal (RN2/RN4) em vocabulário de etiqueta, monoespaçada |
| `<EstadoDisponibilidade>` | `features/catalogo/components/` | 4 estados: disponível · escasso · esgotado com rota para a próxima fornada · indeterminado |

#### 4.4.4 Markup cru aceito

- Containers de página (`mx-auto max-w-6xl px-5 sm:px-8`) e grids de seção.
- Grid da vitrine (1 / 2 / 3 colunas) e grids das seções da home.
- Régua comparativa da home (`grid sm:grid-cols-[1fr_auto_1fr]` com cabeçalho de lado).
- Hero: posicionamento da imagem e do gradiente de fusão.
- Espaçamento entre primitivos.

#### 4.4.5 Decisões visuais que o preview fixou

- **Disco**: produto sempre em círculo, dentro de painel. Resolve fundo inconsistente entre as fotos (tábua, granito, toalha xadrez) e usa o ativo da marca.
- **Hero = `100dvh - header`**, tipografia e espaçamentos em `clamp()`, seta de rolagem ancorada.
- **Selos**: ranking como marca circular amarela / fita ancorada; esgotado como carimbo diagonal sobre foto dessaturada.
- **Fornada** como assinatura tipográfica (monoespaçada) e como barra de ocupação.
- **Régua comparativa** com lados rotulados ("Congelada de supermercado" × "Napo").
- **Unidade correta**: "pizzas disponíveis", nunca "vagas" — vaga é do forno, pizza é do cliente.

### 4.5 Decisões de UX não-óbvias

- **A fornada ativa é estado de página, carregado na URL** (`?entrega=YYYY-MM-DD`). Querystring e não cookie: a página é SSG servida do CDN, o link precisa ser compartilhável ("compra comigo para dia 28") e o estado precisa sobreviver a recarregar. Sem parâmetro, a fornada ativa é a primeira que o motor devolver.
- **O hero ocupa exatamente `100dvh - altura do header`**, com `clamp()` na tipografia e nos espaçamentos verticais. `dvh` e não `vh` por causa da barra do navegador móvel, que faria o hero estourar a tela em iOS. Uma seta ancorada no rodapé do hero indica a rolagem: seção de altura exata sem borda visível esconde que há conteúdo abaixo.
- **Disponibilidade é ilha cliente sobre página estática.** A página inteira sai do CDN; só o bloco de disponibilidade busca `/api/disponibilidade` depois da montagem. Alternativa rejeitada: renderizar a página no servidor a cada visita — mataria o SSG que `ARCHITECTURE.md` §4.5 exige e transformaria cada visita em execução paga.
- **O skeleton de disponibilidade ocupa a altura final desde o primeiro paint** (RN11 e CLS): o bloco não pode empurrar o preço quando o dado chega.
- **Motor fora do ar não vira "disponível".** O estado indeterminado é visualmente distinto e não oferece compra. Um bloco vazio seria lido como disponível, que é o erro caro.
- **Escassez mostra número, não urgência.** "Restam 4 para sexta" e nunca "Últimas unidades!" — a spec R1 chama isso de verdade verificável, e é o que separa a Napo do e-commerce genérico.
- **CTA desabilitado explica o motivo.** Botão morto sem microcopy lê como bug.
- **Alérgeno não é nota de rodapé.** Fica junto do preço e do CTA na página de produto, e como selo no card da vitrine (RN3).

### 4.6 Responsividade

Mobile-first (`ARCHITECTURE.md` §7.1). Grid da vitrine: 1 coluna < 640px · 2 colunas < 1024px · 3 colunas ≥ 1024px. Página de produto empilha em coluna única no mobile e vira duas colunas (mídia | compra) ≥ 1024px.

### 4.7 Acessibilidade

- Alérgeno em texto, nunca só cor ou ícone — a informação crítica não pode depender de percepção de cor.
- `alt` real nas imagens, inclusive nos placeholders.
- Estado "esgotado" anunciado em texto, não só por opacidade.
- Contraste do amarelo sobre preto verificado nos tamanhos de texto usados.
- Movimento respeita `prefers-reduced-motion` (já global em `globals.css`).

---

## 5. Decisões Técnicas Gerais

- **Fotos pré-otimizadas, servidas por `<img>` com dimensões fixas — sem `next/image`.** Esta é a decisão de custo que o item do ROADMAP exigia fechar. `next/image` cobraria transformação por variante de tamanho na Vercel para um catálogo de 12 produtos que muda uma vez por trimestre; otimizar uma vez, no momento de subir a foto, custa zero por visita. O `<Marca>` já estabeleceu esse precedente no NAPO-002. Trade-off aceito: sem `srcset` automático, o ganho de banda em tela pequena é menor — irrelevante para 12 imagens servidas de CDN.
- **As fotos entram no repositório, não no Storage.** Reavaliado em 2026-08-13, quando o ensaio apareceu: são 12 arquivos que mudam por trimestre e precisam ser versionados junto com o catálogo que os referencia. Storage faria sentido para imagem enviada por usuário do admin — que é NAPO-008. Enquanto o catálogo é seed versionado, a foto acompanha o mesmo ciclo. **Exigem processamento antes de entrar:** os originais têm 90 KB a 8 MB; o corte é quadrado (a máscara circular é do CSS) e o alvo é ≤150 KB por arquivo.
- **`(site)` é SSG com `revalidate` longo** (`ARCHITECTURE.md` §4.5). O catálogo muda por deploy no R1, então revalidação é rede de segurança, não mecanismo primário.
- **`generateStaticParams` a partir dos produtos ativos** — as 12 páginas nascem no build. Produto inativo não gera rota, e `dynamicParams = false` fecha a RN1 pela porta do framework: slug desconhecido é 404 sem consultar banco.
- **JSON-LD montado em `packages/core`, não na página.** Preço e disponibilidade no JSON-LD precisam ser os mesmos da tela (RN9). Derivando ambos da mesma função pura, divergir passa a exigir esforço; montando o objeto no JSX, coincidir é que exigiria disciplina.
- **Preço efetivo é regra pura** (`packages/core/src/catalogo/preco.ts`): a precedência de `preco_override` sobre a faixa decide o que o cliente paga. `ARCHITECTURE.md` §3.1 é explícito: regra que decide preço mora no núcleo testável.
- **Metadata por página via `generateMetadata`**, sem biblioteca de SEO. `title`, `description`, canônica e Open Graph são API nativa do Next 15; dependência aqui seria peso sem ganho.

---

## 6. Dependências Novas

Nenhuma biblioteca nova, nenhuma variável de ambiente nova, nenhuma integração externa nova. O `Badge` é código de catálogo shadcn copiado para `packages/ui`, no mesmo padrão dos 7 primitivos do NAPO-002.

---

## 7. Plano de Blocos

São 9 blocos — acima do limite de 5 do template. Ver [`plan.md`](./plan.md).

---

## 8. Riscos Conhecidos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Rotulagem dos 12 produtos não chega a tempo | Média | Bloqueia só o bloco C | RN2 impede publicar incompleto; produto sem rotulagem nasce inativo e o resto da spec segue |
| Foto real com proporção diferente do placeholder | Média | Layout quebrado no NAPO-020 | Proporção é contrato do preview aprovado e vira critério visual em `tests.md`; a direção do ensaio recebe a proporção antes de fotografar |
| Slug definido agora se mostrar ruim depois da indexação | Baixa | Alto (mapa de 301) | Slugs revisados no seed, antes de qualquer publicação. Nada está indexado até NAPO-021 |
| Divergência entre JSON-LD e tela após mudança de preço | Baixa | Penalização de rich result | Mesma origem pura para os dois; cenário de teste cobre |
| FK adicionada às tabelas do NAPO-004 rejeitar dado existente | Baixa | Migration falha | Ambientes ainda não têm dado real de lote; validar em `db reset` antes do push |
| Catálogo só editável por deploy até o NAPO-008 | Alta | Operacional | Consequência aceita e registrada em `spec.md` §7 |
