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

> **Portas:** o Napo usa o bloco **544xx** (API `54421`, DB `54422`, Studio
> `54423`…), não o padrão `543xx`, para coexistir com outros projetos Supabase
> na mesma máquina. Já vem assim no `supabase/config.toml` e no `.env.example`.

### Sincronia de banco entre máquinas (dois PCs)

Os hooks versionados em `.githooks/` são armados automaticamente no
`pnpm install` (`git config core.hooksPath`). Depois disso, **todo `git pull`
que traz migrations novas aplica-as sozinho** no seu Supabase local e regenera
os tipos — sem precisar lembrar de rodar nada. Se o Supabase estiver desligado,
o hook só avisa; se uma migration antiga tiver sido reescrita, ele sugere
`pnpm db:reset` em vez de aplicar cegamente. Uso manual: `pnpm db:sync`.

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
