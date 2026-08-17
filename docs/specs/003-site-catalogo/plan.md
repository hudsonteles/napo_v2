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
| **D2** | Home + remoção da `app/page.tsx` do NAPO-001 | `(site)/page.tsx` (hero, régua, eventos, entrega) + seções que consomem `CardProduto` (E) e `BarraFornada` (G). **Depende de E + G** | E + G | T5, T14 | `[ ]` pendente (movido de D) |
| **E** | Vitrine | `/sabores` — grid, filtro por categoria, `<CardProduto>`, selo de alérgeno/ranking | A + B + D | T1, T12, T24 (T20 no G) | `[x]` concluído |
| **F** | Página de produto | `/sabores/[slug]` — `generateStaticParams`, `dynamicParams=false`, `<BlocoRotulagem>`, CTA inativo, 404 de slug | A + B + D | T2, T9 | `[x]` concluído |
| **G** | Fornada e disponibilidade ao vivo | `<SeletorFornada>`, `<BarraFornada>`, `<EstadoDisponibilidade>` (ilhas cliente), estado na querystring, rota p/ próxima fornada (RN13/RN14); ajusta `produtos.ts` + rota de disponibilidade | E + F | T3, T4, T21, T22, T23, T15 | `[ ]` pendente |
| **H** | SEO | `generateMetadata`, `sitemap.ts`, `robots.ts`, JSON-LD `Product`+`Offer`+`Restaurant`, `ARCHITECTURE.md` §7.3 | E + F | T7, T25 | `[ ]` pendente |
| **I** | Conteúdo | `/como-aquecer`, `/eventos` (RN16), `/legal/*` provisório | D | T6, T14 | `[ ]` pendente |
| **C** | Seed dos 12 produtos | `0011_catalogo_seed.sql` — categorias, faixas, 12 produtos com **rotulagem real** | A + **rotulagem do PM** | integra T1, T2, T5 | `[ ]` **bloqueado (dado externo)** |

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

## Dado externo pendente (bloco C)

O seed de produção precisa da **rotulagem dos 12 produtos** (denominação de venda, peso líquido, validade em dias, conservação, preparo, lista "contém" e lista "pode conter"). É levantamento do PM (`spec.md` §6) e **não pode ser inventado** — é rotulagem regulada (RN2/RN4). Enquanto não chega:

- Blocos A..I são construídos e testados contra uma **fixture de teste não-produção** (`supabase/seed.sql`, que só roda em `db reset` local — nunca alcança staging/prod, por decisão do `design.md` §2.4).
- A migration de produção `0011` (bloco C) só é escrita quando a rotulagem real existir. RN2 (`CHECK` no banco) garante que nenhum produto incompleto seja publicado no intervalo.

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

## Decisões de execução

_(preenchida durante a implementação — 1 bullet por decisão, máx. 2 linhas: fato + motivo)_

- **Pré-flight (2026-08-17):** `.env.local` local completado com `NEXT_PUBLIC_SITE_URL`/`OTP_PEPPER` (vars do NAPO-002 que faltavam) e kit `oria-orquestrador-ia/` adicionado ao `ignores` do eslint (gitignored, fora da CI). Ambos destravam o gate; o eslint foi commit próprio (`chore(devx)`).
- **Bloco A (2026-08-17):** fixture de catálogo no `seed.sql` + FK do NAPO-004 reusando o id do teste de reserva → 0004 segue verde sem mudança. Colunas `diametro_cm`/`porcoes` do preview e comportamento real de RLS anon (vazio, não erro). Detalhes em `drift.md` (D1–D4).
- **Bloco B (2026-08-17):** `ProdutoCatalogo` (nome distinto do `Produto` de disponibilidade, evita colisão no barrel). T13 parte pura entregue aqui (`conteudo.ts` — scanner de alegação de saúde com lista curada que preserva o sensorial "leve"); a varredura sobre o conteúdo/meta reais roda no bloco H/E/F.
- **Bloco F (2026-08-17):** `generateStaticParams` + `dynamicParams=false` → 12 páginas SSG, slug desconhecido/inativo em 404 sem tocar o banco (T9). `SeletorQuantidade.onChange` virou opcional para o Server Component da página renderizá-lo sem passar função (fronteira server→client). `SeletorFornada` + disponibilidade ao vivo são do G. Verificado no HTML: rotulagem completa (T2).
- **Bloco E (2026-08-17):** leitura SSG usa **client anônimo sem cookies** (`lib/supabase/anon.ts`, novo) — `server.ts` (com `cookies()`) tornaria a página dinâmica e quebraria o SSG (T19 confirmado: `/sabores` saiu `○ Static`). Disponibilidade ao vivo (qty/esgotado) + `SeletorFornada` são ilha cliente do **G**; a vitrine do E é estática com rodapé neutro ("pedido online em breve"). `centavosParaReais` somado ao core. `<img>` com `eslint-disable no-img-element` (design §5, sem `next/image`). Testes de UI: sem RTL no projeto → mappers/helpers testados em `.ts`, render por Gate Visual B.
- **Bloco D (2026-08-17):** `cabecalho-site`/`rodape-site` usam `<a>` (packages/ui não importa `next`, ARCHITECTURE §3.2 — full-nav aceitável em SSG); em `apps/web`, links internos usam `next/link` (regra `no-html-link-for-pages`). `Button` ganhou variante `largura` (declarada antes de `size` p/ preservar o `w-auto` do `size: link`). **Home saiu do bloco D** para o novo **D2** (depende de `CardProduto`/`BarraFornada`, E+G); a `app/page.tsx` do NAPO-001 continua no `/` até lá.
