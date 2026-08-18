# Plano de Implementação — NAPO-005 Endereços e frete por faixa de distância

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos=27, N_testes=27, sensitivo=SIM (PII de localização, RLS, chaves de API)
**Plano criado em:** 2026-08-18
**Modo de execução:** com checkpoints (aprovado pelo PM em 2026-08-18 — paradas após A, F e G)

---

## Stack (derivada de ARCHITECTURE.md)

`TypeScript strict · Next.js 15 App Router · Supabase (Postgres + Auth + RLS) · pnpm workspaces · Vitest + pgTAP · Tailwind v4 + shadcn em packages/ui · Zod · Vercel`

Regra de dependência ativa: `packages/core` é TS puro (sem React, sem Supabase, sem HTTP).

## Agentes elegíveis (após fitness)

- ✅ Elegíveis: `database-architect` (A), `security-auditor` (A, F), `backend-specialist` (D, E, F), `frontend-specialist` (G, H), `test-engineer` (todos)
- ❌ Não elegíveis: `mobile-developer` (web puro), `seo-specialist` (área logada, `noindex`), `devops-engineer` (sem pipeline novo)
- 🟡 Com ressalva: `frontend-specialist` tem opiniões fortes contra shadcn; aqui o catálogo shadcn de `packages/ui` é mandatado por `ARCHITECTURE.md` §2.2 e **vence** — o agente entra pela camada de composição e acessibilidade, não pela escolha de biblioteca.

**Paralelismo (AGENTS.md §2.9):** os pares A‖B e (nada mais) são disjuntos, mas a execução será **sequencial em agente único** — este ambiente não dispara subagentes sem pedido explícito do PM. O grafo abaixo registra a ordem real.

---

## Ajustes ao Mapa de Impacto

Itens declarados no `design.md` §4.4.3 / §6.1 mas ausentes da tabela §1 — completude, não escopo novo:

| Arquivo | Origem da autorização |
|---|---|
| `packages/core/src/frete/index.ts` · `packages/core/src/entrega/index.ts` | convenção de barrel por domínio (`catalogo/`, `disponibilidade/`, `otp/`) |
| `packages/core/src/entrega/descricao.test.ts` | §1 lista teste só para `frete/*`; RN17 exige cobertura determinística |
| `apps/web/src/features/enderecos/components/regua-distancia.tsx` | `design.md` §4.4.3 (`<ReguaDistancia>`) |
| `apps/web/package.json` | `design.md` §6.1 — `@googlemaps/js-api-loader` |
| testes `*.test.ts` dos route handlers | `tests.md` cabeçalho: Route Handlers → Vitest com fetch mockado |

---

## Blocos

### Bloco A — Schema, RLS e tipos
Arquivos: `supabase/migrations/0012_enderecos_frete.sql`, `supabase/tests/0012_enderecos_rls.sql`, `packages/db/src/types.generated.ts` · Testes: T16, T19 (pgTAP) + invariantes RN13/RN14/RN25 no banco · Depende: — · Est: 75min · Agente: database-architect + security-auditor · `[ ]`

### Bloco B — Core: frete, distância e área
Arquivos: `packages/core/src/frete/{frete,distancia,area,index}.ts` + `*.test.ts` · Testes: T6, T7, T23 (parte pura), T24 (parte pura), T25, T26 · Depende: — (disjunto de A) · Est: 60min · Agente: inline (Domain Engineer) · `[x]`

### Bloco C — Core: descrição de cobertura (RN17)
Arquivos: `packages/core/src/entrega/{descricao,index}.ts` + teste, `packages/core/src/index.ts` · Testes: T27 (parte pura) · Depende: B (compartilha o barrel) · Est: 30min · Agente: inline · `[ ]`

### Bloco D — Env + CEP com cache e fallback
Arquivos: `.env.example`, `apps/web/src/lib/env.ts`, `features/enderecos/services/cep.ts`, `app/api/cep/[cep]/route.ts` + testes · Testes: T1, T8 (servidor), T9, T21, T22 · Depende: A · Est: 60min · Agente: backend-specialist · `[ ]`

### Bloco E — Geocoding e rota rodoviária
Arquivos: `features/enderecos/services/geocoding.ts` + teste · Testes: T23, T18 (parte) · Depende: D · Est: 50min · Agente: backend-specialist · `[ ]`

### Bloco F — API de endereços e contrato de frete
Arquivos: `features/enderecos/services/enderecos.ts`, `features/enderecos/index.ts`, `app/api/enderecos/route.ts`, `app/api/enderecos/[id]/route.ts`, `app/api/enderecos/[id]/padrao/route.ts`, `app/api/frete/route.ts` + testes · Testes: T2, T3, T4, T12, T13, T14, T15, T17, T20 · Depende: A, B, C, E · Est: 90min · Agente: backend-specialist + security-auditor · `[ ]`

### Bloco G — UI: Dialog, régua, card e lista
Arquivos: `packages/ui/src/components/dialog.tsx`, `features/enderecos/components/{regua-distancia,card-endereco}.tsx`, `app/(conta)/conta/enderecos/page.tsx` · Testes: T5, T27 (tela) + critérios visuais 1, 2, 3, 6 · Depende: F · Est: 80min · Agente: frontend-specialist · `[ ]`

### Bloco H — UI: mapa e formulário
Arquivos: `features/enderecos/components/{mapa-pin,formulario-endereco}.tsx`, `app/(conta)/conta/enderecos/novo/page.tsx`, `app/(conta)/conta/enderecos/[id]/page.tsx`, `apps/web/package.json` · Testes: T8, T10, T11 + critérios visuais 4, 5, 6 · Depende: F, G · Est: 90min · Agente: frontend-specialist · `[ ]`

---

## Grafo de dependências

```
A ─┬─────────────► D ──► E ──┐
   │                          ├──► F ──► G ──► H
B ──► C ──────────────────────┘
```

Ordem de execução real (sequencial): **B · A** · C · D · E · F · G · H

B vem antes de A porque o seed da `0012` depende da coordenada da cozinha, que é fato do negócio pendente do PM. Os dois blocos são disjuntos — a troca não altera o grafo.

## Checkpoints intermediários sugeridos

- **Após Bloco A:** schema é o que outros sete blocos assumem; errar aqui custa migration corretiva.
- **Após Bloco F:** backend completo e testado — último ponto antes de a UI congelar contratos.
- **Após Bloco G:** primeira metade do Gate Visual B (lista) disponível para o PM.

Só bloqueiam se o modo aprovado for `com checkpoints`.

## Notas de execução

- Commits incrementais: `feat(NAPO-005): bloco [letra] — [resumo] (Tx, Ty verdes)`
- Gate por bloco: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (+ `pnpm db:test` nos blocos que tocam schema)
- Plano é o ponto de retomada — Status atualizado no mesmo commit do bloco

## Decisões de execução

<!-- 1 bullet por decisão, máx. 2 linhas: fato + motivo. Nunca reexplicada em commit ou chat. -->

- **Coordenada da cozinha entra em `config_operacao` (`lat_cozinha`/`lng_cozinha`)** — RN5 mede distância "da cozinha" e nem o design §2.1 nem a tabela previam a origem; vai onde já mora o raio, para mudar de endereço ser `UPDATE` e não deploy.
- **`is_equipe()` nasce na 0012** — a RLS de equipe do design §2.4 precisa dela e só existe `is_admin()`; mesmo padrão `SECURITY DEFINER` + `search_path` fixo da 0001, que evita recursão de RLS em `profiles`.
- **A última faixa de frete fecha à direita** — T26 pede intervalo `[de, ate)` e T25 pede 12,00 km atendido; sem a exceção a borda exata do raio ficaria sem preço.
- **Fora de área devolve `freteCentavos: null`, nunca 0** — inclusive quando não há faixa cobrindo a distância; frete zero silencioso é prejuízo que não aparece no painel.
- **Entre exceções de CEP vence o prefixo mais longo** — com `716` bloqueando e `71680` liberando, deixar a ordem decidir faria a regra geral engolir a exceção dela.
- **`export * from './frete'` entrou no barrel já no bloco B** (o mapa previa a modificação de `core/index.ts` no bloco C) — bloco tem de fechar consumível de fora, senão o gate valida código inalcançável.
- **Bloco B executado antes do A** — o seed da 0012 depende da coordenada da cozinha, fato do negócio pendente do PM; blocos disjuntos, grafo intacto.
