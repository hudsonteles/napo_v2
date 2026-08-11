# Plano de Implementação — NAPO-004 Motor de disponibilidade

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos=18, N_testes=23, sensitivo=SIM (RLS em tabelas novas)
**Plano criado em:** 2026-08-10
**Modo de execução:** com checkpoints (aprovado pelo PM em 2026-08-10) — parada após Bloco C

---

## Stack (derivada de `ARCHITECTURE.md`)

`TypeScript strict · Next.js 15 App Router · Supabase (Postgres/Auth) · pnpm workspaces · Vitest + pgTAP · GitHub Actions`

Toolchain verificada: Node 22.18.0 · pnpm 11.3.0 · Supabase CLI 1.226.4 (Postgres 15) · Docker 29.6.1 com o stack local de pé.

---

## Agentes elegíveis (após fitness)

- ✅ **Elegíveis:** `test-engineer` (sempre), `security-auditor` (blocos A e C — RLS), `project-planner` (esta etapa)
- ❌ **Não elegíveis:** `database-architect` (SQL direto no Supabase, sem ORM), `backend-specialist` (Route Handlers em BaaS, sem framework HTTP), `frontend-specialist` (spec sem UI), `seo-specialist` (sem superfície pública aqui)
- 🟡 **Ressalva:** conhecimento dos elegíveis aplicado **inline**. Subagentes não são disparados — instrução permanente do PM (`não usar AgentTool sem pedido explícito`), que sobrepõe a recomendação de subagentes para specs GRANDES.

---

## Blocos

### Bloco A — Calendário e configuração
Arquivos: `supabase/migrations/0003_operacao_calendario.sql`, `supabase/seed.sql`, `supabase/tests/0003_calendario_rls_test.sql` · Testes: T16 · Depende: — · Paralelo: B · Est: 50min · **Docker: obrigatório** · `[x]`

### Bloco B — Núcleo puro
Arquivos: `packages/core/src/disponibilidade/{tipos,cutoff,janela,capacidade,index}.ts` + 3 arquivos de teste, `packages/core/src/index.ts` · Testes: T1–T14 · Depende: — · Paralelo: A · Est: 90min · **Docker: não precisa** · `[ ]`

### Bloco C — Capacidade e reserva no banco
Arquivos: `supabase/migrations/0004_capacidade.sql`, `supabase/migrations/0005_reservar_capacidade.sql`, `supabase/tests/0004_reserva_concorrencia_test.sql` · Testes: T15, T18, T19 · Depende: A · Est: 70min · **Docker: obrigatório** · `[ ]`

### Bloco D — API e snapshot
Arquivos: `apps/web/src/features/disponibilidade/services/snapshot.ts`, `apps/web/src/features/disponibilidade/index.ts`, `apps/web/app/api/disponibilidade/route.ts`, `apps/web/app/api/disponibilidade/reserva/route.ts` · Testes: T17, T20, T23 · Depende: B, C · Est: 60min · **Docker: obrigatório** · `[ ]`

### Bloco E — Verificação integrada
Arquivos: `packages/db/src/types.generated.ts` (regenerado) · Testes: T21, T22 · Depende: D · Est: 40min · **Docker: obrigatório** · `[ ]`

---

## Grafo de dependências

```
A ─┬─→ C ─┐
   │      ├─→ D → E
B ─┴──────┘
```

A e B são disjuntos (SQL vs TypeScript puro) e independentes — B não precisa de Docker.

---

## Checkpoints intermediários sugeridos

- **Após Bloco C:** a reserva atômica é o ponto de maior risco do spec (advisory lock + concorrência). Vale conferir antes de construir a API em cima.
- **Após Bloco E:** gate final, antes da Etapa 7.

---

## Notas de execução

- Commits incrementais: `feat(NAPO-004): bloco [letra] — [resumo] (Tx, Ty verdes)`
- `plan.md` é o ponto de retomada — Status atualizado após cada bloco
- Bloco A carrega também o `plan.md` no mesmo commit

---

## Decisões de execução

- **`config_operacao` legível só por admin, não por anon.** O design previa leitura anon para "config e calendário"; os tetos revelam capacidade instalada e o cálculo roda no servidor — só o calendário precisa ser público.
- **Colunas de frete (`raio_km`, `frete_gratis_valor`) ficaram fora de `config_operacao`.** Pertencem a NAPO-005; criá-las agora seria antecipar trabalho de outro spec.
- **`id uuid` + `unique(dia_semana)` em vez de PK natural** nas tabelas de calendário, para manter o padrão de `ARCHITECTURE.md` §4.2.
