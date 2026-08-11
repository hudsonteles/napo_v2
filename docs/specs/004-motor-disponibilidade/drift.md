# ⚠️ Drift — NAPO-004, bloco D

**Detectado em:** 2026-08-10, antes da primeira linha do bloco D
**Status:** ✅ resolvido — PM escolheu o **caminho (a)** em 2026-08-10. T20 e T21 reescritos no `tests.md` antes de qualquer código, conforme `AGENTS.md` §3.3.

---

## A divergência

RN12, RN13 e RN14 do `spec.md` descrevem comportamento **sobre pedidos**:

- **RN12** — pagamento confirma fora da janela ⇒ o pedido fica com estado de *conflito de disponibilidade*
- **RN13** — cancelamento devolve capacidade (antes do cutoff) ou lote (depois)
- **RN14** — lote liberado volta a ser visível para o motor

Os cenários correspondentes (T20, T21, T22) falam de "pedido", "webhook" e "cancelamento".

**A tabela `pedidos` não existe e não está no Mapa de Impacto deste spec.** Ela nasce em NAPO-006 (checkout com Mercado Pago), junto com o webhook que confirma pagamento. O `spec.md` §5 já registra como não-objetivo *"não decide sozinho o destino de pedido em conflito — apenas detecta e marca"*, mas detectar e marcar ainda pressupõe o registro que será marcado.

O `design.md` §5 antecipou metade disso ao decidir que "conflito vira estado do pedido, não exceção lançada" — sem notar que o estado precisa de uma tabela que outro spec cria.

RN14 é caso à parte: `lotes` **existe** aqui, então o mecanismo é testável sem `pedidos`.

---

## Caminho (a) — manter o spec e entregar o mecanismo puro

O 004 entrega as **funções de decisão** em `packages/core`, sem persistência de pedido:

- `avaliarViabilidade(diaEntrega, snapshot)` — o dia ainda é honrável? Devolve `viavel | cutoff_vencido | sem_vaga`. O webhook de NAPO-006 chama isso e grava o estado.
- `devolucaoPorCancelamento(diaEntrega, snapshot)` — devolve `capacidade` ou `lote`, conforme a fase (RN13).

T20 e T21 são reescritos para exercitar essas funções (Vitest, sem banco). T22 continua como está — `lotes` existe.

**Custo:** as RNs ficam provadas como regra, não como fluxo ponta a ponta. O fluxo real só é observável quando NAPO-006 plugar o webhook.
**Ganho:** zero invasão de escopo; NAPO-006 recebe a decisão pronta e testada, em vez de reinventá-la no meio do checkout.

---

## Caminho (b) — atualizar o spec e trazer `pedidos` para cá

Criar `pedidos` e `pedido_itens` no 004, com o estado de conflito, para que T20 e T21 rodem ponta a ponta.

**Custo:** 2 tabelas + RLS + migration a mais, todas do escopo declarado de NAPO-006; o checkout depois teria que estender o que este spec definiu sem conhecer o fluxo de pagamento. Contraria o não-objetivo já aprovado no `spec.md` §5.
**Ganho:** T20 e T21 viram testes de fluxo real agora.

---

## Recomendação

**(a).** O não-objetivo do `spec.md` §5 já dizia que a operação do conflito é de outro spec; o que faltou foi o `tests.md` refletir isso nos cenários. Entregar a decisão como função pura mantém a regra num lugar só — a mesma razão que fez o motor inteiro morar em `packages/core`.
