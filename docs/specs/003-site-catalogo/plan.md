# 🧱 Plano de Blocos: NAPO-003

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md)

> Existe porque a spec tem 9 blocos e o `design.md` §7 só comporta 5.
> Ordem de execução do `/implementar`, em TDD-leve: cada bloco fecha com teste verde.

---

## Blocos

| # | Bloco | Entrega | Depende de |
|---|---|---|---|
| **A** | Schema do catálogo | `0010_catalogo.sql` — 3 tabelas, enum de alérgeno, `CHECK` da RN2, RLS de leitura pública, FKs pendentes do NAPO-004, pgTAP da RN12, tipos regenerados | — |
| **B** | Núcleo puro do catálogo | `packages/core/src/catalogo/` — preço efetivo, completude de rotulagem, montagem do JSON-LD. Testes determinísticos | — |
| **C** | Seed dos 12 produtos | `0011_catalogo_seed.sql` — categorias, faixas, 12 produtos com rotulagem real | A + **levantamento de rotulagem do PM** |
| **C2** | Fotos do catálogo | Recorte quadrado + compressão (≤150 KB) das 9 fotos de `docs/images/ensaio/` para `apps/web/public/produtos/`; placeholder para Lombo Canadense e as duas massas | — |
| **D** | Shell do site | `(site)/layout.tsx`, `cabecalho-site`, `rodape-site`, `not-found.tsx`, `Badge`, `Button` estendido. Remoção da home descartável do NAPO-001 | — |
| **E** | Vitrine | `/sabores` — grid, filtro por categoria, `<CardProduto>`, selo de alérgeno | A + B + D |
| **F** | Página de produto | `/sabores/[slug]` — `generateStaticParams`, `<BlocoRotulagem>`, CTA inativo, 404 de slug desconhecido | A + B + D |
| **G** | Fornada e disponibilidade ao vivo | `<SeletorFornada>`, `<BarraFornada>`, `<EstadoDisponibilidade>` (ilhas cliente), estado na querystring, rota para a próxima fornada com estoque (RN13/RN14) + ajuste de `produtos.ts` e da rota de disponibilidade | E + F |
| **H** | SEO | `generateMetadata`, `sitemap.ts`, `robots.ts`, JSON-LD `Product`+`Offer`+`Restaurant`, atualização de `ARCHITECTURE.md` §7.3 | E + F |
| **I** | Conteúdo | `/como-aquecer` (preparo + FAQ), placeholders legais | D |

## Grafo

```
A ─┬─ C (espera rotulagem do PM)
   ├─ E ─┬─ G
B ─┤     │
   └─ F ─┴─ H
D ─┬─ E, F, I
```

**Paralelizável:** A, B e D não dependem entre si. I pode sair a qualquer momento após D.
**Caminho crítico:** A → E/F → G/H.
**C é o único bloco com dependência externa** — se a rotulagem atrasar, os outros 8 fecham e o catálogo sobe com os produtos que tiverem dado completo (a RN2 garante que nenhum incompleto vaza).

## Ordem sugerida

`A` → `B` → `D` → `E` → `F` → `G` → `H` → `I` → `C`

O seed vai por último de propósito: quando ele rodar, todas as telas que consomem o dado já existem, e um campo de rotulagem mal levantado aparece na hora, não três blocos depois.
