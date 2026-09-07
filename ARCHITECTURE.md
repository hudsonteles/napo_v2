# 🏛️ Arquitetura Global do Projeto: Napo

> 🛑 **LEITURA OBRIGATÓRIA PARA TODOS OS AGENTES**
> Este documento é a **Fonte Única da Verdade** (Single Source of Truth) para o projeto.
> Ele sobrepõe quaisquer regras genéricas de stack encontradas em outros lugares.

> 📚 **Derivado de** [`docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`](docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md).
> Em conflito entre este arquivo e a spec do R1, **a spec vence** e este documento é corrigido via ADR.

---

## 1. Visão do Produto e Objetivos

- **O que é:** pizzaria napolitana de Brasília que vende pizza **assada e congelada** — massa de longa fermentação, forno italiano a 400°C, cliente só aquece em casa. O sistema é o canal de venda próprio: catálogo, checkout, disponibilidade honesta, frete e gestão da operação.
- **Público-alvo:** cliente final em Brasília num raio de 12 km; equipe interna (atendente, cozinha, gerente, admin).
- **Diferencial:** o concorrente é a **congelada de supermercado**, não a pizzaria da esquina. A diferença é física e não copiável: o cliente não reproduz 400°C em casa. Promessa do produto — _"fizemos a parte que a sua casa não consegue fazer"_.
- **O que NÃO é:** não é ERP, não é DRE/fluxo de caixa, não é integradora fiscal homologada, não é app mobile nativo. Não opera evento ao vivo — apenas o prepara (R2).

### 1.1 O gargalo que define as prioridades

O gargalo é o **forno, não o mercado**: a cozinha opera a 47% da capacidade (303 de 650 pizzas/mês) e a ociosidade vale **R$ 7.700/mês de margem** não capturada. Toda decisão de arquitetura que precisar de desempate deve favorecer **vender a capacidade ociosa** e **medir a operação** — nessa ordem.

| Indicador                    | Valor                            |
| ---------------------------- | -------------------------------- |
| Capacidade                   | 30 pizzas/dia × 5 dias = 650/mês |
| Volume atual                 | 303/mês                          |
| Ponto de equilíbrio          | 207/mês                          |
| Margem de contribuição média | R$ 20,82/pizza                   |

---

## 2. Stack Tecnológica Fundamental

### 2.1 Core

- **Monorepo:** pnpm workspaces — **sem Turborepo** até o build doer
- **Frontend:** Next.js 15 (App Router), app único dividido por grupos de rota
- **Linguagem:** TypeScript (Strict Mode obrigatório)
- **Backend & Database:** Supabase — PostgreSQL, Auth, Storage
- **Serviços de Infra:** Vercel · domínio `napobsb.com.br` (DNS no Registro.br)
- **Autenticação:** Supabase Auth (Magic Link + Google) com RBAC por `role` + gate obrigatório de telefone por OTP no WhatsApp
- **Canal do OTP:** **WhatsGW** — gateway não-oficial, por número dedicado do sistema. Decidido em [ADR-0002](docs/adr/0002-otp-whatsgw.md), porque a verificação da empresa na Meta depende de documentos em revisão e, no volume da Napo (303 pizzas/mês), o limiar de *authentication templates* pode nunca ser alcançado. A **API oficial da Meta** segue prevista para o bot (NAPO-015) e o marketing (NAPO-016): volume por gateway não-oficial é o caminho mais curto para o banimento
- **Pagamento (online):** Mercado Pago **Checkout Bricks** (Payment Brick, conta PJ) — Pix, crédito, débito, conta Mercado Pago. Renderizado no nosso domínio: o cliente não sai do site. Decidido em [ADR-0001](docs/adr/0001-checkout-bricks.md).
- **Pagamento (presencial):** Mercado Pago **Point Integration API** — o valor sai do sistema para a maquininha e o cliente escolhe a forma no aparelho
- **E-mail transacional:** Resend. `pedido@napobsb.com.br` para e-mail de pedido; `acesso@napobsb.com.br` para o que diz respeito à conta (Magic Link, boas-vindas) — remetente chamado "pedido" contradiz a mensagem de quem não pediu nada. Decidido na especificação do NAPO-031 (2026-09-06)
- **Monitoramento de erros:** Sentry

### 2.2 UI & UX (Design System)

- **Base de Componentes (catálogo de UI do projeto):** `shadcn/ui` como biblioteca externa adotada, instalada em **`packages/ui/src/components/`**. Patterns de composição do projeto em **`packages/ui/src/patterns/`** (ex.: o padrão de listagem — cards + busca + combobox de filtro + combobox de ordenação, com persistência ao navegar entre card e lista).
- **Estilização:** Tailwind v4 com `@theme`
- **Ícones:** `lucide-react` (padrão do shadcn/ui)
- **Animações:** **Motion**, sempre respeitando `prefers-reduced-motion`
- **Tokens visuais:** **`packages/ui/src/tokens.css`** — fonte única que o agente espelha ao gerar `preview.*` na FASE 3.5 do `/especificar`.
- **Identidade:** preto, branco e amarelo. Referência de storytelling: Apple. Interface premium, nunca template genérico.

#### 2.2.3 Mensagens de erro são nossas (regra inviolável)

**Nenhuma tela do sistema exibe mensagem padrão do navegador ou do provedor.** Isso
inclui a bolha de validação nativa de formulário (`required`, `type="email"`,
`pattern`), `alert()`/`confirm()`, e a página de erro em JSON de qualquer serviço
externo.

- Todo `<form>` leva `noValidate`; a validação roda no nosso código e a mensagem
  aparece no lugar previsto pelo design, com a nossa voz e em português.
- Caminho que depende de configuração externa (login social, gateway) só é
  **oferecido** quando a configuração existe naquele ambiente. Botão que leva a
  erro de terceiro é caminho quebrado — pior que caminho a menos.

**Motivo:** a bolha nativa é a única superfície do produto que não passa por
design nem por revisão de texto, muda de aparência a cada navegador e fala em
inglês em boa parte dos sistemas. Registrada no Gate Visual B do NAPO-006, quando
a validação do e-mail no login apareceu em caixa cinza do navegador.

#### 2.2.2 Marca e identidade visual (regra inviolável)

**A Napo tem identidade visual própria e ela é obrigatória em toda superfície do produto.** Nenhuma tela, e-mail ou documento gerado pode inventar marca, usar iniciais em caixa colorida, texto simulando logotipo ou ícone genérico de biblioteca no lugar do logotipo.

| Arquivo servido | Fonte original | Uso |
| --- | --- | --- |
| `apps/web/public/marca/logo-dark.png` | `docs/images/LOGO_DARK.png` | Logotipo para **fundo escuro** — é o padrão do app (fundo `--color-preto`) |
| `apps/web/public/marca/logo-light.png` | `docs/images/LOGO_LIGHT.png` | Logotipo para **fundo claro** — e-mail, impresso, superfícies brancas |
| `apps/web/public/favicon.ico` · `favicon-96x96.png` · `apple-touch-icon.png` | `docs/images/favicon/` | Aba do navegador e atalho de celular |
| `apps/web/public/icone-192.png` · `icone-512.png` | `docs/images/favicon/web-app-manifest-*.png` | `site.webmanifest` (instalação como app) |
| — | `docs/images/Icone.png` | Ícone isolado em alta resolução (2136 px). **Fonte**, não é servido: peso de 1,7 MB. Derive o tamanho necessário. |

- **`docs/images/` é a fonte da verdade da marca.** `apps/web/public/` recebe apenas as derivações servidas ao navegador. Arte nova entra primeiro em `docs/images/`.
- **Consuma pelo componente `<Marca>`** (`packages/ui/src/components/marca.tsx`), nunca por `<img>` solto com o caminho digitado à mão — trocar a arte precisa ser uma edição em um arquivo só.
- **O logotipo não é reescrito, recolorido nem recomposto.** O `O` da palavra é a pizza vista de cima; é o ativo da marca, não um desenho decorativo.
- **Tema:** o produto é escuro. Use `variante="clara"` só onde o fundo é comprovadamente claro.
- **Imagens:** o site é construído com **placeholders nas proporções finais** — o ensaio fotográfico (NAPO-020) entra depois sem quebrar layout.

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

- **Linter:** ESLint (config strict) — `eslint-config-next` + regras do monorepo
- **Formatação:** Prettier
- **Validação de Dados:** Zod (schemas estritos para Forms, APIs e Webhooks)
- **Testes:** **Vitest** (unitário de `packages/core` + RLS contra Supabase local) · **Playwright** (checkout ponta a ponta)
- **CI:** GitHub Actions — typecheck, lint, testes e migrations

---

## 3. Arquitetura de Código (Monorepo com núcleo de regras puro)

A organização é por **domínio de negócio**, com uma separação adicional que é a **decisão arquitetural central do projeto**: as regras que, quando erram, vendem pizza que não existe ou cobram frete errado vivem isoladas em `packages/core`.

### 3.1 Árvore de Diretórios

```
napo/
│
├ /docs                          # 📄 Documentação e decisões
│   ├ /specs                     #    Blueprints por módulo (xx-SpecName / xx-SpecLite)
│   ├ /adr                       #    Architecture Decision Records
│   └ /superpowers/specs         #    Spec macro do R1 (origem deste documento)
│
├ /apps
│   └ /web                       # 💻 Next.js 15 — App Router
│       ├ /app
│       │   ├ /(site)            #    SSG/ISR — home, sabores, sobre, legal
│       │   ├ /(loja)            #    catálogo, carrinho, checkout
│       │   ├ /(conta)           #    área do cliente
│       │   ├ /(admin)           #    painel administrativo
│       │   └ /api               #    frete, disponibilidade, otp, webhook/mp
│       ├ /src
│       │   ├ /features          #    🧩 Módulos de negócio da web (auto-contidos)
│       │   │   └ /[feature]/    #       components · hooks · services · types · index.ts
│       │   └ /lib               #    ⚙️ Infra do app: clients, providers, middleware
│       └ /public                #    🌐 Estáticos as-is (favicon, robots.txt, og-image)
│
├ /packages
│   ├ /core                      # 🧮 REGRAS PURAS — cutoff, CTP/ATP, frete, BOM, margem
│   ├ /ui                        # 🎨 tokens.css, components/ (shadcn), patterns/
│   └ /db                        # 🗄️ tipos gerados do Supabase + factories de client
│
├ /supabase
│   └ /migrations                # 🐘 Toda alteração de banco, versionada
│
├ /scripts                       # 🔧 Automação (seed, confirm-prod-deploy.sh)
│
├ /.tmp                          # 🤖 [GITIGNORED] Scratch do agente de IA
│
└ /[config files]                # ⚙️ pnpm-workspace.yaml, .env.*, tsconfig, eslint
```

### 3.2 Regra de Dependência (Dependency Rule)

> ⚠️ **LEI FUNDAMENTAL:** Imports só podem fluir "para baixo". Uma feature NUNCA importa de outra feature.

```
apps/web/app       → pode importar de → apps/web/src/features, src/lib, packages/*
apps/web/features  → pode importar de → apps/web/src/lib, packages/*
packages/ui        → pode importar de → packages/core apenas (React + Tailwind externos)
packages/db        → pode importar de → packages/core apenas (supabase-js externo)
packages/core      → NÃO importa de ninguém
```

**`packages/core` não importa React, não importa Supabase e não faz HTTP.** É TypeScript puro. Toda regra que decide _o que pode ser vendido, quando e por quanto_ mora aqui e é testável com testes rápidos e determinísticos.

- **Features são ilhas:** comunicam-se via estado global ou eventos, NUNCA por import direto.
- **Barrel files (`index.ts`):** cada feature expõe APENAS o que é necessário. Internals são privados.
- **Shared é genérico:** se um componente/hook serve a apenas UMA feature, ele pertence à feature, não a `packages/ui`.

### 3.3 Diferença: `/public` vs assets processados

| Pasta                       | Processamento                      | Exemplo                                     | Como referenciar                       |
| --------------------------- | ---------------------------------- | ------------------------------------------- | -------------------------------------- |
| `apps/web/public`           | Nenhum (copiado as-is)             | `favicon.ico`, `robots.txt`, `og-image.png` | URL absoluta: `/favicon.ico`           |
| Assets importados em código | Bundler otimiza (hash, compressão) | SVGs, ícones customizados                   | `import logo from '@/assets/logo.svg'` |

### 3.4 A pasta `/.tmp` (Scratch do Agente)

- **Obrigatoriamente no `.gitignore`**
- Usada pelo agente para: scripts one-off, logs temporários, rascunhos de migrations, outputs de debug
- **Segura para deletar a qualquer momento** — nenhum código de produção pode depender dela

### 3.5 Pastas que NÃO devem estar versionadas

| Pasta                       | Motivo                                |
| --------------------------- | ------------------------------------- |
| `/dist`, `/build`, `/.next` | Gerada pelo bundler — no `.gitignore` |
| `/node_modules`             | Gerenciada pelo pnpm                  |
| `/.cache`, `/.turbo`        | Cache de ferramentas                  |

---

## 4. Diretrizes de Engenharia

### 4.1 Estilo de Código

- **Linguagem do código:** variáveis e funções em inglês/camelCase
- **Documentação:** comentários, commits e documentação em Português (PT-BR)
- **JSDoc:** obrigatório (`/** ... */`) em funções exportadas e componentes complexos
- **DRY:** proibido duplicar lógica — centralize em helpers, hooks e componentes

### 4.2 Padrões de API e Dados

- **Respostas de API:** padrão `{ success: boolean, data?: T, error?: string }`
- **Banco de Dados:** todas as tabelas com `id (UUID)`, `created_at` e `updated_at`
- **Validação:** inputs de Forms, APIs e Webhooks passam por schemas Zod estritos
- **Tratamento de Erros:** capturados, logados no Sentry e exibidos de forma amigável

### 4.3 Fuso horário (regra crítica do domínio)

Tudo persistido em `timestamptz` **UTC**. **Toda** decisão de data de negócio passa por um **único helper em `packages/core`** fixado em `America/Sao_Paulo`. Nenhum cálculo de cutoff ou dia de entrega pode acontecer fora desse helper — data errada aqui vende pizza que não existe.

### 4.4 Componentização (UI)

- **Check-first:** antes de criar componente, verificar `packages/ui` (§2.2.1)
- **Variantes:** usar variantes do Design System em vez de classes hardcoded
- **Zero Inline:** estilos complexos abstraídos em componentes wrapper
- **Feedback ao Usuário:**
  - Info/Sucesso → `Toast`
  - Confirmação → `Modal` customizado
  - **PROIBIDO:** `alert()` e `confirm()` nativos

### 4.5 Custo de hospedagem (restrição ativa)

- `app/(site)/` é **SSG com `revalidate` longo** — catálogo muda pouco; nada de SSR sem motivo declarado.
- **Vercel Analytics e Speed Insights ficam fora do R1** (cota paga).
- Plano **Vercel Pro** é obrigatório (Hobby proíbe uso comercial) — custo fixo previsto.

---

## 5. Segurança

### 5.1 Princípios Fundamentais

- **Frontend Inseguro:** todo dado vindo do cliente é malicioso. Validação real no Backend
- **Zod em tudo:** validação em runtime para qualquer dado externo
- **Supply Chain:** `pnpm audit` obrigatório antes de deploy em produção
- **Chaves e Secrets:** `.env` NUNCA sobe para o Git — use `.env.example` como referência
- **`service_role` nunca no browser** — apenas em Route Handlers
- **Chave do Google Maps restrita por referrer**; chave de geocoding só no servidor

### 5.2 Autenticação e Autorização

- **Tipo de Auth:** Supabase Auth — Magic Link e Google, para cliente e equipe
- **Roles:** `cliente · atendente · cozinha · gerente · admin`
- **RBAC Obrigatório:** segurança depende da **role**, não apenas da autenticação
- **Trigger bloqueando alteração de `role`** que não venha de admin — sem isso, um cliente com o próprio token se promove a gerente
- **Gate de telefone:** tudo que **grava dado da pessoa** (checkout, conta) exige telefone validado por OTP no WhatsApp. Navegação pública e o carrinho anônimo — que vive no navegador e nunca toca o banco — são livres: exigência de SEO e conversão. O gate é aplicado no clique de finalizar o pedido (NAPO-006 RN1)

### 5.3 Isolamento de Dados

- **RLS negando por padrão em TODA tabela.** Nenhuma tabela sem política.
- **Middleware protege rota; RLS protege dado.** Middleware sozinho não é segurança.
- **Auditoria obrigatória** em: preço, estoque, capacidade, `role` e configuração de operação.

---

## 6. DevOps, Ambientes e Deploy

### 6.1 Separação de Ambientes

| Ambiente  | Banco                                         | Frontend                                   |
| --------- | --------------------------------------------- | ------------------------------------------ |
| `local`   | **Supabase CLI em Docker** (`supabase start`) | `pnpm dev`                                 |
| `staging` | projeto Supabase de staging                   | Preview deployment da Vercel               |
| `prod`    | projeto Supabase de produção                  | Vercel em `napobsb.com.br` (branch `main`) |

**O ambiente local é obrigatoriamente containerizado.** `supabase start` sobe Postgres, Auth, PostgREST, Realtime, Storage, Studio e servidor de e-mail fake em Docker — **requer Docker Desktop com backend WSL2**. Não é conveniência: é o que torna possível o teste de RLS exigido pela spec §9 (`cliente A não lê pedido de B`) sem depender de projeto remoto.

**O que não funciona local** e precisa de tratamento por spec:

| Serviço              | Local                     | Como tratar                                         |
| -------------------- | ------------------------- | --------------------------------------------------- |
| Magic Link           | ✅ inbox fake por padrão  | SMTP real do Resend é **opt-in por env** (NAPO-031) — ligado para exercitar a integração que vai para homologação, desligado para desenvolver |
| Google OAuth         | ⚠️ exige credencial real  | configurar ou testar só em staging                  |
| OTP WhatsApp (WhatsGW) | ❌ API externa · **sessão viva** (QR code) que cai sozinha | **mock obrigatório** — decisão da spec NAPO-002. Em `WHATSAPP_PROVIDER=fake` o código é fixo `123456` |
| Webhook Mercado Pago | ❌ precisa de URL pública | **túnel `cloudflared`** (o ngrok é removido pelo Windows Defender como `Trojan:Win32/Kepavll!rfn` — heurística de ferramenta de túnel; ver 2026-09-05). **A URL do túnel grátis muda a cada execução** e precisa ser espelhada em `DEV_TUNNEL_HOST`, senão o Next recusa as requisições. **Dois tópicos:** `payment` (Bricks, Pix, link) e `point_integration_wh`/`orders` (maquininha) |
| Maquininha Point     | ❌ aparelho físico        | exige aparelho pareado à conta; o adaptador é mockado em teste (NAPO-027) |

- **Regra de Ouro:** o código NUNCA é alterado manualmente para mudar de ambiente — só via env vars.
- **Toda alteração de banco via migration versionada.** Sem exceção.
- **Carregamento de variáveis:** Next.js — `.env.local` (dev) e variáveis de ambiente da Vercel por escopo (Preview/Production).
- **`.env*` nunca no Git** — versionar apenas `.env.example`.

### 6.2 Protocolo de Deploy

1. **Prepare:** lint + typecheck + build locais verdes
2. **Backup:** snapshot do banco antes de migrations destrutivas
3. **Confirmação obrigatória de prod:** `bash scripts/confirm-prod-deploy.sh napo-prod` encadeado ao comando real (ver §6.4)
4. **Deploy:** push para `main` → Vercel builda e publica; migrations aplicadas via `db:push:prod`
5. **Verify:** health check imediato + Sentry limpo
6. **Rollback:** rollback de deployment na Vercel; migration reversa versionada quando houver schema

### 6.3 Scripts Obrigatórios (`package.json` da raiz)

- **`dev`** — desenvolvimento local com Supabase CLI
- **`build`** — build de produção
- **`lint`** / **`typecheck`** / **`test`** — gates de qualidade
- **`db:migrate`** — aplica migrations no ambiente local
- **`db:push:staging`** — aplica migrations em staging
- **`db:push:prod`** — aplica migrations em produção, **obrigatoriamente encadeado** com `confirm-prod-deploy.sh` (ver §6.4)

### 6.4 Salvaguarda contra Deploy Acidental em Prod

- **Script obrigatório:** `scripts/confirm-prod-deploy.sh` (vem no template — não remover).
- **Funcionamento:** exige digitação literal do nome do projeto prod antes de prosseguir. Aborta se não conferir.
- **Nome esperado:** `napo-prod` _(confirmar ao criar o projeto Supabase de produção)_.
- **O que a salvaguarda protege:** como a Vercel publica por git push, o risco real está no **banco**. O encadeamento vale para migrations:
  ```json
  "db:push:prod": "bash scripts/confirm-prod-deploy.sh napo-prod && supabase db push --linked"
  ```

---

## 7. Diretrizes de Design e UX

### 7.1 Filosofia de Design

- **Design Premium:** interfaces devem causar "wow factor" — evitar layout genérico de template. Referência de storytelling: Apple
- **Mobile First:** CSS sempre mobile-first
- **CLS Zero:** imagens obrigatórias com `width`, `height` ou `aspect-ratio` — inclusive os placeholders que antecedem o ensaio fotográfico
- **Fontes:** `next/font` para evitar CLS
- **Movimento:** Motion respeitando `prefers-reduced-motion`

### 7.2 Performance UI

- **Lazy Loading:** rotas e componentes pesados (Modais, Gráficos)
- **Server Components:** padrão. `'use client'` apenas nas folhas da árvore
- **Otimização de Imagens:** decidir por spec entre `next/image` e assets pré-otimizados no Supabase Storage (§4.5 — cota de transformação é custo real)

### 7.3 Conteúdo e regulação

- **Eixo do site:** _"Longa fermentação. Assada na pedra. Em casa, só aquecer. A parte difícil já foi feita."_
  Alterado pelo PM em 2026-08-13 (antes: _"Forno italiano a 400 °C"_). A pedra é imagem concreta e o argumento
  continua não copiável: a casa do cliente não tem forno de pedra. Registrado em `docs/specs/003-site-catalogo/spec.md` §7.
- **Alérgenos e validade** são obrigatórios no catálogo (rotulagem ANVISA). Nutella com Avelã carrega **avelã**; glúten e leite alcançam quase todo o catálogo.
- **Proibido** alegação de saúde ou digestão — território regulado. Use formulação sensorial ("leve", "não pesa").
- **Schema.org:** `Restaurant` no site público **e `Product` + `Offer` em cada página de produto**.
  `Restaurant` sozinho alimenta features locais; é `Product`+`Offer` que gera o resultado de e-commerce com
  preço e disponibilidade. Preço e disponibilidade marcados são sempre os mesmos exibidos na tela
  (NAPO-003 RN9) — divergência é motivo de penalização, não de ranking.

---

## 8. Comportamento Esperado do Agente

### 8.1 Diretriz Principal

> **"Na dúvida, proteja os dados do usuário e pergunte antes de agir."**

### 8.2 Protocolo de Planejamento

- **Planos antes de código:** tarefas complexas exigem plano antes de codar
- **Socratic Gate:** requisito vago → perguntar antes de agir
- **Verificação Final:** mudanças executáveis só terminam com `lint`, `build` e `test` verdes; fluxos documentais usam o gate documental de `AGENTS.md`

### 8.3 Personas Dinâmicas (Contexto de Edição)

- Editando **Regras de Negócio** → **Product Engineer**: foco em valor e UX
- Editando **Auth/Middleware/RLS** → **Security Engineer**: paranoia total com validação
- Editando **UI/Componentes** → **Design Architect**: foco em estética premium
- Editando **Infra/DevOps** → **DevOps Engineer**: foco em estabilidade e automação
- Editando **`packages/core`** → **Domain Engineer**: nenhuma dependência externa entra; todo caminho tem teste determinístico

---

**Versão da Arquitetura:** 1.0.0
**Última Atualização:** 2026-08-10
