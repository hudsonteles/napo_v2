# Plano de Implementação — NAPO-006 Carrinho e checkout com Mercado Pago

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos=33, N_testes=41, sensitivo=SIM (pagamento, RLS, auditoria)
**Plano criado em:** 2026-08-19
**Modo de execução:** com checkpoints (aprovado pelo PM em 2026-08-19) — pausas após C, H e J
**Rastreamento:** `plan.md` é a única fonte de progresso (o harness desta sessão não tem TodoWrite)

---

## Stack (derivada de ARCHITECTURE.md)

`TypeScript strict · Next.js 15 App Router (monorepo pnpm, sem Turborepo) · Route Handlers (sem framework HTTP próprio) · Supabase/Postgres com SQL versionado e sem ORM · Vitest + pgTAP + Playwright · Tailwind v4 + shadcn em packages/ui (design system rígido) · Vercel`

---

## Agentes elegíveis (após fitness)

> ⚠️ No Claude Code os arquivos de `.agent/agents/` são **personas em texto**, não subagent types nativos (`AGENTS.md` §10). Delegação usa `general-purpose` com a persona carregada dentro do prompt.

- ✅ **Elegíveis:** `test-engineer` (sempre) · `security-auditor` (blocos sensitivos: B, C, E, H) · `project-planner` (só nesta etapa)
- ❌ **Não elegíveis:**
  - `backend-specialist` — não há framework HTTP tradicional; são Route Handlers do Next sobre BaaS. Fallback `general-purpose` com prompt rico.
  - `database-architect` — Supabase com SQL direto, sem ORM. Fallback `general-purpose`.
  - `devops-engineer` — hosting gerenciado, sem pipeline próprio nesta spec.
- 🟡 **Com ressalva:** `frontend-specialist` — a stack tem Next+Tailwind, mas o design system é **rígido** (shadcn obrigatório por `ARCHITECTURE.md` §2.2) e existe contrato visual aprovado em `preview.html`. A persona carrega opiniões anti-defaults que brigariam com os dois. **Decisão: não usar nos blocos I e J**; `general-purpose` com o §4.4 do design como mapa de tradução.

---

## Blocos

### Bloco A — Núcleo do carrinho (regras puras)
Arquivos: `packages/core/src/carrinho/{carrinho,dia,tipos,index}.ts`, `packages/core/src/index.ts` · Testes: T2, T13, T14, T19, T32 · Depende: — · Paralelo: B, E · Est: 45min · Agente: inline · `[x]`

### Bloco B — Schema e RLS
Arquivos: `supabase/migrations/0013_pedidos.sql` · Testes (pgTAP): T17, T22, T23, T24 · Depende: — · Paralelo: A, E · Est: 60min · Agente: inline (paralelismo declarado impossível — ver Decisões) · `[x]`

### Bloco C — Funções SQL ⚠️ ordem interna obrigatória
Arquivos: `supabase/migrations/0014_pedidos_funcoes.sql` · Testes (pgTAP): **T33, T34 primeiro**, depois T9, T10, T11, T15, T35 · Depende: B · Est: 75min · Agente: inline · `[x]`
> `vagas_ocupadas` é compartilhada com o motor do NAPO-004: T33/T34 verdes **antes** de qualquer outro código (`design.md` §8).

### Bloco D — Snapshot e rota de reserva
Arquivos: `apps/web/src/features/disponibilidade/services/snapshot.ts`, `apps/web/app/api/disponibilidade/reserva/route.ts` · Testes: T9, T33, T34 pelo caminho da aplicação · Depende: C · Est: 40min · Agente: inline · `[~]`

### Bloco E — Porta de pagamento
Arquivos: `apps/web/src/lib/pagamentos/{porta,fake,mercado-pago,assinatura}.ts`, `apps/web/src/lib/env.ts` · Testes: T25, T27, T30 · Depende: — · Paralelo: A, B · Est: 60min · Agente: `general-purpose` + persona `security-auditor` · `[ ]`

### Bloco F — Estado do carrinho no navegador
Arquivos: `apps/web/src/lib/carrinho/{provider.tsx,armazenamento.ts}` · Testes: T1, T40 · Depende: A · Paralelo: C, E · Est: 40min · Agente: inline · `[ ]`

### Bloco G — Criação de pedido
Arquivos: `apps/web/src/features/pedidos/{schema.ts,index.ts}`, `.../services/{pedidos-repo,criar-pedido}.ts`, `apps/web/app/api/pedidos/route.ts`, `apps/web/app/api/carrinho/validar/route.ts` · Testes: T3, T5, T12, T13, T14, T18, T19, T20, T21, T36, T37 · Depende: A, C, E · Est: 90min · Agente: `general-purpose` · `[ ]`

### Bloco H — Webhook, confirmação e ciclo de vida
Arquivos: `.../services/confirmar-pagamento.ts`, `apps/web/app/api/webhook/mp/route.ts`, `apps/web/app/api/pedidos/[numero]/route.ts`, `.../[numero]/cancelar/route.ts`, `apps/web/app/api/manutencao/pedidos-parados/route.ts` · Testes: T6, T7, T8, T16, T26, T27, T28, T29, T30, T35, T38, T39 · Depende: C, E, G · Est: 90min · Agente: `general-purpose` + persona `security-auditor` · `[ ]`

### Bloco I — UI do carrinho e cabeçalho
Arquivos: `packages/ui/src/patterns/{acesso-carrinho.tsx,cabecalho-site.tsx}`, `apps/web/src/features/catalogo/components/estado-disponibilidade.tsx`, `apps/web/app/(loja)/layout.tsx`, `apps/web/app/(loja)/carrinho/page.tsx`, `apps/web/src/features/pedidos/components/lista-carrinho.tsx` · Testes: T41 + critérios visuais 2,3,6,7 · Depende: F · Est: 75min · Agente: `general-purpose` (mapa de tradução: `design.md` §4.4) · `[ ]`

### Bloco J — UI do checkout e do pedido
Arquivos: `apps/web/app/(loja)/checkout/page.tsx`, `apps/web/app/(loja)/pedido/[numero]/page.tsx`, `.../components/{resumo-pedido,seletor-endereco,estado-pagamento}.tsx`, `apps/web/middleware.ts` · Testes: T31 + critérios visuais 1,4,5,8,9,10 · Depende: G, H, I · Est: 90min · Agente: `general-purpose` (mapa de tradução: `design.md` §4.4) · `[ ]`

---

## Grafo de dependências

```
A, B, E → paralelos (sem deps)
B → C
C → D
A → F
A, C, E → G
C, E, G → H
F → I
G, H, I → J
```

Janelas de paralelismo reais: **(A ‖ B ‖ E)** no início e **(D ‖ F)** depois de C.

---

## Checkpoints intermediários sugeridos

- **Após Bloco C** — é o único ponto do plano que pode quebrar o site inteiro (a vitrine lê `vagas_ocupadas`). Gate + commit + confirmação antes de seguir.
- **Após Bloco H** — o miolo de dinheiro fica pronto aqui; é o momento natural de exercitar o fluxo real com túnel antes de investir nas telas.
- **Após Bloco J** — Gate Visual B com as três telas no ar.

Só se tornam bloqueantes se o modo aprovado for `com checkpoints`.

---

## Notas de execução

- Commits: `feat(NAPO-006): bloco [letra] — [resumo] (Tx, Ty verdes)`. Bloco A leva junto este `plan.md`.
- Gate por bloco: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, **com o dev server derrubado** (`AGENTS.md` §2 item 12).
- Blocos B, C e D exigem Supabase local no ar (`pnpm db:start`) e rodam `pnpm db:test` (pgTAP).
- Blocos I e J passam obrigatoriamente pela Etapa 4.0 (mockup-driven scaffolding) usando `design.md` §4.4 como mapa de tradução.
- `PAGAMENTO_PROVIDER=fake` cobre A–J; o fluxo real com túnel é pré-requisito do Gate de Saída, não de bloco.

## Decisões de execução

- **Bloco A — `montarTotais` devolve `totalCentavos: null` quando o frete é `null`.** Total sem frete conhecido não é total; somar zero calado é o mesmo erro de frete grátis silencioso que a RN18 proíbe.
- **Bloco A — quantidade fracionária cai junto com zero e negativa em `normalizarItens`.** `1.5` pediria à reserva uma vaga que o forno não sabe produzir.
- **Bloco A — `conferirPrecos` trata queda de preço como divergência.** O pedido precisa registrar que o valor mudou entre a vitrine e a cobrança, para cima ou para baixo.
- **Paralelismo declarado impossível nesta execução** (`AGENTS.md` §2 item 9). As instruções de sessão proíbem disparar subagentes sem pedido explícito do PM; A‖B‖E e D‖F rodam sequencialmente, inline. Custo: tempo de relógio.
- **Bloco B — `INSERT`/`UPDATE` de `pedidos` revogados de `authenticated`, não regulados por política.** A RN17 fala em "cliente cria os próprios pedidos"; uma política `with check (profile_id = auth.uid())` daria isolamento correto e cobrança errada — o cliente escolheria o próprio `total_centavos`. Pedido nasce e muda por servidor.
- **Bloco B — `pagamento_eventos` ganhou política `using (false)` explícita.** O invariante do NAPO-001 exige política em toda tabela; ausência é indistinguível de esquecimento, e um `grant` futuro encontraria a tabela aberta.
- **Bloco C — `aguardando_pagamento` NÃO conta em `vagas_ocupadas`.** A vaga dele já está contada pela reserva que o sustenta (RN7); contar os dois cobraria a mesma vaga duas vezes do estoque e faria a fornada parecer cheia com metade vendida.
- **Bloco C — `entregue` continua ocupando vaga; `estornado` devolve.** A pizza entregue saiu daquela fornada e não volta; o estorno é o único estado terminal que libera.
- **Bloco C — `reservar_carrinho` recebe `p_minutos` em vez de ler `config_operacao`.** Mantém a função sem regra de negócio, no mesmo contrato do `p_limite` do 0005: quem decide o prazo é o servidor.
- **Bloco B — `pedidos_total_confere` e `pedidos_pago_tem_pagamento` como `CHECK`.** Total divergente e pedido pago sem prova de pagamento passam a ser impossíveis, não improváveis — mesmo critério da RN2 do NAPO-003.
