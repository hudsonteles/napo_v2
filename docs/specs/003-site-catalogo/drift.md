# Spec Drift — NAPO-003

> Divergências entre o que a spec/design fixou e o que a implementação fez, com o porquê.
> Doc é contrato + WHY; código é a verdade viva.

---

## Bloco A — Schema (2026-08-17)

### D1 — Fixture de catálogo no `supabase/seed.sql` (não estava no Mapa de Impacto)

O `design.md` §1 só lista o seed de **produção** (`0011_catalogo_seed.sql`, bloco C), que depende da rotulagem real do PM. Para exercitar vitrine, página de produto, SEO e RLS **antes** desse dado chegar, adicionei uma **fixture de teste não-produção** ao `supabase/seed.sql` (12 produtos com rotulagem placeholder, 3 categorias, 4 faixas). Roda só em `db reset` local (`design.md` §2.4: `seed.sql` é dado de teste, nunca alcança staging/prod). **Aprovado pelo PM em 2026-08-17** ("seguir com fixture, segurar o C"). Quando o bloco C entrar, esta seção do seed sai (senão colide o `slug` único).

### D2 — FK do NAPO-004 reusa o id que o teste já referencia

O `design.md` §8 previu o risco "FK adicionada às tabelas do NAPO-004 rejeitar dado existente" pensando no **seed** (vazio, sem risco). O ponto real foi o **teste** `0004_reserva_concorrencia_test.sql`, que insere `lotes`/`producao_planejada` com `produto_id = 'dddddddd-…-0001'` fictício — a FK o quebraria. Resolvido sem tocar naquele teste: a Margherita da fixture usa exatamente esse id, então a FK passa a apontar para um produto real. Teste do NAPO-004 segue verde sem alteração.

### D3 — Colunas `diametro_cm` e `porcoes` além da lista da RN2

O `design.md` §2.1 enumera os campos obrigatórios da RN2. Adicionei `diametro_cm` e `porcoes` (nuláveis, fora do CHECK) porque o **preview aprovado** (`preview-produto.html`, bloco DIÂMETRO "30 cm · serve 2") os exibe. Extensão de exibição, não da regra.

### D5 — 404 da marca vive na raiz (`app/not-found.tsx`), não em `(site)/not-found.tsx`

O `design.md` §1 mapeia o 404 como `app/(site)/not-found.tsx`. Descoberto no Gate Visual B do checkpoint (PM apontou que `/sabores/slug-inexistente` mostrava o 404 **padrão do Next**): com `dynamicParams=false`, o slug desconhecido/inativo 404 no **roteamento**, e o Next resolve isso pelo not-found da **raiz** — o do grupo `(site)` só pega `notFound()` chamado dentro de páginas do grupo. Movido para `app/not-found.tsx` (global), compondo `CabecalhoSite`/`RodapeSite` na mão (o layout raiz não tem shell). Cobre 404 de produto e qualquer rota fora do mapa, mantém `dynamicParams=false` (sem consulta ao banco). O `(site)/not-found.tsx` foi removido (redundante). Verificado: HTTP 404 + corpo da marca + shell.

### D4 — T16/T17 seguem o comportamento real do Postgres/Supabase

`tests.md` T16 diz "consultas a profiles/lotes/reservas/auditoria **retornam vazio**". Verificado empiricamente: anon tem privilégio amplo (padrão Supabase) e a RLS deny-by-default devolve **0 linhas** — não erro. Coerente com a RN12 ("não alcança nenhuma outra tabela") e com o padrão já usado no teste de calendário. T17: anon INSERT lança RLS violation (42501), mas UPDATE/DELETE **afetam 0 linhas** (RLS torna o alvo invisível) em vez de lançar — mesmo efeito de segurança, testado com `is_empty(... returning 1)`.
