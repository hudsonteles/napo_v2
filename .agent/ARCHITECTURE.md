# Antigravity Kit Architecture — edição Napo

> Kit de expansão de capacidade para agentes de IA, **podado para o stack do Napo**
> (Next.js 15 App Router + Supabase/Postgres + Tailwind, e-commerce com SEO local).

> ✂️ **Este kit foi podado.** O original tem 20 agentes, 36 skills e 11 workflows.
> Aqui ficaram **17 agentes, 29 skills e 10 workflows**. O que saiu e por quê está
> em "O que foi podado" no fim deste arquivo. O kit completo continua disponível em
> `oria-orquestrador-ia/.agent/` — para recuperar qualquer peça, copie de lá.

---

## 📋 Overview

- **17 Specialist Agents** - Role-based AI personas
- **29 Skills** - Domain-specific knowledge modules
- **10 Workflows** - Slash command procedures

---

## 🏗️ Directory Structure

```plaintext
.agent/
├── ARCHITECTURE.md          # This file
├── agents/                  # 17 Specialist Agents
├── skills/                  # 29 Skills
├── workflows/               # 10 Slash Commands
├── rules/                   # Global Rules
└── scripts/                 # Master Validation Scripts
```

---

## 🤖 Agents (17)

Specialist AI personas for different domains.

| Agent | Focus | Skills Used |
| ----- | ----- | ----------- |
| `orchestrator` | Multi-agent coordination | parallel-agents, behavioral-modes |
| `project-planner` | Discovery, task planning | brainstorming, plan-writing, architecture |
| `frontend-specialist` | Web UI/UX | frontend-design, nextjs-react-expert, tailwind-patterns |
| `backend-specialist` | API, business logic | api-patterns, nodejs-best-practices, database-design |
| `database-architect` | Schema, SQL | database-design |
| `devops-engineer` | CI/CD, deploy | deployment-procedures |
| `security-auditor` | Security compliance | vulnerability-scanner |
| `test-engineer` | Testing strategies | testing-patterns, tdd-workflow, webapp-testing |
| `debugger` | Root cause analysis | systematic-debugging |
| `performance-optimizer` | Speed, Web Vitals | performance-profiling |
| `seo-specialist` | Ranking, visibility | seo-fundamentals, geo-fundamentals |
| `documentation-writer` | Manuals, docs | documentation-templates |
| `product-manager` | Requirements, user stories | plan-writing, brainstorming |
| `product-owner` | Strategy, backlog, MVP | plan-writing, brainstorming |
| `qa-automation-engineer` | E2E testing, CI pipelines | webapp-testing, testing-patterns |
| `code-archaeologist` | Legacy code, refactoring | clean-code, code-review-checklist |
| `explorer-agent` | Codebase analysis | - |

---

## 🧩 Skills (29)

Modular knowledge domains that agents can load on-demand, based on task context.

### Frontend & UI

| Skill | Description |
| ----- | ----------- |
| `nextjs-react-expert` | React & Next.js performance optimization (Vercel - 57 rules) |
| `web-design-guidelines` | Web UI audit - 100+ rules for accessibility, UX, performance (Vercel) |
| `tailwind-patterns` | Tailwind CSS v4 utilities |
| `frontend-design` | UI/UX patterns, design systems |

### Backend & API

| Skill | Description |
| ----- | ----------- |
| `api-patterns` | REST, GraphQL, tRPC |
| `nodejs-best-practices` | Node.js async, modules |

### Database

| Skill | Description |
| ----- | ----------- |
| `database-design` | Schema design, optimization |

### Cloud & Infrastructure

| Skill | Description |
| ----- | ----------- |
| `deployment-procedures` | CI/CD, deploy workflows |

### Testing & Quality

| Skill | Description |
| ----- | ----------- |
| `testing-patterns` | Jest, Vitest, strategies |
| `webapp-testing` | E2E, Playwright |
| `tdd-workflow` | Test-driven development |
| `code-review-checklist` | Code review standards |
| `lint-and-validate` | Linting, validation |

### Security

| Skill | Description |
| ----- | ----------- |
| `vulnerability-scanner` | Security auditing, OWASP |

### Architecture & Planning

| Skill | Description |
| ----- | ----------- |
| `app-builder` | Full-stack app scaffolding (3 templates: nextjs-fullstack, nextjs-saas, monorepo-turborepo) |
| `architecture` | System design patterns |
| `plan-writing` | Task planning, breakdown |
| `brainstorming` | Socratic questioning |

### SEO & Growth

| Skill | Description |
| ----- | ----------- |
| `seo-fundamentals` | SEO, E-E-A-T, Core Web Vitals |
| `geo-fundamentals` | GenAI optimization |

### Shell/CLI

| Skill | Description |
| ----- | ----------- |
| `bash-linux` | Linux commands, scripting (CI) |
| `powershell-windows` | Windows PowerShell (máquina de dev) |

### Other

| Skill | Description |
| ----- | ----------- |
| `clean-code` | Coding standards (Global) |
| `behavioral-modes` | Agent personas |
| `parallel-agents` | Multi-agent patterns |
| `intelligent-routing` | Roteamento de agentes/skills |
| `documentation-templates` | Doc formats |
| `performance-profiling` | Web Vitals, optimization |
| `systematic-debugging` | Troubleshooting |

---

## 🔄 Workflows (10)

Slash command procedures. Invoke with `/command`.

| Command | Description |
| ------- | ----------- |
| `/brainstorm` | Socratic discovery |
| `/create` | Create new features |
| `/debug` | Debug issues |
| `/deploy` | Deploy application |
| `/enhance` | Improve existing code |
| `/orchestrate` | Multi-agent coordination |
| `/plan` | Task breakdown |
| `/preview` | Preview changes |
| `/status` | Check project status |
| `/test` | Run tests |

---

## 🎯 Skill Loading Protocol

```plaintext
User Request → Skill Description Match → Load SKILL.md
                                            ↓
                                    Read references/
                                            ↓
                                    Read scripts/
```

### Skill Structure

```plaintext
skill-name/
├── SKILL.md           # (Required) Metadata & instructions
├── scripts/           # (Optional) Python/Bash scripts
├── references/        # (Optional) Templates, docs
└── assets/            # (Optional) Images, logos
```

---

## 🔧 Scripts (2)

Master validation scripts that orchestrate skill-level scripts.

| Script | Purpose | When to Use |
| ------ | ------- | ----------- |
| `checklist.py` | Priority-based validation (Core checks) | Development, pre-commit |
| `verify_all.py` | Comprehensive verification (All checks) | Pre-deployment, releases |

### Usage

```bash
# Quick validation during development
python .agent/scripts/checklist.py .

# Full verification before deployment
python .agent/scripts/verify_all.py . --url http://localhost:3000
```

### What They Check

**checklist.py** (Core checks): Security · Code Quality · Schema Validation ·
Test Suite · UX Audit · SEO Check

**verify_all.py** (Full suite): tudo do `checklist.py` mais Lighthouse (Core Web
Vitals), Playwright E2E e Bundle Analysis.

> Ambos pulam graciosamente qualquer script ausente (`Script not found, skipping`).

---

## ✂️ O que foi podado (e por quê)

Critério: sai o que é **impossível de usar neste stack**, não o que é "menos
provável". Tudo continua em `oria-orquestrador-ia/.agent/`.

| Removido | Tipo | Motivo |
| -------- | ---- | ------ |
| `mobile-developer`, `mobile-design` | agente + skill | Napo é web. O PDV em tablet é PWA — `frontend-specialist` cobre. `AGENTS.md` §10.3.6 já proibia `mobile-developer` em app web. |
| `game-developer`, `game-development` | agente + skill | Não há jogo. 11 sub-skills (VR/AR, multiplayer, game-audio…). |
| `penetration-tester`, `red-team-tactics` | agente + skill | Segurança ofensiva. A defensiva (RLS, OWASP, LGPD) fica com `security-auditor` + `vulnerability-scanner`. |
| `python-patterns` | skill | Produto é TypeScript. Os scripts `.py` do próprio kit são ferramenta, não código do produto. |
| `mcp-builder` | skill | Não construímos servidores MCP. |
| `i18n-localization` | skill | Locale único pt-BR, entrega em raio de 12 km em Brasília. |
| `server-management` | skill | Infra gerenciada (Vercel + Supabase); não há servidor para administrar. |
| `ui-ux-pro-max` (`.shared/`) | skill | 24 CSVs de 50 estilos / 21 paletas / 50 fontes para escolher identidade visual. A do Napo já está fechada: preto, branco e amarelo, referência Apple. |
| 10 templates de `app-builder` | templates | astro, chrome-extension, cli-tool, electron, express, flutter, nextjs-static, nuxt, fastapi, react-native. Sobraram `nextjs-fullstack`, `nextjs-saas` e `monorepo-turborepo`. |
| `/ui-ux-pro-max` | workflow | Depende da skill removida. |

Também foram corrigidas referências **já quebradas no kit original**: as skills
`prisma-expert`, `typescript-expert`, `docker-expert`, `nestjs-expert` e
`refactoring-patterns` eram citadas mas nunca existiram em disco, e
`intelligent-routing` existia sem estar listada.

---

## 🔗 Quick Reference

| Need | Agent | Skills |
| ---- | ----- | ------ |
| Web App | `frontend-specialist` | nextjs-react-expert, frontend-design, tailwind-patterns |
| API | `backend-specialist` | api-patterns, nodejs-best-practices |
| Database | `database-architect` | database-design |
| Security | `security-auditor` | vulnerability-scanner |
| Testing | `test-engineer` | testing-patterns, webapp-testing, tdd-workflow |
| Debug | `debugger` | systematic-debugging |
| SEO | `seo-specialist` | seo-fundamentals, geo-fundamentals |
| Plan | `project-planner` | brainstorming, plan-writing |
