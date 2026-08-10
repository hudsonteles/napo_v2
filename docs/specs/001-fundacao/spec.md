# 📋 Spec: Fundação — monorepo, Next.js 15, Supabase local e CI

**ID:** NAPO-001
**Status:** Concluído
**Responsável:** Hudson
**Data:** 2026-08-10
**Item no Roadmap:** NAPO-001

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.

---

## 1. Visão Geral (User Stories)

> **Como** desenvolvedor do Napo, **eu quero** clonar o repositório e subir o projeto inteiro com um comando, **para que** eu comece a escrever regra de negócio no mesmo dia — sem gastar a primeira semana montando ambiente.

> **Como** dono do negócio, **eu quero** que o sistema seja incapaz de subir uma tabela sem controle de acesso, **para que** o dado do cliente não vaze por esquecimento de alguém num sábado à noite.

> **Como** desenvolvedor, **eu quero** que o CI reprove o que quebra as regras da arquitetura, **para que** a disciplina não dependa de eu lembrar dela em cada pull request.

**O valor real deste item não é código de produto — é remover a chance de erro estrutural das oito specs seguintes.** NAPO-002 a NAPO-009 herdam tudo que for decidido aqui, certo ou errado.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] Um desenvolvedor novo vai de `git clone` a aplicação rodando em **≤ 15 minutos**, seguindo um único comando documentado
- [ ] **100% das tabelas** do schema `public` com RLS habilitada — medido por teste automático, não por inspeção
- [ ] CI completo em **≤ 5 minutos** (acima disso, as pessoas começam a burlar)
- [ ] **Zero** alteração de banco fora de migration versionada

---

## 3. Regras de Negócio Obrigatórias

- **RN1:** Toda tabela do schema `public` **DEVE** ter RLS habilitada e ao menos uma política declarada. Uma tabela sem política é uma falha de build, não um aviso.
- **RN2:** Nenhum usuário pode alterar a própria `role`. Alteração de `role` só é aceita quando o autor é `admin` ou o processo é de servidor confiável. A proibição vive **no banco**, não na aplicação.
- **RN3:** A chave `service_role` **nunca** é exposta ao browser — só existe em código de servidor.
- **RN4:** Toda alteração de estrutura de banco acontece por **migration versionada** em `supabase/migrations/`. Alteração manual pelo Studio não é fonte de verdade e não sobrevive ao próximo `db reset`.
- **RN5:** A aplicação **não inicia** se qualquer variável de ambiente obrigatória estiver ausente ou malformada. Falha barulhenta na inicialização, nunca erro silencioso em runtime.
- **RN6:** Toda decisão de data de negócio passa por um **único helper** em `packages/core` fixado em `America/Sao_Paulo`. Nenhum cálculo de dia de entrega ou cutoff pode usar data do sistema diretamente.
- **RN7:** `packages/core` **não importa** React, não importa Supabase e não faz HTTP. Violação reprova no CI.
- **RN8:** O CI reprova o pull request se typecheck, lint, testes ou validação de migration falharem.
- **RN9:** Os tipos TypeScript gerados do banco devem estar **sincronizados com as migrations**. Divergência (drift) reprova o CI — tipo desatualizado faz o compilador mentir.
- **RN10:** Versões de Node e pnpm são **fixadas no repositório** e o CI usa exatamente as mesmas.

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário                             | Ação                   | Resposta do Sistema                                                                                                            |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Docker não está rodando             | `pnpm dev`             | Mensagem explícita: "Docker Desktop precisa estar ativo — rode `supabase start`". Não tenta conectar em produção como fallback |
| Variável de ambiente faltando       | Iniciar app            | Erro na inicialização listando **quais** variáveis faltam. App não sobe                                                        |
| Migration falha ao aplicar          | `pnpm db:migrate`      | Aborta, preserva o estado anterior, imprime o SQL que falhou                                                                   |
| Tabela criada sem RLS               | Abrir PR               | Teste `rls_enabled` falha, CI vermelho, merge bloqueado                                                                        |
| Tipos gerados desatualizados        | Abrir PR               | CI falha indicando que falta rodar a geração de tipos                                                                          |
| Tentativa de alterar a própria role | `UPDATE` em `profiles` | Banco rejeita via trigger, com mensagem de erro clara. Nada é persistido                                                       |

---

## 5. Não-Objetivos (Fora do Escopo)

**Adiado por decisão do PM em 2026-08-10 — foco em desenvolvimento primeiro:**

- **Não provisiona** os projetos Supabase de homologação e produção
- **Não conecta** Vercel, DNS ou o domínio `napobsb.com.br`
- **Não executa** nenhum deploy — os scripts de deploy são escritos e validados a seco, mas nunca disparados

**Fora do escopo por pertencer a outra spec:**

- Login, Magic Link, Google OAuth e OTP de WhatsApp → NAPO-002
- Site, catálogo, SEO e identidade visual → NAPO-003
- Qualquer tabela de domínio (produtos, pedidos, capacidade, insumos) → NAPO-004 em diante

**Fora do escopo por decisão técnica:**

- **Turborepo** — pnpm workspaces basta até o build doer (spec do R1 §3)
- **Hooks de pre-commit** (husky/lint-staged) — atrito desproporcional para um time pequeno; o CI cobre
- **Design da página inicial** — a tela deste spec é crua e descartável, só prova que o app roda

---

## 6. Dependências de Negócio

- **Docker Desktop com backend WSL2** instalado na máquina de desenvolvimento — sem isso não há banco local e a RN1 não é testável
- Nenhuma dependência de terceiro, conta paga ou providência externa. **Este item pode começar hoje**

---

## 7. Observações e Decisões de Negócio

- **Publicação adiada (2026-08-10):** o PM optou por focar em desenvolvimento antes de subir qualquer ambiente. A consequência aceita é que problemas de ambiente aparecerão mais tarde. A mitigação é que o código nasce **capaz** de multi-ambiente — variáveis separadas, migrations versionadas, scripts de deploy escritos — de modo que provisionar depois seja configuração, não refatoração.
- **pgTAP em vez de Vitest para RLS:** a spec do R1 §9 previa Vitest. Benchmarking mostrou que `supabase test db` com pgTAP roda dentro do Postgres e traz `tests.rls_enabled('public')`, que reprova se _qualquer_ tabela estiver sem política. Isso converte a RN1 de disciplina humana em verificação mecânica. Vitest continua sendo a ferramenta de `packages/core`.
- **`profiles` entra agora, embora login seja NAPO-002:** sem ao menos uma tabela real com role e política, não há como provar que RLS e o trigger funcionam. Entra a espinha — identidade e papel — e nada mais.
- **A tela é descartável de propósito:** existe para provar que Next.js, Supabase e o build conversam. O contrato visual do projeto nasce no NAPO-003, e é lá que o Gate Visual será exercido pela primeira vez.

---

## 8. Aprovação

- [x] **Spec revisado e aprovado por:** Hudson / 2026-08-10
- [x] **Design técnico criado** (`design.md`)
- [x] **Critérios de teste criados** (`tests.md`)
- [x] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
