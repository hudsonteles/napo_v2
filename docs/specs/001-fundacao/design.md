# 🏗️ Design: Fundação — monorepo, Next.js 15, Supabase local e CI

**Spec relacionado:** [`spec.md`](./spec.md)
**Testes relacionados:** [`tests.md`](./tests.md)
**Status:** Aprovado · 2026-08-10

> 📌 Este documento define o **COMO** — focado em **DECISÕES**, não em restatement.
> Dono primário: **Agente / Tech Lead**. Respeita rigorosamente `ARCHITECTURE.md`.

---

## 1. Mapa de Impacto

*Fonte única do escopo. Arquivos fora desta tabela não devem ser modificados sem aprovação explícita.*

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `pnpm-workspace.yaml`, `package.json`, `.nvmrc` | Criar | Médio | Define os workspaces e **fixa Node e pnpm** (RN10) |
| `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc` | Criar | Médio | Config compartilhada; o ESLint carrega a regra de fronteira que protege `packages/core` (RN7) |
| `.gitignore`, `.env.example` | Criar | Baixo | `.env*` fora do Git; `.env.example` é o contrato de variáveis |
| `apps/web/` — `package.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx` | Criar | Baixo | App Next.js 15 mínimo + a tela crua de verificação |
| `apps/web/src/lib/env.ts` | Criar | **Alto** | Validação Zod das variáveis no boot (RN5). Ponto único de leitura de `process.env` |
| `apps/web/src/lib/supabase/{server,client}.ts` | Criar | **Alto** | Factories de client. Separação física é o que garante que `service_role` não vaze para o browser (RN3) |
| `packages/core/` — `package.json`, `src/index.ts` | Criar | Baixo | Núcleo puro; `package.json` sem nenhuma dependência é parte da garantia da RN7 |
| `packages/core/src/tempo.ts` | Criar | **Alto** | Helper único de fuso `America/Sao_Paulo` (RN6). Erro aqui contamina cutoff e dia de entrega em todo o R1 |
| `packages/db/` — `package.json`, `src/types.generated.ts`, `src/index.ts` | Criar | Médio | Tipos gerados do banco; arquivo gerado, nunca editado à mão (RN9) |
| `packages/ui/` — `package.json`, `src/tokens.css` | Criar | Baixo | Só os tokens (preto/branco/amarelo). Componentes nascem no NAPO-003 |
| `supabase/config.toml` | Criar | Médio | Configuração do stack local em Docker |
| `supabase/migrations/0001_base.sql` | Criar | **Alto** | Extensões, `is_admin()` e o padrão de RLS deny-by-default |
| `supabase/migrations/0002_profiles.sql` | Criar | **Alto** | Enum de role, `profiles`, políticas e o trigger anti-auto-promoção (RN2) |
| `supabase/seed.sql` | Criar | Médio | Usuários determinísticos por role — pré-requisito dos testes de RLS |
| `supabase/tests/*.sql` | Criar | **Alto** | pgTAP: `rls_enabled` + isolamento + trigger (RN1, RN2) |
| `scripts/confirm-prod-deploy.sh` | Criar | Baixo | Salvaguarda escrita agora, usada quando prod existir |
| `.github/workflows/ci.yml` | Criar | **Alto** | O gate que sustenta RN1, RN7, RN8, RN9 e RN10 |

> **Nota sobre tamanho (18 linhas > 15):** o template sugere avaliar quebra em duas specs. **Não quebrar.** As linhas estão agrupadas por módulo e nenhuma entrega valor isolada — um monorepo pela metade não roda, não testa e não prova nada. O risco real de tamanho é mitigado pelo plano de blocos (§7), que dá pontos de parada verificáveis.

---

## 2. Decisões de Schema

### 2.1 Mudanças

- **Enum `user_role`** (`cliente | atendente | cozinha | gerente | admin`): enum nativo em vez de texto livre — o banco recusa valor inválido sem precisar de check constraint nem de validação na aplicação.
- **Tabela `profiles`:** espelha `auth.users` com `id` como PK e FK `ON DELETE CASCADE`. Guarda `nome`, `email`, `role` e os campos de telefone que o NAPO-002 vai usar. Os campos de telefone nascem aqui **nulos e sem lógica** — criá-los depois exigiria migration em tabela já povoada.
- **Função `public.is_admin()`** — `SECURITY DEFINER`, `STABLE`, `search_path` fixado. Responde se o usuário corrente é admin.
- **Trigger `impedir_auto_promocao`** — `BEFORE UPDATE ON profiles`, rejeita mudança de `role` que não venha de admin ou de `service_role`.

### 2.2 Alternativas de modelagem descartadas

- **A — `role` em `auth.users.raw_app_meta_data`:** poria a role dentro do JWT, evitando um JOIN. **Descartada porque** revogar privilégio exigiria esperar o token expirar ou forçar refresh — um gerente demitido continuaria gerente até lá. Além disso, metadata do Auth não é auditável por trigger SQL, e a spec do R1 §8 exige auditoria de `role`.
- **B — tabela `user_roles` N:N (múltiplos papéis por pessoa):** mais flexível. **Descartada porque** a operação tem cinco pessoas e papéis mutuamente exclusivos; N:N traria ambiguidade de precedência ("quem é cozinha *e* gerente pode o quê?") sem nenhum caso de uso real.

### 2.3 Decisão crítica — recursão de RLS

Uma política que pergunta "o usuário é admin?" consultando `profiles` **dispara a RLS de `profiles` de novo** → recursão infinita, e o Postgres derruba a query. É a armadilha mais comum de RLS.

**Solução:** `is_admin()` é `SECURITY DEFINER`, executando com os privilégios do dono e **ignorando RLS**. Obrigatório fixar `search_path = public, pg_temp` — sem isso, `SECURITY DEFINER` vira vetor de escalada de privilégio.

### 2.4 Migration

- **Estratégia:** idempotente e aditiva. Nada destrutivo — o banco nasce aqui, não há dado a preservar.
- **Numeração:** prefixo sequencial (`0001_`, `0002_`) por legibilidade em um projeto de banco único.
- **Rollback:** `supabase db reset` recria do zero em ambiente local. Não há rollback a documentar enquanto não existir produção.

---

## 3. Decisões de Contrato

Este spec **não cria endpoint de API**. A única rota é `/`, uma Server Component que lê a hora do banco para provar a conexão.

**Decisão:** a verificação de saúde é uma página, não um `/api/health`. **Motivo:** um endpoint JSON provaria que o servidor responde; a página prova a cadeia inteira — Next.js renderiza, `env.ts` validou, o client Supabase conectou e o Postgres respondeu.

---

## 4. Decisões de UI

**Gate Visual A dispensado por decisão explícita do PM (2026-08-10).**

O Mapa de Impacto cria `apps/web/app/page.tsx`, o que normalmente dispara a FASE 3.5. Dispensado porque a tela **não tem contrato visual a firmar**: é texto cru, sem tokens, sem componentes, sem layout, e será substituída integralmente pelo NAPO-003. Um preview aprovado aqui viraria contrato de algo projetado para ser jogado fora.

§4.1 a §4.7 omitidas pelo mesmo motivo. **O catálogo de UI e o primeiro Gate Visual nascem no NAPO-003.**

Único requisito visual: a página deve deixar evidente, sem ambiguidade, se a conexão com o banco funcionou ou falhou.

---

## 5. Decisões Técnicas Gerais

- **Decisão:** pgTAP (`supabase test db`) para RLS; Vitest para `packages/core`.
  **Alternativa rejeitada:** Vitest para tudo, via cliente JS com dois usuários.
  **Motivo:** o teste via cliente JS prova que *aquele caminho* está protegido; `tests.rls_enabled('public')` prova que **nenhuma tabela do schema** ficou sem política — inclusive as que ainda não existem, criadas nas specs seguintes. É a diferença entre testar o que lembramos e testar o que esquecemos.

- **Decisão:** ponto único de leitura de `process.env`, em `apps/web/src/lib/env.ts`, validado com Zod no boot.
  **Alternativa rejeitada:** `process.env.X` espalhado com `!` de non-null assertion.
  **Motivo:** o `!` transforma variável faltando em `undefined` que viaja silenciosamente até virar erro incompreensível três camadas adiante.

- **Decisão:** fronteira de `packages/core` garantida por regra de lint (`no-restricted-imports`), não por combinado.
  **Alternativa rejeitada:** confiar na revisão de código.
  **Motivo:** a pureza de `core` é a decisão arquitetural central do projeto (spec do R1 §3). Convenção que depende de alguém lembrar tem meia-vida de poucas semanas.

- **Decisão:** `tempo.ts` expõe funções de negócio (`hojeEmBrasilia()`, `inicioDoDia()`), não um wrapper genérico de data.
  **Alternativa rejeitada:** exportar um objeto de biblioteca já configurado com o fuso.
  **Motivo:** wrapper genérico permite que alguém chame o método cru e perca o fuso. API estreita torna o caminho errado indisponível.

- **Decisão:** sem Turborepo.
  **Motivo:** herdado da spec do R1 §3 — quatro workspaces não justificam cache de build. Gatilho de revisão: quando o CI passar de 5 minutos.

---

## 6. Dependências Novas

### 6.1 Bibliotecas

| Lib | Onde | Por quê |
|---|---|---|
| `next@15`, `react@19` | `apps/web` | Stack definida na arquitetura |
| `@supabase/supabase-js`, `@supabase/ssr` | `apps/web`, `packages/db` | `@supabase/ssr` é o pacote correto para App Router — gerencia cookies de sessão em Server Components |
| `zod` | `apps/web` | Validação de env (RN5) e futuros contratos |
| `tailwindcss@4` | `apps/web`, `packages/ui` | Engine de estilo |
| `vitest` | raiz, `packages/core` | Testes de unidade |
| `eslint`, `prettier`, `typescript` | raiz | Qualidade |
| `basejump-supabase_test_helpers` | `supabase/tests` | Extensão de banco (não npm). Fornece `tests.rls_enabled()` e `tests.authenticate_as()` |

**Ainda não instalados** — entram nas specs que os usam: `@sentry/nextjs`, `motion`, `shadcn/ui`, `resend`, SDK do Mercado Pago, Playwright.

### 6.2 Variáveis de ambiente

| Variável | Obrigatória | Escopo | Observação |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | browser + servidor | Local: `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | browser + servidor | Protegida por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | **servidor apenas** | Sem prefixo `NEXT_PUBLIC_`. Ignora RLS — vazar equivale a entregar o banco |
| `APP_ENV` | sim | servidor | `local \| staging \| production` |

---

## 7. Plano de Blocos

- [ ] **Bloco A — Esqueleto do monorepo:** `pnpm-workspace.yaml`, `package.json`, `.nvmrc`, tsconfig, ESLint (com a regra de fronteira), Prettier, `.gitignore`. Cobre T9, T10. ~40 min
- [ ] **Bloco B — Banco local e schema:** `config.toml`, migrations `0001`/`0002`, `seed.sql`. Depende de A. Cobre T5. ~60 min
- [ ] **Bloco C — Testes pgTAP:** `rls_enabled`, isolamento entre clientes, trigger de role. Depende de B. Cobre T1, T2, T3, T4. ~50 min
- [ ] **Bloco D — App Next.js:** `env.ts`, factories de Supabase, layout, página de verificação, `packages/core/tempo.ts` + testes Vitest. Depende de B. **Paralelo a C.** Cobre T6, T7, T8. ~60 min
- [ ] **Bloco E — CI e scripts:** workflow do GitHub Actions, `confirm-prod-deploy.sh`, geração de tipos e check de drift. Depende de C e D. Cobre T9, T11, T12. ~50 min

```
A → B → C ─┐
     └→ D ─┴→ E
```

---

## 8. Riscos Conhecidos

- **Risco:** `basejump-supabase_test_helpers` é extensão de terceiro; se estiver incompatível com a versão do CLI, a RN1 fica sem verificação automática.
  **Mitigação:** a verificação é uma consulta a `pg_tables` cruzada com `pg_policies` — se o helper falhar, escrevemos as ~10 linhas de SQL à mão. A dependência é de conveniência, não estrutural.
  **Gatilho de revisão:** primeira atualização do Supabase CLI.

- **Risco:** `SECURITY DEFINER` sem `search_path` fixo é vetor conhecido de escalada de privilégio.
  **Mitigação:** `search_path` explícito na função + teste T4 cobrindo o caminho de escalada.
  **Gatilho:** qualquer nova função `SECURITY DEFINER` em specs futuras.

- **Risco:** adiar staging/prod acumula problemas de ambiente para uma janela futura (variáveis, CORS, URLs de redirect do Auth).
  **Mitigação:** `APP_ENV` e a separação de variáveis existem desde já; nenhum código pode assumir `localhost`.
  **Gatilho:** o item de provisionamento no ROADMAP — quanto mais specs acumularem antes dele, maior a superfície de surpresa.

- **Risco:** Docker no Windows com WSL2 é fonte comum de lentidão de I/O.
  **Mitigação:** manter o repositório no sistema de arquivos do Windows (não dentro da distro WSL) e o Docker com integração WSL2 ativada.
  **Gatilho:** se `supabase start` passar de 2 minutos rotineiramente.
