# Plano de Implementação — NAPO-025 Espinha de cobrança

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md) · **Contrato visual:** [`preview.html`](./preview.html)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos=27, N_testes=37, sensitivo=SIM (pagamentos, webhook público sem sessão, RLS)
**Plano criado em:** 2026-09-05
**Modo de execução:** com checkpoints (aprovado pelo PM em 2026-09-05) — parada após o Bloco B e após o Bloco E

---

## Stack (derivada de `ARCHITECTURE.md`)

TypeScript strict · Next.js 15 App Router (monorepo pnpm) · Supabase (Postgres 15.6, RLS, sem ORM — SQL versionado) · Vitest + pgTAP + Playwright · Tailwind v4 + shadcn/ui em `packages/ui` (catálogo fechado, Library-First inviolável) · Vercel.

## Agentes elegíveis (após fitness)

- ✅ **Elegíveis:** `test-engineer` (Vitest/pgTAP/Playwright) · `security-auditor` (bloco sensível: webhook público, tokenização, RLS) · `project-planner` (esta etapa)
- ❌ **Não elegíveis:**
  - `frontend-specialist` — a matriz o exclui quando o design system é rígido, e aqui é: catálogo declarado em `ARCHITECTURE.md` §2.2 com Library-First inviolável. O agente tem opiniões fortes anti-shadcn que colidiriam com o contrato visual aprovado.
  - `database-architect` — a matriz o exclui em Supabase sem ORM, que é o caso. A expertise foi aplicada por outra porta: skill `supabase-postgres-best-practices` carregada antes do plano (achado registrado abaixo).
- 🟡 **Com ressalva:** `backend-specialist` — a matriz prevê Express/Hono/Fastify; aqui são route handlers do Next sobre Supabase. Usável com prompt rico, sem assumir camadas de framework que não existem.
- **Fallback:** `general-purpose` com Mapa de Impacto restrito, para qualquer bloco delegado.

---

## Blocos

### Bloco A — Schema: `cobrancas` e a derivação
Arquivos: `supabase/migrations/0016_cobrancas.sql`, `supabase/tests/0016_cobrancas.sql` · Testes: T4, T5–T9, T16, T33 · Depende: — · Paralelo: C · Est: 75min · Agente: inline · `[x]` concluído

### Bloco B — Schema: eixo de entrega e `vagas_ocupadas`
Arquivos: `supabase/migrations/0017_pedido_eixo_entrega.sql`, `supabase/tests/0014_pedidos_funcoes.sql`, `supabase/tests/0013_pedidos_rls.sql` · Testes: T3, T11, T12, T13 · Depende: A · Est: 90min · Agente: inline · `[ ]`
> **Bloco de maior risco da spec.** `vagas_ocupadas` é lida pela vitrine inteira. pgTAP verde antes de qualquer código de aplicação.

### Bloco C — Porta, adaptador e famílias de recusa
Arquivos: `packages/core/src/pagamento/recusa.ts`, `packages/core/src/index.ts`, `apps/web/src/lib/pagamentos/{porta,mercado-pago,fake}.ts`, `apps/web/src/lib/env.ts`, `.env.example` · Testes: T14, T20, T24, T25 · Depende: — · Paralelo: A · Est: 75min · Agente: inline · `[ ]`
> Aqui mora a correção da RN14 — o 404 que hoje sobe como exceção.

### Bloco D — Repositórios e serviços de cobrança
Arquivos: `features/pedidos/services/{cobrancas-repo,criar-cobranca,criar-pedido,confirmar-pagamento,pedidos-repo,dependencias}.ts`, `features/pedidos/{schema,index}.ts` · Testes: T1, T2, T10, T15, T17, T19, T21, T23, T26–T31, T34, T35 · Depende: A, B, C · Est: 90min · Agente: inline · `[ ]`

### Bloco E — Rotas de API
Arquivos: `app/api/pedidos/route.ts`, `app/api/pagamentos/route.ts`, `app/api/pedidos/[numero]/route.ts`, `app/api/webhook/mp/route.ts`, `app/api/manutencao/pedidos-parados/route.ts` · Testes: T17, T18, T27, T32, T36 · Depende: D · Est: 60min · Agente: inline · `[ ]`

### Bloco F — Componentes novos do catálogo
Arquivos: `packages/ui/src/components/contagem-regressiva.tsx`, `features/pedidos/components/brick-pagamento.tsx` · Testes: T22, T36 · Depende: E · Est: 60min · Agente: inline · `[ ]`
> Os dois `✨ CRIAR NOVO` de `design.md` §4.4.3. Vêm **antes** das telas que os consomem (regra 4.0.1).

### Bloco G — Telas + Gate Visual B
Arquivos: `app/(loja)/checkout/page.tsx`, `app/(loja)/pedido/[numero]/pagar/page.tsx`, `features/pedidos/components/{checkout-cliente,resumo-pedido,estado-pagamento}.tsx` · Testes: critérios visuais 1–9 · Depende: F · Est: 90min · Agente: inline · `[ ]`
> Ambiente real aberto **antes** de declarar verde (postmortem 2026-08-18). Aprovação explícita do PM.

### Bloco H — RN20: os seis caminhos no Mercado Pago real
Arquivos: nenhum de produto — evidência registrada em `tests.md` §F · Testes: T37 · Depende: G · Est: 60min · Agente: inline · `[ ]`
> **Depende de insumo do PM:** `MP_ACCESS_TOKEN` e `NEXT_PUBLIC_MP_PUBLIC_KEY` de teste + túnel `cloudflared` de pé. A URL do túnel grátis muda a cada execução e precisa ser espelhada em `DEV_TUNNEL_HOST`.

---

## Grafo de dependências

```
A ──┐
    ├──→ D ──→ E ──→ F ──→ G ──→ H
B ──┤              (UI)   (Gate Visual B)
C ──┘

A ∥ C   (Mapas disjuntos: banco × TypeScript puro)
B depende de A (mesma tabela)
```

## Checkpoints intermediários sugeridos

- **Após o Bloco B** — o banco inteiro reescrito, `vagas_ocupadas` incluída. É o ponto de não-retorno barato: se algo estiver errado no modelo, custa uma migration; depois do D, custa a aplicação toda.
- **Após o Bloco E** — backend fechado e testado. Antes de abrir a frente de UI.
- **O Bloco G é inerentemente interativo** (Gate Visual B exige aprovação explícita) e o **H depende de credencial sua** — os dois param sozinhos, independentemente do modo escolhido.

## Notas de execução

- Commits incrementais: `feat(NAPO-025): bloco [letra] — [resumo] (Tx, Ty verdes)`
- Encerrar dev server antes de `build` ou de instalar dependência (postmortem 2026-08-18, `AGENTS.md` §2 item 12)
- Nunca rodar `pnpm format` — é `prettier --write` no repositório inteiro e reformata contrato visual e docs de outras specs

## Decisões de execução

- **View `pedidos_com_pagamento` nasce com `security_invoker = on` e sem privilégio para `anon`/`authenticated`.** View comum no schema `public` é exposta pelo PostgREST e roda com direitos do criador — ignoraria a RLS de `pedidos`. Achado na auditoria de implementabilidade; registrado em `design.md` §2.2.
- **T15 do pgTAP (NAPO-006) deixou de depender de banco recém-resetado.** A asserção global falhava com dados de desenvolvimento; a função estava certa. Commit `a8ee141`, anterior ao Bloco A.
- **"Fornada" deixou de nomear o que o cliente reserva.** Revisão do PM sobre o contrato visual antes do primeiro commit de código; ver `spec.md` §7. Commit `d7bf264`.
- **Backfill do Bloco A verificado com dado real, não com fixture.** Os 3 pedidos de 04/09 preservados no pré-flight serviram de evidência: o pago virou cobrança `online`/`aprovada` com o mesmo `mp_payment_id` e deriva `pago`; os 2 pendentes derivam `sem_pagamento`, porque nunca houve tentativa. T4 é verificação de migração, não cenário permanente — depois da 0017 não existe mais coluna com que comparar.
- **`packages/db/src/types.generated.ts` regenerado nos blocos de schema.** É consequência mecânica da migration que o Mapa autoriza, não escopo novo.
- **⚠️ `pnpm db:types` é perigoso e foi contornado.** Chama `supabase` direto em vez do wrapper `scripts/supabase.mjs`, então falha por variável de ambiente ausente — e o `>` já truncou o arquivo antes disso. Recuperado com `git checkout`. Contornado gerando em arquivo temporário e copiando por cima. Correção proposta ao PM no checkpoint do Bloco B (fora do Mapa: `package.json`).
