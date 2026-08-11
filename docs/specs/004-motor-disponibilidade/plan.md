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
Arquivos: `packages/core/src/disponibilidade/{tipos,cutoff,janela,capacidade,index}.ts` + 3 arquivos de teste, `packages/core/src/index.ts` · Testes: T1–T14 · Depende: — · Paralelo: A · Est: 90min · **Docker: não precisa** · `[x]`

### Bloco C — Capacidade e reserva no banco
Arquivos: `supabase/migrations/0004_capacidade.sql`, `supabase/migrations/0005_reservar_capacidade.sql`, `supabase/tests/0004_reserva_concorrencia_test.sql` · Testes: T15, T18, T19 · Depende: A · Est: 70min · **Docker: obrigatório** · `[x]`

### Bloco D — API e snapshot
Arquivos: `apps/web/src/features/disponibilidade/services/{snapshot,produtos}.ts`, `apps/web/src/features/disponibilidade/index.ts`, `apps/web/app/api/disponibilidade/route.ts`, `apps/web/app/api/disponibilidade/reserva/route.ts` + teste, `apps/web/vitest.config.ts`, `packages/core/src/disponibilidade/conflito.ts` + teste · Testes: T17, T20, T21, T23 · Depende: B, C · Est: 60min · **Docker: obrigatório** · `[x]`

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
- **`tempo.ts` passou de "Reutilizar" para "Modificar" no Mapa.** Ganhou `instanteEmBrasilia`, `diaDaSemanaEmBrasilia` e `somarDias`: implementá-las em `cutoff.ts` duplicaria lógica de fuso e violaria a RN5, que exige helper único.
- **Buffer remove o dia só na faixa que antecede o cutoff, não depois dele.** Passado o cutoff o dia volta em ATP — vender lote pronto não depende de prazo de fermentação (RN4 + RN6 lidas juntas).
- **T10 passou de 5 para 6 dias de produção no `tests.md`.** Com 5 dias os dois tetos empatam em 150 e o cenário não distinguiria qual venceu; com 6 o forno daria 180 e o teste prova que o freezer manda.
- **Cutoff sem dia de produção em 14 dias fica no passado, e o dia sai da vitrine.** Falhar fechando a venda é o modo seguro; o oposto prometeria produção inexistente.
- **`lotes.produto_id` e `reservas.produto_id` ficaram sem FK.** A tabela `produtos` nasce em NAPO-003 e `pedidos` em NAPO-006; a FK entra junto com elas, comentada nas migrations.
- **T18 não prova a corrida real — pgTAP roda em sessão única.** O teste prova a recusa por contagem e verifica, via `pg_get_functiondef`, que o advisory lock está declarado; a serialização em si fica garantida pelo lock.
- **Drift resolvido no bloco D:** RN12/RN13 viraram funções puras (`avaliarViabilidade`, `devolucaoPorCancelamento`) porque `pedidos` é de NAPO-006. Ver `drift.md` — PM escolheu o caminho (a).
- **Vitest adicionado ao `apps/web`** (design §6.1, aprovado pelo PM). Sem runner no app, nenhuma rota do R1 — inclusive o webhook do Mercado Pago — teria teste automatizado.
- **Produtos vêm por query string (`?produtos=&massas=`) enquanto `produtos` não existe.** NAPO-003 substitui isso pela leitura do catálogo, que passa a ser a fonte da flag de massa.
- **Editar código com regex no PowerShell corrompeu um arquivo de teste** e exigiu reescrita. Ferramentas de edição estruturada (Write/Edit) para código daqui em diante.
- **Teste de mutação aplicado à RN7** (`min` → `max` nos dois tetos): 4 cenários quebraram, confirmando que a suíte prende a regra em vez de acompanhá-la.
