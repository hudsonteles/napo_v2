# 0001. Dia de entrega do carrinho passa a admitir escolha validada do cliente

---

**Status:** Aceito
**Data:** 2026-08-28
**Decisor(es):** PM do projeto Napo
**Disparado por:** Item NAPO-022 do ROADMAP — pré-requisito de ADR (contradiz RN2/RN3 do spec aprovado do NAPO-006)

---

## Contexto

O NAPO-006 (Carrinho e checkout com Mercado Pago, concluído em 2026-08-19) fixou duas regras de negócio:

- **RN2 — "Um pedido, um dia de entrega."** Se os sabores do carrinho têm primeiros dias viáveis diferentes, o pedido inteiro vai para o dia **mais tardio** entre eles. O dia é **derivado no servidor**, nunca escolhido.
- **RN3 — "O total é decidido no servidor."** O cliente envia produtos e quantidades; preço, frete e total (e, por extensão, o dia) são recalculados no servidor — valor que chega pronto do navegador é valor que o cliente escolhe, e a arquitetura trata isso como superfície de fraude a fechar.

O item NAPO-022 pede que o PM possa **escolher/adiar a data de entrega do carrinho inteiro**, com validação — motivado por observação de uso durante o Gate Visual B do NAPO-006 (bloco I). Isso contradiz a leitura literal da RN2 ("o dia é derivado, não escolhido") e passa a expor o dia como algo que o cliente influencia, o que roça a RN3.

Referências:
- Spec afetada: `docs/specs/006-checkout/spec.md` (RN2, RN3, RN18)
- Item do ROADMAP afetado: NAPO-022
- Código afetado (mapeado nas notas do NAPO-022): `packages/core` (resolução do dia), `reservar_carrinho` (reserva por advisory lock), rotas `POST /api/pedidos` e `POST /api/carrinho/validar`

---

## Decisão

A RN2 passa a ter dois modos, ambos resolvidos e validados no servidor — nunca aceitos como valor pronto do cliente (RN3 permanece intacta):

1. **Modo padrão (sem escolha explícita):** comportamento atual — o servidor deriva o dia mais tardio entre os itens do carrinho.
2. **Modo escolha explícita (novo):** o cliente pode enviar um **dia candidato**. O servidor calcula a **interseção de disponibilidade de todos os itens do carrinho** para esse dia; se **todos** os itens couberem, o pedido é confirmado nesse dia. Se **qualquer** item não couber, o servidor **rejeita o pedido inteiro** com um erro explícito (nunca remove item silenciosamente, nunca ajusta o dia por conta própria).

O dia final continua sendo, em ambos os modos, um valor **calculado e validado no servidor** — o cliente propõe, o servidor decide. `reservar_carrinho` passa a receber o dia resolvido (derivado ou escolhido-e-validado) da mesma forma, sem distinção na camada de reserva.

RN2 do `docs/specs/006-checkout/spec.md` será reescrita para refletir os dois modos; RN3 permanece sem alteração de texto (já cobre o novo modo por extensão natural: "total e demais valores derivados" passam a incluir "dia").

---

## Alternativas consideradas

- **A — Manter RN2 rígida (status quo, sem seleção):** descartada porque é exatamente o comportamento que o PM pediu para mudar (motivo de existir do NAPO-022).
- **B — Permitir escolher o dia e descartar/mover automaticamente os itens que não cabem nele ("levar tudo para outra fornada"):** descartada — já rejeitada no Gate Visual A do próprio NAPO-006 por poder falhar de novo (remontar disponibilidade de todo o carrinho) e por mudar a sacola do cliente sem confirmação explícita.
- **C — Dividir o pedido em vários pedidos, um por dia viável de cada item:** descartada — contraria o motivo original da RN2 (cobraria dois fretes pela mesma sacola e exigiria duas viagens que a rota não comporta).
- **D — Dia como parâmetro validado por interseção de disponibilidade, com rejeição explícita quando inviável (escolhida):** mantém a garantia de "uma sacola, um frete, uma viagem" da RN2 original e a garantia de "servidor decide valor" da RN3, apenas ampliando o que pode ser proposto pelo cliente antes da validação.

---

## Consequências

### Positivas
- Resolve a queixa de uso observada no Gate Visual B do NAPO-006: hoje não há como adiar a entrega do carrinho inteiro sem remontar tudo manualmente.
- Preserva as duas garantias centrais do NAPO-006 (um frete por sacola; servidor como única fonte de verdade do valor final).
- Abre caminho natural para o NAPO-023 (comunicação de disponibilidade honesta) reaproveitar o mesmo cálculo de interseção.

### Negativas / trade-offs aceitos
- A resolução do dia deixa de ser uma função pura de "pegar o máximo" e passa a ter dois caminhos (derivado vs. validado), aumentando a superfície de teste em `packages/core`.
- UI precisa comunicar claramente uma rejeição de carrinho inteiro quando o dia escolhido não serve para algum item — risco de fricção se a mensagem não for clara.
- Abre a possibilidade do cliente escolher, por engano, um dia pior (mais tardio) que o necessário — mitigação de UX fica a cargo do `design.md` do NAPO-022.

### Impacto em `ARCHITECTURE.md`
- Sem impacto direto em `ARCHITECTURE.md` (a RN2/RN3 vivem no spec do NAPO-006, não na arquitetura).

### Impacto em itens do ROADMAP
- **NAPO-022:** desbloqueado para `/especificar` após este ADR ser aceito.
- **NAPO-006 (`docs/specs/006-checkout/spec.md`):** RN2 será atualizada via `drift.md` ou revisão direta de spec concluído, registrando a extensão decidida aqui, antes ou durante o `/especificar NAPO-022`.

### Riscos a monitorar pós-decisão
- Se a taxa de rejeição de "dia escolhido" for alta em produção, a UX de escolha pode precisar expor a disponibilidade por item **antes** de o cliente propor um dia (gatilho de revisão: acompanhar nas primeiras semanas pós-implementação).

---

## Aprovação

- [x] Revisado por: PM · em 2026-08-28
- [x] `ARCHITECTURE.md` atualizado refletindo a decisão (se aplicável) — N/A, sem impacto direto
- [x] Flag `**Exige ADR**` removida da entrada em 💡 Ideias do ROADMAP (se aplicável) — N/A, item já está no Backlog/Próximos
- [x] Status acima alterado para **Aceito**
