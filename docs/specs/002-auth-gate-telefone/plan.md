# Plano de Implementação — NAPO-002 Autenticação, papéis e gate de telefone

**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Tests:** [`tests.md`](./tests.md) · **Preview:** [`preview.html`](./preview.html)
**Tamanho detectado:** GRANDE
**Critério:** N_arquivos=46, N_testes=46, sensitivo=SIM (auth · RBAC · LGPD/PII)
**Plano criado em:** 2026-08-11
**Modo de execução:** com checkpoints (aprovado por Hudson em 2026-08-11 — paradas após B e após D)

---

## Stack (derivada de ARCHITECTURE.md)

`TypeScript strict · Next.js 15 App Router · Supabase (Postgres + Auth, sem ORM) · pnpm workspaces · Vitest + pgTAP · Tailwind v4 + shadcn/ui (catálogo em packages/ui) · Vercel`

Pontos que condicionam a execução:
- `packages/core` é TypeScript puro — não importa React, Supabase nem faz HTTP.
- Toda alteração de banco é migration versionada; RLS deny-by-default é verificada mecanicamente pelo teste do NAPO-001.
- O catálogo de UI está **vazio** (só `tokens.css`) — esta spec o inaugura.

## Agentes elegíveis (após fitness)

- ✅ **Elegíveis:** `test-engineer` (Vitest/pgTAP), `security-auditor` (spec inteira é sensitiva), `project-planner` (esta etapa).
- ❌ **Não elegíveis:** `database-architect` (fitness pressupõe SQL+ORM; aqui é Supabase/SQL direto) · `backend-specialist` (fitness pressupõe framework HTTP tradicional; aqui são Route Handlers do Next) · `seo-specialist`, `devops-engineer`, `mobile-developer` (sem bloco correspondente).
- 🟡 **Com ressalva:** `frontend-specialist` — a fitness matrix o marca como não elegível quando o design system é rígido, e aqui shadcn/ui é mandatado pela arquitetura §2.2. As opiniões anti-default do agente conflitariam com o contrato visual já aprovado no Gate Visual A.

**Delegação: nenhuma.** Todos os blocos rodam inline no agente principal — o PM não solicitou subagentes, e a regra `AGENTS.md` §2.9 exige que paralelismo previsto seja declarado como executável ou impossível em vez de silenciosamente não acontecer. Os blocos A, B e C **são** disjuntos e paralelizáveis em tese; na prática serão executados em sequência.

---

## Blocos

### Bloco A — Núcleo puro (telefone + código)
Arquivos: `packages/core/src/telefone/{e164,index}.ts`, `packages/core/src/otp/{codigo,index}.ts`, `packages/core/src/index.ts` · Testes: T9-T14 · Depende: — · Paralelo (em tese): B, C · Est: 45min · Inline · `[x]`

### Bloco B — Banco (schema, RLS, funções de admin)
Arquivos: `supabase/migrations/0006_auditoria.sql`, `0007_telefone.sql`, `0008_consentimentos.sql`, `0009_admin_functions.sql`, `supabase/tests/{0005,0006}_*.sql`, `supabase/seed.sql`, `supabase/config.toml`, `packages/db/src/types.generated.ts` · Testes: T26, T27, T29, T32-T35, T44 · Depende: — · Paralelo (em tese): A, C · Est: 75min · Inline · `[x]`

### Bloco C — Base de UI (Tailwind + catálogo)
Arquivos: `apps/web/{postcss.config.mjs,app/globals.css,app/layout.tsx,package.json}`, `packages/ui/src/{tokens.css,lib/cn.ts,components/*,patterns/auth-card.tsx}`, `packages/ui/package.json` · Testes: T39-T41 + os 7 critérios visuais · Depende: — · Paralelo (em tese): A, B · Est: 75min · Inline · `[x]`

### Bloco D — Fluxo de login
Arquivos: `apps/web/middleware.ts`, `src/lib/supabase/{admin,middleware}.ts`, `src/lib/{env,ip}.ts`, `src/features/auth/{services/sessao.ts,destino.ts,index.ts,components/*}`, `app/api/auth/{callback,sair}/route.ts`, `app/(conta)/{entrar/page.tsx,conta/{layout,page}.tsx}`, `app/(admin)/admin/{layout,page}.tsx` · Testes: T1, T2, T4-T8, T21-T23, T25, T28, T31, T38 · Depende: B, C · Est: 90min · Inline · `[x]`

### Bloco E — Gate de telefone
Arquivos: `apps/web/src/lib/otp/{remetente,remetente-fake,remetente-meta}.ts`, `src/features/auth/services/{verificacao,consentimento}.ts`, `app/api/otp/{enviar,validar}/route.ts`, `app/(conta)/validar-telefone/page.tsx`, componentes do formulário · Testes: T3, T15-T20, T24, T30, T36, T37, T42, T43, T45, T46 · Depende: A, B, D · Est: 90min · Inline · `[x]`

### Bloco F — Ferramentas de admin
Arquivos: `scripts/admin.mjs`, `.env.example` · Exercita pela linha de comando as funções já provadas em T32-T35 · Depende: B · Est: 30min · Inline · `[x]`

---

## Grafo de dependências

```
A ─┐
B ─┼──→ D ──→ E
C ─┘         ↑
A ───────────┘
B ──→ F
```

Total estimado: ~6h de execução.

## Checkpoints intermediários sugeridos

- **Após Bloco B:** o schema é a parte de reversão mais cara da spec (índice único de telefone, funções `SECURITY DEFINER`). Vale confirmar antes de construir em cima.
- **Após Bloco D:** login funcionando de ponta a ponta é o primeiro momento em que o PM consegue *usar* a spec — bom ponto para olhar antes do gate de telefone.

Só se tornam bloqueantes se o PM escolher `Modo de execução: com checkpoints`.

## Notas de execução

- Commits incrementais: `feat(NAPO-002): bloco [letra] — [resumo] (Tx, Ty verdes)`.
- Bloco C e as telas dos blocos D e E disparam o protocolo 4.0 (mockup-driven scaffolding) — `design.md` §4.4 é o mapa de tradução.
- Gate Visual B acontece no fim (Etapa 7), com dev server no ar e aprovação explícita do PM.

## Decisões de execução

- **Bloco A — dois casos do T9/T10 corrigidos no teste, não na implementação:** `0061991504477` não é número brasileiro em convenção alguma (trocado por `005561991504477`), e `+1 415 555 2671` colide com o formato nacional (DDD 14 sem nono dígito), então a recusa correta é `nao_celular`.
- **T27 não é reimplementado:** "ninguém altera a própria role" já é provado por `0002_profiles_rls_test.sql` (T11 do NAPO-001) contra o mesmo trigger. Duplicar a asserção não aumenta cobertura.
- **Google desabilitado no `config.toml` local:** o CLI aborta `db reset` inteiro se `env(...)` não existir, e o provedor não funciona local de qualquer forma (arch §6.1). Em staging/prod é configurado no painel do Supabase. Instruções de como ligar local ficam no próprio arquivo.
- **`auditoria` sem `updated_at`,** contra a convenção da arch §4.2: linha de auditoria que pode ser atualizada não é auditoria. Sem grant de escrita para ninguém — nem admin.
- **T1-T8 e T39-T41 sem Playwright:** os fluxos viram testes de integração de servidor (Vitest + Supabase local) e os critérios de teclado/mobile/contraste viram auditoria do Gate Visual B. Playwright entra no NAPO-006, onde `ARCHITECTURE.md` §2.3 o previu; instalá-lo aqui cobriria só metade do fluxo, já que o Google OAuth não roda local.
- **Bloco C — três arquivos fora do Mapa de Impacto:** `apps/web/next.config.ts` (`@napo/ui` em `transpilePackages`), `apps/web/vitest.config.ts` (PostCSS vazio) e `packages/ui/tsconfig.json`. Sem eles o catálogo TSX não transpila, o Vitest quebra ao ler o `postcss.config.mjs` do Next e o pacote não tem typecheck.
- **Bloco C — alvo de toque de 44px acrescentado ao preview:** botões ganham `min-h-11`/`min-h-12` (o preview dava ~40px no `ghost` e nos links). T40 exige 44x44 e o ganho de 4px não altera o contrato visual.
- **Bloco C — catálogo enxuto de propósito:** `<Button>` sai com as 4 variantes que as telas usam (`default`, `outline`, `ghost`, `link`); `destructive` e `secondary` do shadcn ficam de fora até existir tela que as peça (design §8).
- **Bloco D — testes de fluxo com o client Supabase mockado, não com Supabase local:** `pnpm test` roda no job `quality` do CI, que não sobe Docker. Banco segue coberto por pgTAP no job `database`.
- **Bloco D — atendente e cozinha caem em `/admin`:** a "fila de produção" da RN5 é o KDS do NAPO-012 e ainda não existe; o painel é a única tela de equipe. Troca de uma linha em `DESTINO_POR_PAPEL` quando o KDS nascer.
- **Bloco D — `src/lib/ip.ts` adiado para o bloco E:** só a emissão de código consome o IP (RN7, RN15); criá-lo agora seria arquivo sem chamador.
- **Bloco D — client `service_role` centralizado em `src/lib/supabase/admin.ts`:** `features/disponibilidade` tinha uma cópia própria e passou a importar de lá (DRY, arquitetura §4.1).
- **Bloco D — `@supabase/ssr` 0.5.2 → 0.7:** os genéricos do 0.5.2 não casam com o `supabase-js` 2.112 já instalado e faziam `.from('profiles')` inferir `never`. Só o `.rpc()` do NAPO-004 escapava do problema.
- **Bloco D — `NEXT_PUBLIC_SITE_URL` obrigatória (design §6.2)** exigiu tocar `.github/workflows/ci.yml`, `.env.example` e `.env.local`, fora do Mapa: sem a variável o boot falha e o CI ficaria vermelho.
- **Bloco E — `services/verificacao-repo.ts` criado fora do Mapa:** isola o I/O com `service_role` da orquestração, para que teto, expiração e tentativa sejam testáveis sem simular o PostgREST inteiro.
- **Bloco E — consentimento gravado ANTES da conclusão, em vez de transação única:** o PostgREST não expõe transação de múltiplos comandos. A ordem preserva a invariante que importa — nunca existir cadastro concluído sem consentimento (RN15).
- **Bloco E — recusa por unicidade grava o desafio e não envia (RN11):** assim a tentativa conta no teto e a resposta fica indistinguível do sucesso. Invalidar a linha tiraria a tentativa do teto e abriria enumeração ilimitada.
- **Bloco E — T37 × T46 conciliados:** o serviço nunca loga o código; quem loga é o `RemetenteFake`, que é o que T46 exige e só entra com `WHATSAPP_PROVIDER=fake` (produção exige `meta`).
- **Bloco E — `test/server-only-stub.ts` + alias no `vitest.config.ts`:** o pacote `server-only` lança fora do bundler do Next. A proteção real segue no build, que resolve a condição `react-server`.
- **Bloco F — script sem SDK, por `fetch` nativo contra o PostgREST:** instalar `supabase-js` na raiz do monorepo para duas chamadas HTTP não se paga. Formato E.164 é conferido localmente só para evitar viagem de rede; a regra completa segue no núcleo e no banco.
- **Bloco F — duas asserções pgTAP passaram a contar `auditoria` por `registro_id`:** a tabela é acumulativa e contagem global ficava vermelha depois de qualquer uso real do banco local. Descoberto ao exercitar o script contra o Supabase local — o CI, que parte limpo, nunca teria mostrado.
- **Gate Visual B — identidade visual real substituiu a marca improvisada do preview:** o PM forneceu logotipo, ícone e favicons em `docs/images/`. Detalhes e impacto em [`drift.md`](./drift.md) D1; a regra permanente virou `ARCHITECTURE.md` §2.2.2.
