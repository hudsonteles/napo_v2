# 📋 Spec: Motor de disponibilidade (calendário, cutoff, dois tetos)

**ID:** NAPO-004
**Status:** Em Execução
**Responsável:** Hudson
**Data:** 2026-08-10
**Item no Roadmap:** NAPO-004

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.

---

## 1. Visão Geral (User Stories)

> **Como** cliente, **eu quero** ver em que dia a minha pizza chega antes de pagar, **para que** eu não descubra depois que o dia prometido não existia.

> **Como** cliente, **eu quero** que a pizza que escolhi continue minha enquanto eu pago, **para que** eu não pague por algo que outra pessoa levou no meio do caminho.

> **Como** gerente, **eu quero** configurar dias de entrega, dias de produção e tetos sem pedir alteração de código, **para que** a operação real mande no sistema, e não o contrário.

> **Como** gerente, **eu quero** decidir caso a caso o que fazer com um pedido que ficou sem dia viável, **para que** nem toda exceção vire estorno automático.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] **Zero pedido pago sem dia de entrega viável** — a métrica que justifica o módulo existir.
- [ ] Ocupação do teto diário visível e comparável contra as 303 pizzas/mês atuais (rumo às 650 de capacidade).
- [ ] Nenhuma venda perdida por dia "esgotado" quando existe vaga real em dia seguinte dentro do horizonte.

---

## 3. Regras de Negócio Obrigatórias

**Calendário e cutoff**

- **RN1:** O cutoff de um dia de entrega `D` é **derivado, nunca digitado**: `cutoff(D) = (D + janela_inicio(D)) − tempo_preparo_horas`.
- **RN2:** Se o cutoff calculado cair em dia sem produção, ele **recua** até o último dia de produção válido. Recuar corta a venda mais cedo; avançar prometeria o que não se consegue produzir.
- **RN3:** Dias de entrega, janela de entrega, dias de produção e exceções de calendário (feriado, sem produção, entrega extra) são **configuráveis pelo admin**. Nenhum deles é constante em código.
- **RN4:** Um dia `D` deixa de ser oferecido quando faltam menos de `buffer_cutoff_min` para o seu cutoff. O buffer evita que o cliente entre no pagamento com o relógio já contra ele.
- **RN5:** Toda decisão de data passa pelo helper único de `America/Sao_Paulo` (`packages/core`). Nenhum cálculo de cutoff ou dia de entrega acontece fora dele.

**Disponibilidade**

- **RN6:** Antes do cutoff de `D`, a promessa é **CTP**: `estoque_alocável + capacidade_restante(D)`. Depois do cutoff, é **ATP**: apenas lotes já prontos alocados para `D`.
- **RN7:** `capacidade_restante(D)` respeita **dois tetos**: o de forno limita o fluxo diário (`teto_forno_dia × dias de produção até D − já planejado`) e o de freezer limita o **acúmulo** (`capacidade_freezer − pico de saldo projetado até D`). Vale o menor dos dois.
- **RN8:** Massa é limitada a `sub_teto_massa_dia` por dia de entrega e **sai do catálogo daquele dia** quando a ocupação passa de `limite_ocupacao_massa_pct` — a vaga fica preservada para pizza, que rende R$ 20,82 contra R$ 7,21.
- **RN9:** Quando um produto esgota para `D`, o sistema oferece **o próximo dia de entrega com vaga real**, herdando a capacidade daquele dia — nunca um dia igualmente lotado.
- **RN10:** A quantidade restante exibida é a **real**, calculada no momento da consulta. Disponibilidade nunca é servida de cache estático.

**Reserva e conflito**

- **RN11:** Ao iniciar o pagamento, os itens ficam **reservados por `reserva_minutos`** (padrão 15) e saem da disponibilidade do dia. A reserva **expira sozinha** se o pagamento não confirmar.
- **RN12:** Se, na confirmação do pagamento, o dia deixou de ser viável (cutoff vencido ou vaga perdida), o pedido é marcado como **conflito de disponibilidade** e não é confirmado silenciosamente. O gerente decide entre realocar e estornar — **o sistema não escolhe sozinho**.
- **RN13:** Cancelamento devolve **conforme a fase**: antes do cutoff devolve capacidade do dia (nada foi produzido); depois do cutoff devolve o lote pronto ao estoque alocável, se ainda dentro da validade.
- **RN14:** Lote liberado por perda ou reprogramação volta a ser visível para o motor na consulta seguinte — sem intervenção manual no cálculo.

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário | Ação do Usuário | Resposta do Sistema |
|---|---|---|
| Cutoff vence durante o pagamento | Paga depois do cutoff do dia escolhido | Pedido marcado como conflito de disponibilidade; cliente informado de que está em revisão; gerente decide realocar ou estornar (RN12) |
| Última vaga disputada | Dois clientes pagam quase juntos | O primeiro a iniciar o pagamento tem a reserva; o segundo não chega a pagar, porque o dia já saiu da vitrine (RN11) |
| Reserva expira | Abandona o checkout | Itens voltam para a disponibilidade do dia automaticamente, sem ação humana |
| Nenhum dia viável no horizonte | Tenta comprar | Vitrine informa que não há data disponível e não oferece checkout — em vez de aceitar e resolver depois |
| Dia sem produção no caminho do cutoff | — | Cutoff recua para o último dia de produção válido (RN2) |
| Produção falhou depois do pedido pago | — | Gerente registra a perda no admin (NAPO-008); o motor recalcula e o pedido afetado entra em conflito de disponibilidade |
| Exceção de calendário criada com pedidos já aceitos | Gerente marca o dia como sem entrega | Sistema lista os pedidos afetados antes de confirmar a mudança; não apaga promessa silenciosamente |

---

## 5. Não-Objetivos (Fora do Escopo)

- **Não tem UI.** Vitrine, calendário de escolha e badge de escassez são NAPO-003; a tela de checkout é NAPO-006. Este spec entrega o motor e o contrato que elas consomem.
- **Não gerencia estoque.** `movimentos_estoque`, ajuste com motivo, auditoria e a tela de perdas são NAPO-008. Aqui existem apenas as tabelas que o motor **lê** (`lotes`, `producao_planejada`).
- **Não decide sozinho o destino de pedido em conflito** — apenas detecta e marca (RN12).
- **Não estorna.** Estorno é manual no painel do Mercado Pago, conforme spec do R1.
- **Não trata eventos.** Sinal, contrato e reserva de data de evento são NAPO-010 (R2).
- **Não implementa capacidade por etapa-gargalo.** Teto simples por dia + teto de freezer, conforme decidido na spec do R1 §2.
- **Não faz roteirização nem cálculo de frete** (NAPO-005).

---

## 6. Dependências de Negócio

- **NAPO-001** (fundação) — concluído.
- Valores iniciais de operação confirmados com o PM em 2026-08-10: **entrega apenas na sexta**, **produção de segunda a sexta**, ambos editáveis no admin.
- Consumidores futuros: NAPO-003 (vitrine), NAPO-006 (checkout), NAPO-008 (admin de capacidade e estoque).

---

## 7. Observações e Decisões de Negócio

- **Entrega em um único dia torna o freezer a restrição dominante.** Com produção de segunda a sexta e entrega só na sexta, o acúmulo de 5 dias (30 × 5 = 150) bate exatamente na capacidade do freezer. O teto de forno só passa a mandar se a operação abrir um segundo dia de entrega. É por isso que RN7 tem dois tetos e não um.
- **Horizonte de 2 semanas deslizantes** significa, com um dia de entrega por semana, **duas datas visíveis** ao cliente. Se a conversão sofrer por falta de opção, o caminho é abrir dia de entrega no admin — não alargar o horizonte.
- **A reserva de 15 min foi escolhida sabendo que ela pode segurar vaga de quem desistiu.** O custo é vaga ociosa por até 15 min; o benefício é nenhum cliente pagar por pizza que outro levou. Com teto de 30 e um dia de entrega, o segundo risco é concreto e o primeiro é irrelevante.
- **Conflito de disponibilidade é decisão humana por escolha explícita do PM.** Realocar automaticamente seria mais barato de construir, mas trata igual um cliente que aceita esperar e um que comprou para uma data específica.
- **Premissa em aberto:** a janela de entrega da sexta (hora inicial e final) ainda não foi definida. Ela entra no cálculo do cutoff via RN1 — enquanto não houver decisão, o seed assume **17h–21h**, editável no admin sem migration.

---

## 8. Aprovação

- [x] **Spec revisado e aprovado por:** Hudson / 2026-08-10
- [x] **Design técnico criado** (`design.md`)
- [x] **Critérios de teste criados** (`tests.md`)
- [x] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
