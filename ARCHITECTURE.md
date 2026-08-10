# 🏛️ Arquitetura Global do Projeto: [Nome do Projeto]

> 🛑 **LEITURA OBRIGATÓRIA PARA TODOS OS AGENTES**
> Este documento é a **Fonte Única da Verdade** (Single Source of Truth) para o projeto.
> Ele sobrepõe quaisquer regras genéricas de stack encontradas em outros lugares.

---

## 1. Visão do Produto e Objetivos

- **O que é:** [Resumo em 2 linhas da proposta de valor]
- **Público-alvo:** [Ex: Clientes finais, administradores, etc.]
- **Diferencial:** [O que torna este produto único no mercado]
- **O que NÃO é:** [Defina limites claros do que o sistema não pretende ser — evita scope creep]

---

## 2. Stack Tecnológica Fundamental

### 2.1 Core
- **Frontend:** [Ex: Next.js 14+ / React + Vite]
- **Linguagem:** TypeScript (Strict Mode obrigatório)
- **Backend & Database:** [Ex: Supabase (PostgreSQL) / Firebase (Firestore)]
- **Serviços de Infra:** [Ex: Vercel, Firebase Hosting, Cloud Functions]
- **Autenticação:** [Ex: Supabase Auth / Firebase Auth com RBAC]

### 2.2 UI & UX (Design System)
- **Base de Componentes (catálogo de UI do projeto):** [declare aqui o catálogo deste projeto, na granularidade que fizer sentido. Ex.: bibliotecas externas adotadas (shadcn/ui, Radix, MUI, Chakra, Mantine, Quasar, Flutter Material, SwiftUI), primitivos próprios (`src/ui/`), patterns de composição (`src/ui/patterns/`). Caminhos exatos seguem a estrutura definida em §3.]
- **Estilização:** [engine de styling adotado. Ex.: Tailwind v4 com `@theme`, CSS Modules, Vanilla CSS com tokens em `:root`, CSS-in-JS, Theme Provider da lib de componentes]
- **Ícones:** [biblioteca padrão. Ex.: lucide-react, Phosphor, Material Icons]
- **Animações:** [biblioteca/padrão. Ex.: Framer Motion, CSS Transitions, lottie]
- **Tokens visuais:** [onde vivem — ex.: `src/index.css :root`, `theme.ts`, `tokens.json`. Esta é a fonte que o agente vai espelhar ao gerar `preview.*` na FASE 3.5 do `/especificar`.]

### 2.2.1 Library-First (regra inviolável — aplicação de `AGENTS.md` §2 item 11)

Páginas e componentes de produto **DEVEM** compor a partir do catálogo declarado em §2.2. Hierarquia de escolha:

1. **Reutilizar** componente/primitivo existente no catálogo.
2. **Reutilizar** pattern de composição existente.
3. **Estender** componente existente (nova variante, slot, prop).
4. **Criar novo** componente/pattern — **exige justificativa** em `design.md` §4.4 explicando por que existentes não servem.

**Markup cru extenso** em página de produto (código que replica o que deveria ser componente — classes utilitárias longas, JSX/HTML repetido, lógica visual no nível da página) é **violação**. Exceções toleradas e explicitadas:
- Containers de layout do nível mais externo da página (grid/flex).
- Spacing simples entre primitivos.

O contrato visual de cada spec (§4.4 do `design.md`) é a fonte de verdade sobre **quais componentes do catálogo serão consumidos**, **quais componentes novos serão criados (com justificativa)** e **onde markup cru é aceito** — sem registro lá, é violação direta de `AGENTS.md` §2 item 11.

### 2.3 Ferramentas de Qualidade
- **Linter:** [Ex: ESLint com config strict]
- **Formatação:** [Ex: Prettier]
- **Validação de Dados:** Zod (schemas estritos para Forms, APIs e Webhooks)
- **Testes:** [Ex: Vitest, Jest, Playwright]

---

## 3. Arquitetura de Código (Feature-Based com Single Responsibility)

A estrutura segue os princípios de **Feature-Sliced Design** e **Bulletproof React**: organização por **domínio de negócio** (não por tipo de arquivo), com cada camada tendo responsabilidade única e regras claras de dependência.

### 3.1 Árvore de Diretórios

```
/projeto
│
├ /docs                         # 📄 Documentação e decisões de arquitetura
│   ├ /specs                    #    Blueprints por módulo (usando template xx-SpecName.md)
│   └ /adr                     #    Architecture Decision Records (opcional)
│
├ /public                       # 🌐 Estáticos servidos SEM processamento do bundler
│                               #    (favicon.ico, robots.txt, og-images, manifest.json)
│
├ /src                          # 💻 Código-fonte principal
│   ├ /app                     #    Camada de Apresentação: rotas, páginas e layouts
│   │                          #    (Adaptar ao framework: App Router, Vite routes, etc.)
│   │
│   ├ /features                #    🧩 NÚCLEO: Módulos de Negócio (auto-contidos)
│   │   └ /[feature-name]/     #    Cada feature é isolada e contém:
│   │       ├ /components      #       Componentes visuais do módulo
│   │       ├ /hooks           #       Hooks específicos do módulo
│   │       ├ /services        #       Lógica de acesso a dados / API calls
│   │       ├ /types           #       Tipos e interfaces do módulo
│   │       ├ /utils           #       Helpers internos do módulo
│   │       └ index.ts         #       Public API (barrel file — único ponto de export)
│   │
│   ├ /shared                  #    ♻️ Código reutilizável ENTRE features
│   │   ├ /ui                  #       Design System (Botões, Inputs, Cards, Modais, Toast)
│   │   ├ /layout              #       Shell da Aplicação (Sidebar, Header, Footer)
│   │   ├ /hooks               #       Hooks genéricos (useDebounce, useMediaQuery)
│   │   └ /utils               #       Helpers puros (formatters, validators, cn())
│   │
│   ├ /lib                     #    ⚙️ Infraestrutura (clientes DB, config, providers, auth)
│   │
│   ├ /types                   #    📐 Tipos TypeScript globais (env.d.ts, types globais)
│   │
│   └ /assets                  #    🖼️ Recursos processados PELO bundler
│                               #    (imagens importadas em código, SVGs como componentes,
│                               #     fontes locais, ícones customizados)
│
├ /scripts                      # 🔧 Automação (deploy, seed, migrations, confirm-deploy)
│
├ /.tmp                       # 🤖 [GITIGNORED] Scratch do agente de IA
│                               #    (arquivos temporários, logs de debug, scripts one-off,
│                               #     testes exploratórios — SEGURO para deletar a qualquer momento)
│
└ /[config files]               # ⚙️ .env.*, tsconfig, eslint, .gitignore, package.json, etc.
```

### 3.2 Regra de Dependência (Dependency Rule)

> ⚠️ **LEI FUNDAMENTAL:** Imports só podem fluir "para baixo". Uma feature NUNCA importa de outra feature.

```
/app       → pode importar de → /features, /shared, /lib
/features  → pode importar de → /shared, /lib
/shared    → pode importar de → /lib apenas
/lib       → não importa de ninguém (infraestrutura pura)
```

- **Features são ilhas:** comunicam-se via estado global (Context, Store) ou eventos, NUNCA por import direto.
- **Barrel files (`index.ts`):** cada feature expõe APENAS o que é necessário. Internals são privados.
- **Shared é genérico:** se um componente/hook serve a apenas UMA feature, ele pertence à feature, não ao `/shared`.

### 3.3 Diferença: `/public` vs `/src/assets`

| Pasta | Processamento | Exemplo | Como referenciar |
|---|---|---|---|
| `/public` | Nenhum (copiado as-is para output) | `favicon.ico`, `robots.txt`, `og-image.png` | URL absoluta: `/favicon.ico` |
| `/src/assets` | Bundler otimiza (hash, compressão, tree-shake) | Imagens de UI, SVGs, fontes locais | `import logo from '@/assets/logo.svg'` |

### 3.4 A pasta `/.tmp` (Scratch do Agente)

- **Obrigatoriamente no `.gitignore`**
- Usada pelo agente de IA para: scripts de teste one-off, logs temporários, rascunhos de migrations, outputs de debug
- **Segura para deletar a qualquer momento** — nenhum código de produção pode depender dela
- Evita poluição da árvore do projeto com arquivos temporários

### 3.5 Pastas que NÃO devem estar no template

| Pasta | Motivo da exclusão |
|---|---|
| `/dist`, `/build`, `/.next` | Gerada automaticamente pelo bundler — deve estar no `.gitignore` |
| `/node_modules` | Gerenciada pelo package manager — nunca versionada |
| `/.cache`, `/.turbo` | Cache de ferramentas — transparente ao desenvolvedor |

> **Nota:** Adapte a árvore ao framework escolhido (Next.js App Router, Vite, etc.), mas mantenha rigorosamente a separação modular e as regras de dependência.

---

## 4. Diretrizes de Engenharia

### 4.1 Estilo de Código
- **Linguagem do código:** [Ex: Variáveis e funções em inglês/camelCase]
- **Documentação:** Comentários, commits e documentação em Português (PT-BR)
- **JSDoc:** Obrigatório (`/** ... */`) em todas as funções exportadas e componentes complexos
- **DRY:** Proibido duplicar lógica — centralize em helpers, hooks e componentes reutilizáveis

### 4.2 Padrões de API e Dados
- **Respostas de API:** Seguir padrão `{ success: boolean, data?: T, error?: string }`
- **Banco de Dados:** Todas as tabelas devem ter campos `id (UUID)`, `created_at` e `updated_at`
- **Validação:** Inputs de Forms, APIs e Webhooks devem passar por schemas Zod estritos
- **Tratamento de Erros:** Erros devem ser capturados, logados e exibidos de forma amigável ao usuário

### 4.3 Componentização (UI)
- **Check-first:** Antes de criar um componente, verificar se já existe em `/components/ui`
- **Variantes:** Usar variantes do Design System em vez de classes hardcoded
- **Zero Inline:** Estilos complexos devem ser abstraídos em componentes wrapper
- **Feedback ao Usuário:**
  - Info/Sucesso → `Toast` (Snackbar)
  - Confirmação → `Modal` customizado
  - **PROIBIDO:** `alert()` e `confirm()` nativos

---

## 5. Segurança

### 5.1 Princípios Fundamentais
- **Frontend Inseguro:** Assuma que todo dado vindo do cliente é malicioso. Validação real acontece no Backend
- **Zod em tudo:** Validação em runtime para qualquer dado externo (APIs, forms, webhooks)
- **Supply Chain:** `npm audit` obrigatório antes de deploys em produção
- **Chaves e Secrets:** `.env` NUNCA sobe para o Git — use `.env.example` como referência

### 5.2 Autenticação e Autorização
- **Tipo de Auth:** [Ex: JWT, Session-based, Firebase Auth]
- **RBAC Obrigatório:** Segurança deve depender da **role** do usuário, não apenas da autenticação
- **Regras de Acesso:** [Ex: RLS no Supabase / Firestore Security Rules] — Princípio de "Negar por padrão"

### 5.3 Isolamento de Dados (se multi-tenant)
- [Descrever estratégia de isolamento: RLS, schemas separados, etc.]

---

## 6. DevOps, Ambientes e Deploy

### 6.1 Separação de Ambientes
- **Development:** Branch `dev`, Banco/Projeto `[nome]_dev`
- **Production:** Branch `main`, Banco/Projeto `[nome]_prod`
- **Regra de Ouro:** O código NUNCA deve ser alterado manualmente para mudar de ambiente — só via env vars / scripts de build.
- **Automação (preencher conforme stack escolhida no Fluxo 1):**
  - **Comando dev:** [Ex: `npm run dev` (Vite/Next), `python manage.py runserver` (Django), `go run .` (Go)]
  - **Comando build prod:** [Ex: `npm run build`, `python manage.py collectstatic`, `go build`]
  - **Carregamento de variáveis:** [Ex: Vite usa `.env.development`/`.env.production`; Next usa `.env.local`/`.env.production.local`; Django usa `.env` + `settings.py`]
- **`.env*` nunca no Git** — versionar apenas `.env.example` com chaves sem valores.

### 6.2 Protocolo de Deploy
1. **Prepare:** Lint + Build locais verdes
2. **Backup:** Snapshot do Banco antes de migrations destrutivas
3. **Confirmação obrigatória de prod:** `bash scripts/confirm-prod-deploy.sh <nome-projeto-prod>` deve estar encadeado ao comando real de deploy de produção (ver §6.4)
4. **Deploy:** [Descrever fluxo — ex: Push para `main`, CI/CD, comando manual]
5. **Verify:** Health Check imediato em Produção
6. **Rollback:** Plano de reversão em caso de falha crítica

### 6.3 Scripts Obrigatórios (em `package.json` / `Makefile` / equivalente da stack)
- **`dev`** — Desenvolvimento local com emuladores/env dev
- **`build`** — Build de produção
- **`deploy:dev`** — Deploy para ambiente de desenvolvimento
- **`deploy:prod`** — Deploy para produção, **obrigatoriamente encadeado** com `scripts/confirm-prod-deploy.sh` (ver §6.4)
- [Outros scripts conforme necessidade do projeto — ex: `deploy:dev:rules`, `deploy:dev:functions` se Firebase]

### 6.4 Salvaguarda contra Deploy Acidental em Prod
- **Script obrigatório:** `scripts/confirm-prod-deploy.sh` (vem no template — não remover).
- **Funcionamento:** exige digitação literal do nome do projeto/ambiente prod antes de prosseguir. Aborta se não conferir.
- **Encadeamento típico:**
  - **Node (Vite/Next/etc.):** `"deploy:prod": "bash scripts/confirm-prod-deploy.sh <nome-prod> && <comando-deploy>"`
  - **Makefile:** `deploy-prod: ; bash scripts/confirm-prod-deploy.sh <nome-prod> && <comando-deploy>`
  - **Python (just/poethepoet):** análogo, sempre com `confirm-prod-deploy.sh` ANTES do comando real.
- **Nome esperado:** definido durante o Fluxo 1 (`/iniciar`) e registrado em §6.3.

---

## 7. Diretrizes de Design e UX

### 7.1 Filosofia de Design
- **Design Premium:** Interfaces devem causar "wow factor" — evitar layouts genéricos de templates
- **Mobile First:** CSS sempre mobile-first
- **CLS Zero:** Imagens obrigatórias com `width`, `height` ou `aspect-ratio`
- **Fontes:** Usar fontes otimizadas (ex: `next/font`, Google Fonts) para evitar CLS

### 7.2 Performance UI
- **Lazy Loading:** Usar carregamento lazy para rotas e componentes pesados (Modais, Gráficos)
- **Server Components (se Next.js):** Padrão. Use `'use client'` apenas nas folhas da árvore (interatividade)
- **Otimização de Imagens:** Sempre especificar dimensões para evitar Layout Shift

---

## 8. Comportamento Esperado do Agente

### 8.1 Diretriz Principal
> **"Na dúvida, proteja os dados do usuário e pergunte antes de agir."**

### 8.2 Protocolo de Planejamento
- **Planos antes de código:** Para tarefas complexas, criar plano de implementação antes de codar
- **Socratic Gate:** Se o requisito for vago, fazer perguntas de clarificação antes de agir
- **Verificação Final:** Mudanças executáveis só terminam quando `lint`, `build` e `test` passarem; fluxos exclusivamente documentais usam o gate documental definido em `AGENTS.md`

### 8.3 Personas Dinâmicas (Contexto de Edição)
- Editando **Regras de Negócio** → Atuar como **Product Engineer**: Foco em valor e UX
- Editando **Auth/Middleware/Segurança** → Atuar como **Security Engineer**: Paranoia total com validação
- Editando **UI/Componentes** → Atuar como **Design Architect**: Foco em estética premium
- Editando **Infra/DevOps** → Atuar como **DevOps Engineer**: Foco em estabilidade e automação

---

**Versão da Arquitetura:** 0.1.0
**Última Atualização:** [DATA]
