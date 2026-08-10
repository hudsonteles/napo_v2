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

## Rodando em outra máquina (do zero)

O estado do banco é **100% reproduzível a partir do repositório** — é só as
migrations versionadas + o seed. Não há nada feito à mão para copiar.

```bash
# 1. Clonar
git clone https://github.com/hudsonteles/napo_v2.git
cd napo_v2

# 2. Instalar — também baixa o CLI do Supabase e ARMA os git hooks (core.hooksPath)
pnpm install

# 3. Subir o banco local (Docker). 1ª vez baixa as imagens (uns minutos).
#    Aplica as migrations 0001/0002 e roda o seed automaticamente.
pnpm db:start

# 4. Criar o arquivo de ambiente (gitignored, não vem no clone)
cp .env.example apps/web/.env.local   # cole os valores do bloco abaixo

# 5. Rodar
pnpm dev                              # http://localhost:3000
```

### `apps/web/.env.local`

As chaves do Supabase **local** são determinísticas (chaves demo do stack local,
não segredo de produção) — idênticas em toda máquina. Cole exatamente:

```dotenv
APP_ENV=local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

> Se `pnpm db:start` imprimir chaves diferentes, use as do output.

### Como saber que ficou igual

- `http://localhost:3000` mostra **"Fundação de pé"** e a hora do Postgres.
- O banco tem o schema completo (`profiles`, RLS, trigger) e os **6 usuários de
  seed**: `cliente1`, `cliente2`, `atendente`, `cozinha`, `gerente`, `admin`.
- Para voltar ao estado limpo idêntico a qualquer momento: **`pnpm db:reset`**.

> **Portas:** o Napo usa o bloco **544xx** (API `54421`, DB `54422`, Studio
> `54423`…), não o padrão `543xx`, para coexistir com outros projetos Supabase
> na mesma máquina. Já vem assim no `supabase/config.toml` e no `.env.example`.

### Sincronia de banco entre as máquinas

Os hooks versionados em `.githooks/` são armados no `pnpm install` (passo 2).
Depois disso, **todo `git pull` que traz migrations novas aplica-as sozinho** no
seu Supabase local e regenera os tipos — sem precisar lembrar de rodar nada. Se
o Supabase estiver desligado, o hook só avisa; se uma migration antiga tiver
sido reescrita, ele sugere `pnpm db:reset` em vez de aplicar cegamente. Uso
manual: `pnpm db:sync`. Fluxo entre os dois PCs:

- **Máquina A:** cria migration → commita → `git push`
- **Máquina B:** `git pull` → o banco local se atualiza automaticamente

> **Credencial de push:** o push usa a conta `hudsonteles`. Se o git reclamar de
> permissão (403), rode `gh auth switch --user hudsonteles` (ou `gh auth login`).

## Scripts

| Script                      | O quê                                            |
| --------------------------- | ------------------------------------------------ |
| `pnpm dev`                  | App Next.js em desenvolvimento                   |
| `pnpm build`                | Build de produção                                |
| `pnpm lint`                 | ESLint (inclui a fronteira de `packages/core`)   |
| `pnpm typecheck`            | `tsc --noEmit` em todos os workspaces            |
| `pnpm test`                 | Testes de unidade (Vitest) do `packages/core`    |
| `pnpm db:start` / `db:stop` | Sobe / derruba o Supabase local                  |
| `pnpm db:reset`             | Recria o banco só a partir das migrations + seed |
| `pnpm db:test`              | Testes de RLS e trigger (pgTAP)                  |
| `pnpm db:types`             | Regenera os tipos TypeScript do banco            |

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
