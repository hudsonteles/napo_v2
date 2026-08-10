# 🗺️ ROADMAP (Backlog) do Projeto: Napo

> 📋 **Convenções**
> - **Prefixo de ID deste projeto:** `NAPO`.
> - **Specs:** cada item aprovado vira pasta em `docs/specs/[ID]-[slug]/`. **Completo** (3 arquivos: `spec.md`, `design.md`, `tests.md`) por default; **lite** (1 arquivo `spec.md` com `Tipo: lite`) permitido para itens em 1 domínio não-sensíveis conforme `AGENTS.md` §3.1 (resumo: Esforço=Baixo qualquer MoSCoW, OU Esforço=Médio com MoSCoW≠Must, OU Esforço=Médio+Must em 1 domínio). Mudanças triviais (≤1 arquivo, sem RN nova, ≤30min) podem ir direto como **tweak** sem spec (ver `AGENTS.md` §3.0).
> - **IDs imutáveis:** o número não muda ao reordenar. A ordem é dada pela **posição na seção**, não pelo número.
> - **Como o agente atualiza este arquivo:** veja `AGENTS.md` §4 (movimentação entre seções, novos itens, dependências).
> - **Evoluir este backlog** (capturar ideias durante dev, promover, grooming): comandos `/ideia`, `/promover`, `/grooming`. Ver Fluxo 6 do guia em `oria-orquestrador-ia/ReadMe_GuiaOrquestracaoAgentes.md` e `AGENTS.md` §4.3.

> 📚 **Fontes de verdade deste backlog**
> - **Spec do R1:** [`docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`](docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md) — vence em qualquer conflito.
> - **Decisões por fase (R2+):** [`docs/roadmap-napo-decisoes.md`](docs/roadmap-napo-decisoes.md) — registro histórico, não é fila de trabalho.

---

## 🎯 Objetivo do MVP

*Descreva o menor produto que já resolve o problema central do usuário.*

Vender pizza congelada premium por canal próprio, com disponibilidade honesta e frete
que não mata a venda. O gargalo é o **forno**, não o mercado: a cozinha opera a 47% da
capacidade (303 de 650 pizzas/mês) e a ociosidade vale R$ 7.700/mês de margem — por
isso o canal de venda vem antes de qualquer módulo de operação.

Fecha o MVP (R1): site com catálogo e SEO, checkout com Mercado Pago, motor de
disponibilidade (cutoff derivado + dois tetos), frete por faixa, área do cliente,
admin de pedidos/estoque/custos, LGPD e auditoria.

---

## 🟢 Em Andamento (máx 2-3 itens simultâneos)

*Itens sendo trabalhados agora. O agente move de "Próximos" ao iniciar.*

*(Nenhum item em andamento — nada de código escrito ainda.)*

---

## 🟡 Próximos (Ordem importa — pegar de cima pra baixo)

*Próximos na fila, ordem definida. O agente promove o primeiro item para "Em Andamento" ao iniciar.*

- [ ] **NAPO-002** Autenticação, papéis e gate de telefone por WhatsApp
  - **Spec:** `docs/specs/002-auth-gate-telefone/` *(a criar)*
  - **Dependências:** NAPO-001
  - **Bloqueia:** NAPO-006, NAPO-007, NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** Magic Link **e** Google, para cliente e equipe, com `role` decidindo o destino. Trigger impedindo auto-atribuição de `role`; middleware protege rota, RLS protege dado. OTP no WhatsApp via API oficial (Meta/BSP), com expiração 5–10 min, 3–5 tentativas, rate limit por número, telefone único entre contas validadas e override de admin. **Sem fallback SMS** — risco aceito. Spec §7.

- [ ] **NAPO-003** Site público, catálogo e SEO
  - **Spec:** `docs/specs/003-site-catalogo/` *(a criar)*
  - **Dependências:** NAPO-001
  - **Bloqueia:** NAPO-006
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** storytelling estilo Apple sobre o eixo *"Longa fermentação. Forno italiano a 400°C. Em casa, só aquecer."* — o concorrente é a congelada de supermercado. Schema `Restaurant`, alérgenos e validade no catálogo (rotulagem ANVISA). Padrão visual preto/branco/amarelo. Spec §10 e §11.
  - **SEO permanece no R1 (decidido 2026-08-10):** avaliado adiar por receio de custo na Vercel e **descartado** — metadata, `sitemap.xml`, `robots.txt`, JSON-LD e URLs semânticas são texto no HTML que o build já gera; em página SSG servida do CDN o custo marginal é **zero**. Adiar não posterga custo, posterga receita: indexação de domínio novo leva semanas a meses, e trocar estrutura de URL depois exige mapa de 301 e descarta autoridade acumulada.
  - **Restrições de custo a respeitar na spec:** (a) `app/(site)/` fica **SSG com `revalidate` longo** — catálogo de pizza muda pouco, nada de SSR sem motivo; (b) decidir explicitamente se as fotos do ensaio (NAPO-020) passam pelo `next/image` ou vão **pré-otimizadas do Supabase Storage** — a cota de transformação de imagem é o custo real do catálogo, não o SEO.

- [ ] **NAPO-004** Motor de disponibilidade (calendário, cutoff, dois tetos)
  - **Spec:** `docs/specs/004-motor-disponibilidade/` *(a criar)*
  - **Dependências:** NAPO-001
  - **Bloqueia:** NAPO-006, NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** coração do R1. Agenda única de dias de entrega com cutoff **derivado** do piso de fermentação (nunca digitado); antes do cutoff CTP, depois só ATP; sabor esgotado oferece o próximo dia **com vaga real**. Horizonte de 2 semanas deslizantes (rolamento Opção B). Tetos do R1: `teto_forno_dia = 30` + `capacidade_freezer = 150`; sub-teto de massa (consome vaga de forno igual a uma pizza, mas rende R$ 7,21 contra R$ 20,82). Tabela de etapas nasce vazia no schema. Spec §5.

- [ ] **NAPO-005** Endereços e frete por faixa de distância
  - **Spec:** `docs/specs/005-enderecos-frete/` *(a criar)*
  - **Dependências:** NAPO-001
  - **Bloqueia:** NAPO-006
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** CEP → ViaCEP → geocoding → ajuste de pin. Faixas fixas (0–4 km R$6 · 4–8 km R$10 · 8–12 km R$14), frete grátis acima de R$ 150, raio de 12 km configurável + exceções de CEP. Distância **rodoviária** (Brasília tem o lago), calculada uma vez por endereço e gravada. Custo real de referência: R$ 9,60/entrega em rota de 10. Spec §6.

- [ ] **NAPO-006** Carrinho e checkout com Mercado Pago
  - **Spec:** `docs/specs/006-checkout/` *(a criar)*
  - **Dependências:** NAPO-002, NAPO-003, NAPO-004, NAPO-005
  - **Bloqueia:** NAPO-007
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** Pix, crédito e débito. **Pagamento online obrigatório no site** — um no-show não custa a viagem, custa uma vaga de 30. Snapshot de preço, custo e endereço no pedido (editar cadastro não pode reescrever histórico). Cancelamento devolve estoque; estorno é manual no painel MP. Spec §7.

---

## 🔵 Backlog (Priorizado mas flexível)

*Itens conhecidos sem ordem fixa. Reordenar conforme aprendizado e novas informações.*

### Fecham o R1

- [ ] **NAPO-007** Área do cliente (pedidos e endereços)
  - **Dependências:** NAPO-006
  - **Valor:** Médio · **Esforço:** Baixo · **MoSCoW:** Must
  - **Notas:** padrão de listagem do projeto: cards + busca + combobox de filtro + combobox de ordenação, com persistência ao navegar entre card e lista.

- [ ] **NAPO-008** Admin: pedidos, insumos/BOM, estoque, entregadores, custos e painel econômico
  - **Dependências:** NAPO-002, NAPO-004
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** provavelmente vira mais de uma spec. Inclui BOM de dois níveis (sub-receita de massa), ajuste de estoque **com motivo + auditoria** (sem isso o saldo projetado descola do real em semanas e o checkout passa a mentir), imposto e taxa de cartão na margem, fechamento de comissão por entregador, ponto de equilíbrio × ocupação de capacidade lado a lado, simulador de viabilidade de frete e segregação de receita por atividade fiscal. Spec §4, §12.

- [ ] **NAPO-009** LGPD e log de auditoria
  - **Dependências:** NAPO-001
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** termos, política de privacidade, banner, consentimento **versionado** (quando e qual versão foi aceita). Utilidade (OTP, aviso de entrega) é separada de marketing — validar o número não autoriza propaganda. Spec §8.

- [ ] **NAPO-021** Provisionar homologação e produção + primeiro deploy
  - **Dependências:** NAPO-001
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** desmembrado do NAPO-001 em 2026-08-10 por decisão de focar em desenvolvimento primeiro. Cria os dois projetos Supabase online (staging e prod — **2 ativos cabem no free tier**), conecta a Vercel, aponta o DNS de `napobsb.com.br` no Registro.br e roda o primeiro `db:push` de verdade. Dois pontos de atenção conhecidos: projeto free **pausa após ~7 dias sem atividade** (o CI tocando o banco a cada PR resolve), e produção no free não tem PITR — vira Pro (~US$ 25/mês) antes de faturar. **Quanto mais specs acumularem antes deste item, maior a superfície de surpresa de ambiente** (`docs/specs/001-fundacao/design.md` §8).

### R2 — Eventos

- [ ] **NAPO-010** Módulo de eventos (preparação)
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Should
  - **Notas:** o sistema **prepara** o evento, não o opera ao vivo — cada evento é um dossiê. Cálculo automático de insumos via proporção pessoa/pizza sobre o BOM, checklist de equipamentos, semáforo de prontidão, pipeline Orçamento→Confirmado→Em preparação→Pronto→Realizado→Pós-evento, precificação assistida, rentabilidade real vs. planejada, ordem de serviço exportável (BEO). Colisão evento × congelada resolve por *allocated ATP*: evento confirmado reserva, sistema sinaliza, humano libera manualmente. Ver `docs/roadmap-napo-decisoes.md` (Fase 4).

### R3 — Fiscal e cozinha

- [ ] **NAPO-011** Emissão fiscal de venda (NFC-e) via emissor de mercado
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Should
  - **Notas:** **comprar, não construir.** A costura já fica pronta no R1. Bloqueado externamente por NAPO-018 e NAPO-019.

- [ ] **NAPO-012** KDS (tela de cozinha)
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Should
  - **Notas:** fluxo principal da cozinha; papel só para via de expedição. Falta definir estratégia de degradação/offline.

- [ ] **NAPO-013** PDV local (venda de fresca)
  - **Dependências:** NAPO-012
  - **Valor:** Médio · **Esforço:** Alto · **MoSCoW:** Could
  - **Notas:** canal dentro do sistema unificado de pedidos, não app separado. PWA em tablet com fila offline-first — resolve também o "aguentar o rojão".

### R4 — Canais e automação

- [ ] **NAPO-014** Ingestão de pedidos iFood/99food via hub homologado
  - **Dependências:** NAPO-012
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Could
  - **Notas:** **comprar hub**, não virar integradora homologada. Sistema consome via API/webhook → cai no KDS e baixa estoque.

- [ ] **NAPO-015** Bot de comércio conversacional no WhatsApp
  - **Dependências:** NAPO-006, NAPO-010, NAPO-012
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Could
  - **Notas:** nova porta de entrada para o que já existe, não sistema novo. Modelo híbrido: **IA interpreta, SISTEMA decide** — todo número (estoque, preço, frete, prazo) vem do sistema, zero alucinação. Congelada fecha autônomo; evento vira lead no pipeline (precificação premium é curadoria humana); reclamação vai direto para humano. Reserva temporária de estoque durante a conversa (padrão 10 min). **Pagamento na entrega liberado só neste canal.**

- [ ] **NAPO-016** Comunicação em massa no WhatsApp (marketing)
  - **Dependências:** NAPO-009
  - **Valor:** Médio · **Esforço:** Médio · **MoSCoW:** Could
  - **Notas:** exige **opt-in explícito e separado** do consentimento de utilidade — categoria e custo próprios na API da Meta.

---

## 💡 Ideias (Sem priorização)

*Capturadas mas não avaliadas. Promover para Backlog após análise de valor/esforço.*

Adiadas no R1 **com o dado já capturado** (ligam depois sem migração):

- [ ] **Etiqueta de lote/validade para impressão** — rotulagem; o dado de lote já é gravado no R1. Registrado em 2026-08-10.
- [ ] **Contagem cíclica de inventário e registro de perdas** — ajuste manual com motivo cobre o R1. Registrado em 2026-08-10.
- [ ] **Capacidade por etapa-gargalo (modelo completo)** — Theory of Constraints por etapa (massa/fermentação, montagem, forno, congelamento); além de limitar venda, **diagnostica onde investir**. Adiado por falta de números medidos; a tabela de etapas já nasce no schema. Gatilho: quando houver medição real ou quando o segundo forno entrar em discussão. Registrado em 2026-08-10.
- [ ] **Roteirização automática do dia de entrega** — ~10 entregas/dia se organizam à mão. Gatilho: passar de ~25 entregas/dia. Registrado em 2026-08-10.

Ainda abertas, para as fases seguintes:

- [ ] **Migração dos dados atuais** (clientes, receitas, estoque) — precisa acontecer antes do go-live do R1. Registrado em 2026-08-10.
- [ ] **Conciliação de pagamentos** (Mercado Pago + Stone + repasses). Registrado em 2026-08-10.
- [ ] **Sinal/depósito e política de cancelamento de eventos** — o registro de decisões trata pagamento só no contexto de delivery. Registrado em 2026-08-10.
- [ ] **Conflito de agenda em eventos:** equipe e **equipamento** duplo-alocados. Registrado em 2026-08-10.
- [ ] **Cadastro de custo de equipe e deslocamento** — pré-requisito da precificação assistida de eventos (NAPO-010). Registrado em 2026-08-10.
- [ ] **Como um lead de evento entra no pipeline antes do bot existir** — hoje não há porta de entrada. Registrado em 2026-08-10.
- [ ] **Histórico de calote/no-show por cliente** — paraquedas para revisitar caso a caso a regra de pagamento na entrega do bot (NAPO-015). Registrado em 2026-08-10.
- [ ] **Resiliência offline e degradação do KDS** — o PDV resolve por fila offline-first, o KDS ainda não tem estratégia. Registrado em 2026-08-10.

---

## ⏸️ Bloqueados (Aguardando externo)

*Itens com bloqueio externo (espera de terceiro, decisão, dependência fora do controle).*

- [ ] **NAPO-017** Verificação da empresa na Meta (WhatsApp Business API)
  - **Bloqueado por:** processo de verificação da Meta — **bloqueia o login em produção** (NAPO-002 não sobe sem isso)
  - **Desde:** 2026-08-10

- [ ] **NAPO-018** Contador: anexo do Simples e atividade mista
  - **Bloqueado por:** definição do contador (congelado industrializado vs. fresca no balcão — o Simples exige a segregação na declaração mensal)
  - **Desde:** 2026-08-10

- [ ] **NAPO-019** Certificado digital A1
  - **Bloqueado por:** emissão junto à certificadora; pré-requisito da emissão fiscal (NAPO-011)
  - **Desde:** 2026-08-10

- [ ] **NAPO-020** Ensaio de fotografia dos produtos
  - **Bloqueado por:** agendamento com fotógrafo — o catálogo premium (NAPO-003) depende das imagens
  - **Desde:** 2026-08-10

---

## ✅ Concluídos

*Histórico — adicionar mais recentes NO TOPO.*

- [x] **Tooling: sincronia de banco entre máquinas** · concluído 2026-08-10 — git hooks versionados (`.githooks/post-merge` + `post-rewrite`) armados no `pnpm install`; todo `git pull` com migration nova roda `migration up` + regenera tipos no Supabase local. Degrada com aviso se o stack estiver desligado ou se uma migration foi reescrita (sugere `db:reset`). DevX, sem spec.
- [x] **NAPO-001** Fundação: monorepo, Next.js 15, Supabase local e CI · concluído 2026-08-10 · [`docs/specs/001-fundacao/`](docs/specs/001-fundacao/)
  - Monorepo pnpm (`apps/web` + `packages/core|db|ui`), `packages/core` puro garantido por lint. Migrations `0001/0002` com RLS deny-by-default, enum de role e trigger anti-auto-promoção (validado por pgTAP). `env.ts` (Zod) mantendo `service_role` fora do browser, helper `tempo.ts` fixado em `America/Sao_Paulo`, CI em dois jobs. Publicação (staging/prod) permanece em NAPO-021.
- [x] **Setup do kit ORIA no projeto** · concluído 2026-08-10
- [x] **Spec do R1 (e-commerce) escrita e revisada** · concluído 2026-08-10 · `docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`

---

## ❌ Cancelados

*Itens descartados. IDs permanecem reservados (não reciclar).*

*(Sem itens cancelados. Duas propostas foram rejeitadas antes de virar item de backlog e estão documentadas em `docs/roadmap-napo-decisoes.md`: a fórmula de frete `km × 2 ÷ qtd` — cobrava R$ 38,40 numa pizza a 12 km — e virar integradora homologada de iFood/99food.)*

---

## 📊 Legenda de Seções

| Seção | Significado | Quem move |
|---|---|---|
| 🟢 Em Andamento | Trabalho ativo agora (máx 2-3) | Agente ao iniciar |
| 🟡 Próximos | Ordem definida, próximos na fila | Humano prioriza |
| 🔵 Backlog | Conhecidos, prioridade flexível | Humano ou agente |
| 💡 Ideias | Brutas, não avaliadas | Qualquer um adiciona |
| ⏸️ Bloqueados | Esperando externo | Agente move quando bloqueio externo é confirmado |
| ✅ Concluídos | Histórico (mais recentes no topo) | Agente ao concluir spec |
| ❌ Cancelados | Descartados | Humano decide |
