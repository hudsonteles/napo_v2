# 🧱 Plano de Execução — NAPO-003 Site público, catálogo e SEO

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos≈24 (>15), N_testes=25, sensitivo=S (RLS pública, primeira superfície anônima do banco)
**Plano criado em:** 2026-08-12 (blocos) · **convertido para execução em:** 2026-08-17
**Modo de execução:** com checkpoints — PM aprovou em 2026-08-17. Paradas após Bloco A e após Bloco F. Bloco C aguarda rotulagem do PM (fixture de teste cobre A..I).

---

## Stack (derivada de ARCHITECTURE.md)

`TypeScript strict · Next.js 15 App Router (SSG) · Server Components + ilhas cliente · Supabase/Postgres (sem ORM, SQL + tipos gerados) · Vitest + pgTAP · shadcn/ui em packages/ui + Tailwind v4 @theme · lucide-react`

## Agentes elegíveis (após fitness)

`.agents/agent/` não existe → sem catálogo de especialistas. Todo bloco delegável usa `general-purpose` com prompt rico (ARCHITECTURE.md + design.md + Mapa restrito).

- Execução **majoritariamente inline** no main agent: o site é um sistema visual coeso (tokens, componentes e disco compartilhados) — coerência entre blocos vale mais que paralelismo aqui.
- Paralelização candidata (Mapa disjunto): A, B e D não dependem entre si.

---

## Blocos

| # | Bloco | Entrega | Depende de | Testes | Status |
|---|-------|---------|-----------|--------|--------|
| **A** | Schema do catálogo | `0010_catalogo.sql` — 3 tabelas, enum de alérgeno, `CHECK` da RN2, RLS de leitura pública, FKs pendentes do NAPO-004, `db:types`; pgTAP em `0010_catalogo_rls.sql` | — | T8, T16, T17, T18 | `[x]` concluído |
| **B** | Núcleo puro do catálogo | `packages/core/src/catalogo/` — preço efetivo, completude de rotulagem, montagem do JSON-LD. Testes determinísticos | — | T10, T13, T25 | `[x]` concluído |
| **C2** | Fotos do catálogo | 9 fotos de `fotos/` → `apps/web/public/produtos/{slug}.jpeg` + `capa`/`forno` (≤150 KB nos produtos); placeholder dos 3 sem foto é disco CSS no `CardProduto` (E) | — | T24 | `[x]` concluído |
| **D** | Shell do site | `(site)/layout.tsx`, `cabecalho-site`, `rodape-site`, `not-found.tsx`, `Badge`, `SeletorQuantidade`, `Button` estendido (variante `largura`) | — | — (base de T9) | `[x]` concluído |
| **D2** | Home + remoção da `app/page.tsx` do NAPO-001 | `(site)/page.tsx` (hero, fornada, mais pedidas, régua, eventos, entrega/área) | E + G | T5, T14 | `[x]` concluído |
| **E** | Vitrine | `/sabores` — grid, filtro por categoria, `<CardProduto>`, selo de alérgeno/ranking | A + B + D | T1, T12, T24 (T20 no G) | `[x]` concluído |
| **F** | Página de produto | `/sabores/[slug]` — `generateStaticParams`, `dynamicParams=false`, `<BlocoRotulagem>`, CTA inativo, 404 de slug | A + B + D | T2, T9 | `[x]` concluído |
| **G** | Fornada e disponibilidade ao vivo | `<SeletorFornada>`, `<BarraFornada>`, `<EstadoDisponibilidade>` (ilhas cliente), estado na querystring, rota p/ próxima fornada (RN13/RN14); ajusta `produtos.ts` + rota de disponibilidade | E + F | T3, T4, T21, T22, T23 | `[x]` concluído |
| **H** | SEO | `generateMetadata`, `sitemap.ts`, `robots.ts`, JSON-LD `Product`+`Offer`+`Restaurant` | E + F | T7, T25 | `[x]` concluído |
| **I** | Conteúdo | `/como-aquecer` (preparo+FAQ), `/eventos` (RN16), `/legal/termos`+`/legal/privacidade` provisórios | D | T6 | `[x]` concluído |
| **C** | Seed dos 12 produtos | `0011_catalogo_seed.sql` — categorias, faixas, 12 produtos com **rotulagem real** | A + **rotulagem do PM** | integra T1, T2, T5 | `[x]` concluído |

## Grafo de dependências

```
A ─┬─ E ─┬─ G
B ─┤     │
D ─┴─ F ─┴─ H
D ─── I
A + (rotulagem do PM) ─── C   (seed de produção; fixture de teste cobre A..I antes)
C2 ─── (fotos; independente)
```

**Caminho crítico:** A → E/F → G/H.
**Ordem de execução:** `A` → `B` → `D` → `C2` → `E` → `F` → `G` → `H` → `I` → `C`.

## Dado externo do bloco C — resolvido (2026-08-17)

A rotulagem dos 12 produtos foi levantada com o PM em 2026-08-17 e gravada em `0011_catalogo_seed.sql`. A fixture de teste de catálogo saiu do `supabase/seed.sql` (colidiria no slug único); o `seed.sql` volta a ser só identidade + operação.

## Checkpoints intermediários sugeridos (GRANDE)

- **Após Bloco A:** schema + RLS pública é a fundação sensível (primeira exposição a anônimo). PM confere modelagem e políticas antes de qualquer UI subir em cima.
- **Após Bloco F:** vitrine + página de produto prontas → **Gate Visual B** nas superfícies-núcleo contra os previews aprovados.
- **Bloco C:** aguarda a rotulagem do PM independentemente do modo escolhido.

Estas sugestões só bloqueiam se o PM escolher `Modo de execução: com checkpoints`. Em `autônomo`, cada bloco verde é commitado e o próximo inicia sem confirmação (exceto C, que depende do dado externo).

## Notas de execução

- Commits incrementais por bloco: `feat(NAPO-003): bloco [letra] — [resumo] (Tx, Ty verdes)`.
- Blocos com UI aplicam scaffolding mockup-driven (Etapa 4.0): catálogo `design.md` §4.4 é a fonte de verdade dos componentes; evidência library-first na mensagem de commit.
- `plan.md` é a fonte de verdade do progresso — Status atualizado a cada bloco.
- Nenhum token novo em `tokens.css` sem justificativa; nenhum componente novo além de `design.md` §4.4.3.

## Status de fechamento (2026-08-17)

**10 de 10 blocos concluídos** (A, B, C, C2, D, D2, E, F, G, H, I). Gate técnico verde: lint · typecheck · Vitest 152 · build · pgTAP 55 · `db:types` sem drift. **Gate Visual B do site aprovado pelo PM** em 2026-08-17; o catálogo real entrou depois e foi reconferido na aplicação.

Publicação continua sendo NAPO-021 — a spec entrega o site pronto, não no ar. Três ideias saíram desta spec (copy do site derivada de config; indicador de precificação de frete; ranking das mais pedidas derivado de venda real) e estão em 💡 Ideias do ROADMAP.

## Decisões de execução

_(preenchida durante a implementação — 1 bullet por decisão, máx. 2 linhas: fato + motivo)_

- **Pré-flight (2026-08-17):** `.env.local` local completado com `NEXT_PUBLIC_SITE_URL`/`OTP_PEPPER` (vars do NAPO-002 que faltavam) e kit `oria-orquestrador-ia/` adicionado ao `ignores` do eslint (gitignored, fora da CI). Ambos destravam o gate; o eslint foi commit próprio (`chore(devx)`).
- **Bloco A (2026-08-17):** fixture de catálogo no `seed.sql` + FK do NAPO-004 reusando o id do teste de reserva → 0004 segue verde sem mudança. Colunas `diametro_cm`/`porcoes` do preview e comportamento real de RLS anon (vazio, não erro). Detalhes em `drift.md` (D1–D4).
- **Bloco B (2026-08-17):** `ProdutoCatalogo` (nome distinto do `Produto` de disponibilidade, evita colisão no barrel). T13 parte pura entregue aqui (`conteudo.ts` — scanner de alegação de saúde com lista curada que preserva o sensorial "leve"); a varredura sobre o conteúdo/meta reais roda no bloco H/E/F.
- **Bloco H (2026-08-17):** JSON-LD `Product`+`Offer` da função pura do core (preço = tela, T25) com disponibilidade de um **snapshot de build** (`temEstoqueNoHorizonte` → InStock/OutOfStock, T23) — o buscador lê o marcado, não o vivo do cliente; a página revalida por hora. `Restaurant` estático no layout de `(site)`. `metadataBase` + template de título no layout raiz. `ARCHITECTURE.md` §7.3 já continha `Product`+`Offer` (aplicado na aprovação da spec) — sem mudança.
- **Bloco G (2026-08-17):** disponibilidade é **uma** busca compartilhada por um `DisponibilidadeProvider` (context), estado da fornada na querystring via `history.replaceState` (sem `useSearchParams` → páginas seguem SSG estáticas). View-logic pura testada (T4/T22/T23). Rota `/api/disponibilidade` responde sobre todo o catálogo ativo quando não há `?produtos=` (design §3.2), com `capacidadeRestante` para a barra. **T15** (troca de fornada com itens no carrinho) fica para o NAPO-006 — não há carrinho no R1. `BarraFornada` criada mas usada só no D2 (home). Simplificação: a barra de ocupação embutida na seção de fornada da vitrine (preview) não entrou; a barra grande é a do home. Verificado: API devolve CTP 120/produto; ilhas hidratam sobre skeleton (RN11/T20).
- **Bloco F (2026-08-17):** `generateStaticParams` + `dynamicParams=false` → 12 páginas SSG, slug desconhecido/inativo em 404 sem tocar o banco (T9). `SeletorQuantidade.onChange` virou opcional para o Server Component da página renderizá-lo sem passar função (fronteira server→client). `SeletorFornada` + disponibilidade ao vivo são do G. Verificado no HTML: rotulagem completa (T2).
- **Bloco E (2026-08-17):** leitura SSG usa **client anônimo sem cookies** (`lib/supabase/anon.ts`, novo) — `server.ts` (com `cookies()`) tornaria a página dinâmica e quebraria o SSG (T19 confirmado: `/sabores` saiu `○ Static`). Disponibilidade ao vivo (qty/esgotado) + `SeletorFornada` são ilha cliente do **G**; a vitrine do E é estática com rodapé neutro ("pedido online em breve"). `centavosParaReais` somado ao core. `<img>` com `eslint-disable no-img-element` (design §5, sem `next/image`). Testes de UI: sem RTL no projeto → mappers/helpers testados em `.ts`, render por Gate Visual B.
- **Bloco D (2026-08-17):** `cabecalho-site`/`rodape-site` usam `<a>` (packages/ui não importa `next`, ARCHITECTURE §3.2 — full-nav aceitável em SSG); em `apps/web`, links internos usam `next/link` (regra `no-html-link-for-pages`). `Button` ganhou variante `largura` (declarada antes de `size` p/ preservar o `w-auto` do `size: link`). **Home saiu do bloco D** para o novo **D2** (depende de `CardProduto`/`BarraFornada`, E+G); a `app/page.tsx` do NAPO-001 continua no `/` até lá.
- **Bloco C (2026-08-17):** rotulagem confirmada pelo PM — 550 g nas pizzas (300 g nas massas), validade 90/120 dias, sem soja nem ovos nos salgados, faixas mantidas e Banana sem override. IDs cravados na migration: o mesmo produto tem de ser a mesma linha nos três ambientes, e o teste de reserva do 0004 já referencia a Margherita por id.
- **Ranking manual (2026-08-17):** PM pediu ranking derivado do que mais vende, mas não há pedidos até o NAPO-006 — as 3 (Calabresa, Peito de Peru com Gorgonzola, Frango c/ Catupiry) foram cravadas na `0011` e a derivação automática virou ideia no ROADMAP.
- **Precaucional (2026-08-17):** "pode conter" restrito aos doces por decisão do PM (bancada da avelã). Estendido a Banana e Chocolate, que estavam sem — o precaucional é da bancada, não da receita; a Nutella não repete avelã porque já a declara em "contém". **Premissa a confirmar antes do NAPO-021:** separação real de bancada entre doce e salgado.

---

**Concluído em:** 2026-08-17 — Gate Visual B do catálogo real aprovado pelo PM.
