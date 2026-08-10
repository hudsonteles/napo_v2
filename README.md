# Napo

Canal de venda próprio de pizza napolitana **assada e congelada** premium.
Monorepo com o núcleo de regras puro isolado do resto — a decisão arquitetural
central do projeto (ver [`ARCHITECTURE.md`](./ARCHITECTURE.md)).

> Fonte de verdade de processo: [`AGENTS.md`](./AGENTS.md). Backlog vivo:
> [`ROADMAP.md`](./ROADMAP.md).

## Pré-requisitos

- **Node** na versão do [`.nvmrc`](./.nvmrc) (`nvm use`) — fixada; o CI usa a mesma.
- **pnpm** (via Corepack: `corepack enable`). Outro gerenciador é recusado no `preinstall`.
- **Docker Desktop com backend WSL2** ativo — o Supabase local roda em contêiner.

## Setup (do zero à aplicação rodando)

```bash
pnpm install                       # instala tudo e baixa o CLI do Supabase
pnpm db:start                      # sobe Postgres, Auth, etc. em Docker
cp .env.example apps/web/.env.local  # preencha ANON e SERVICE_ROLE do output do passo anterior
pnpm dev                           # http://localhost:3000
```

A página inicial é uma **tela crua de verificação** (NAPO-001): mostra a hora
vinda do Postgres se toda a cadeia (env → Supabase → banco) estiver de pé. O
site de verdade nasce no NAPO-003.

> **Rodando outro projeto Supabase na máquina?** As portas padrão
> (54321–54324) colidem. Ajuste as portas em `supabase/config.toml` e a URL em
> `apps/web/.env.local`, ou pare o outro stack antes de `pnpm db:start`.

## Scripts

| Script | O quê |
|---|---|
| `pnpm dev` | App Next.js em desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm lint` | ESLint (inclui a fronteira de `packages/core`) |
| `pnpm typecheck` | `tsc --noEmit` em todos os workspaces |
| `pnpm test` | Testes de unidade (Vitest) do `packages/core` |
| `pnpm db:start` / `db:stop` | Sobe / derruba o Supabase local |
| `pnpm db:reset` | Recria o banco só a partir das migrations + seed |
| `pnpm db:test` | Testes de RLS e trigger (pgTAP) |
| `pnpm db:types` | Regenera os tipos TypeScript do banco |

## Estrutura

```
apps/web        Next.js 15 (App Router)
packages/core   Regras puras — sem React, sem Supabase, sem HTTP
packages/db     Tipos gerados do banco
packages/ui     Tokens visuais (componentes nascem no NAPO-003)
supabase        Migrations, seed e testes pgTAP
```

## Qualidade

Todo PR passa pelo CI (`.github/workflows/ci.yml`): lint, typecheck, testes de
unidade, build, testes de RLS em banco real e checagem de drift dos tipos. O que
quebra as regras da arquitetura é reprovado — a disciplina não depende de
lembrança.
