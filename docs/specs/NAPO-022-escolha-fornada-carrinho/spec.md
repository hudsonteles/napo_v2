# 📋 Spec: Escolher/adiar a fornada de entrega no carrinho

**ID:** NAPO-022
**Status:** Aprovado
**Responsável:** Hudson
**Data:** 2026-08-28
**Item no Roadmap:** NAPO-022

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.
>
> **Revisão de regra estrutural aprovada:** este spec estende a RN2 do NAPO-006, conforme
> [`docs/adr/0001-dia-de-entrega-selecionavel-no-carrinho.md`](../../adr/0001-dia-de-entrega-selecionavel-no-carrinho.md) (ADR-0001, Aceito 2026-08-28).

---

## 1. Visão Geral (User Stories)

> **Como** cliente montando um carrinho, **eu quero** escolher um dia de entrega mais tarde do que o dia calculado automaticamente, **para que** eu consiga acomodar a entrega à minha agenda sem precisar refazer o pedido do zero.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] Reduzir o número de pedidos cancelados/reagendados por fora do sistema (hoje sem instrumentação — medir após lançamento).
- [ ] Diferencial competitivo: flexibilidade de data sem perder a garantia de "uma sacola, um frete, uma viagem" do NAPO-006.

---

## 3. Regras de Negócio Obrigatórias

- **RN1 — O dia derivado continua sendo o padrão.** Sem escolha explícita, o comportamento do NAPO-006 permanece: dia mais tardio entre os itens do carrinho.

- **RN2 — O cliente só pode ADIAR, nunca antecipar.** O dia candidato proposto pelo cliente (no carrinho/checkout, antes de pagar) nunca pode ser anterior ao dia derivado automaticamente — isso preserva a garantia original da RN2 do NAPO-006 (nenhum item é excluído da sacola por causa da escolha de data).

- **RN3 — Dia candidato é validado por interseção de disponibilidade de todos os itens.** O servidor calcula, para o dia proposto, se **todos** os itens do carrinho têm vaga (mesma lógica do motor de disponibilidade, NAPO-004/NAPO-023). Se **qualquer** item não couber, o pedido inteiro é rejeitado — nunca remove item, nunca ajusta o dia por conta própria (herda o princípio da RN3 original do NAPO-006: valor pronto do cliente nunca é aceito sem validação do servidor).

- **RN4 — A escolha só vale antes de pagar.** Uma vez que o pedido é criado e a reserva feita (fluxo do NAPO-006), o dia já está fixado; este spec não reabre pedido existente (ver Não-Objetivos e NAPO-025).

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário | Ação do Usuário | Resposta do Sistema |
|---|---|---|
| Cliente escolhe dia em que 1+ itens não cabem | Confirma dia candidato no carrinho/checkout | Pedido inteiro rejeitado; UI lista **quais itens** não cabem no dia escolhido (não é erro genérico) |
| Cliente tenta antecipar o dia (antes do derivado) | Escolhe data anterior à calculada | Recusado antes de validar disponibilidade — mensagem explica que só é possível adiar |
| Cliente escolhe dia cujo cutoff já passou | Confirma dia candidato | Recusado — mesma mensagem de cutoff vencido já usada no fluxo de checkout |
| Carrinho muda depois da escolha (item removido/adicionado) | Edita carrinho após escolher o dia | Dia candidato é revalidado contra o carrinho atual; se deixar de servir, volta ao padrão (dia derivado) com aviso |

---

## 5. Não-Objetivos (Fora do Escopo)

- Não permite editar itens ou endereço junto com a escolha de dia (fluxo isolado, só data, dentro do carrinho).
- **Não cobre pedido já pago.** Trocar o dia de um pedido pago (pelo cliente ou pelo admin) exige superfícies que ainda não existem — área do cliente (NAPO-007) e admin de pedidos (NAPO-008) — e virou item novo de backlog: **NAPO-025**, dependente deste spec, do NAPO-007 e do NAPO-008.
- Não resolve a comunicação de disponibilidade por sabor vs. teto compartilhado (isso é NAPO-023 — este spec apenas consome o cálculo de disponibilidade existente/estendido por ele).

---

## 6. Dependências de Negócio

- **NAPO-006** (carrinho e checkout) — concluído. Fornece a reserva, a RN2 original e o cálculo de dia que este spec estende.
- **NAPO-004** (motor de disponibilidade) — concluído. Fornece o cálculo de disponibilidade por dia que a validação de interseção reutiliza.
- **ADR-0001** — Aceito. Autoriza a revisão da RN2 do NAPO-006.

---

## 7. Observações e Decisões de Negócio

- **Só adiar, nunca antecipar (RN2):** decisão deliberada para não reabrir o risco que a RN2 original do NAPO-006 evitava — antecipar poderia obrigar a excluir item da sacola, e a "levar tudo para outra fornada" já foi rejeitada no Gate Visual A do NAPO-006 por poder falhar de novo.
- **Escopo reduzido a pré-pagamento (RN4):** durante o diagnóstico técnico, descobrimos que nem a área do cliente (NAPO-007) nem o admin de pedidos (NAPO-008) existem ainda — não há tela onde expor a troca de dia de um pedido já pago. Reescopar para "só carrinho" evita construir API sem consumidor real. A troca pós-pagamento (cliente e admin, com auditoria, atomicidade de reserva e notificação) foi capturada como **NAPO-025** para nascer junto com o NAPO-007/NAPO-008, reaproveitando a função pura de validação de dia (`validarDiaCandidato`) criada aqui.

---

## 8. Aprovação

- [x] **Spec revisado e aprovado por:** Hudson / 2026-08-28
- [x] **Design técnico criado** (`design.md`)
- [x] **Critérios de teste criados** (`tests.md`)
- [x] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
