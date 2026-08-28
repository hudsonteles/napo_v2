# 📋 Spec: Carrinho e checkout com Mercado Pago

**ID:** NAPO-006
**Status:** Concluído
**Responsável:** Hudson
**Data:** 2026-08-19
**Item no Roadmap:** NAPO-006

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.

---

## 1. Visão Geral (User Stories)

> **Como** visitante, **eu quero** montar o carrinho enquanto navego pelos sabores, **para que** escolher o que quero não dependa de criar conta antes de saber se vale a pena.

> **Como** cliente, **eu quero** ver o dia de entrega, o frete e o total antes de pagar, **para que** nada apareça como surpresa na tela do Mercado Pago.

> **Como** cliente, **eu quero** pagar no Pix e ver o pedido confirmado sozinho, **para que** eu não precise mandar comprovante no WhatsApp para alguém conferir à mão.

> **Como** cliente que fechou a aba durante o pagamento, **eu quero** que o pedido apareça pago do mesmo jeito, **para que** o dinheiro que saiu da minha conta tenha virado pizza.

> **Como** gerente, **eu quero** que a vaga do forno só saia da prateleira quando o dinheiro entra, **para que** carrinho abandonado não bloqueie a capacidade que o dia tinha para vender.

> **Como** gerente, **eu quero** que todo pedido guarde o preço e o custo do dia da venda, **para que** reajustar um insumo em outubro não reescreva a margem de agosto.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] **Zero pedido pago sem confirmação automática.** Todo pagamento aprovado no Mercado Pago vira pedido `pago` no sistema sem intervenção humana — é o que separa canal próprio de venda por WhatsApp.
- [ ] **Zero cobrança sem vaga garantida.** Nenhum pagamento é iniciado sem reserva de capacidade viva cobrindo o prazo do meio de pagamento.
- [ ] **Zero divergência entre o total exibido e o total cobrado.** O valor da tela e o valor da preferência do Mercado Pago saem do mesmo cálculo de servidor.
- [ ] **Mix de Pix acima de 40% em dois meses.** É o gatilho de reavaliação do desconto de Pix já registrado na spec do R1 §7 — abaixo disso, a decisão de não dar desconto volta à mesa.
- [ ] **Taxa de conclusão do checkout medível por etapa** (carrinho → endereço → pagamento → pago). Sem isso não há como saber se a perda é atrito de tela ou recusa de cartão.

---

## 3. Regras de Negócio Obrigatórias

- **RN1 — O carrinho é livre; a conta só é exigida para pagar.** Adicionar, remover e mudar quantidade não pedem login. Conta autenticada **e telefone validado** (NAPO-002) são exigidos no clique de "Finalizar pedido", e o carrinho sobrevive ao login. Exigir cadastro para pôr item na sacola é cobrar pedágio de quem o SEO acabou de trazer, antes de a pessoa saber o frete.

- **RN2 — Um pedido, um dia de entrega.** Se os sabores do carrinho têm primeiros dias viáveis diferentes, o pedido inteiro vai, por padrão, para o **dia mais tardio entre eles**, exibido antes do pagamento. Dividir em dois pedidos cobraria dois fretes pela mesma sacola; entregar em dois dias é duas viagens que a rota não comporta. **Revisado por ADR-0001 (2026-08-28, ver `docs/adr/0001-dia-de-entrega-selecionavel-no-carrinho.md`):** o cliente pode propor um dia candidato para o carrinho inteiro; o servidor valida por **interseção de disponibilidade de todos os itens** e ou confirma o pedido nesse dia, ou rejeita o pedido inteiro — nunca remove item ou ajusta o dia silenciosamente. Detalhamento do fluxo de escolha explícita fica a cargo do spec do NAPO-022.

- **RN3 — O total é decidido no servidor.** O cliente envia produtos e quantidades; preço unitário, subtotal, frete e total são recalculados no servidor a cada etapa e na criação da cobrança. Valor que chega pronto do navegador é valor que o cliente escolhe.

- **RN4 — O pedido congela o que era verdade no dia da venda.** Nome do produto, preço unitário, **custo unitário** e endereço completo são copiados para dentro do pedido. Reajustar preço, corrigir a ficha técnica ou editar o endereço na conta **não pode** reescrever pedido antigo — sem isso, o painel econômico do NAPO-008 mede margem de agosto com custo de outubro.

- **RN5 — Pagamento online é obrigatório no canal site.** Não existe "pagar na entrega" aqui. Um no-show não custa a viagem: custa uma vaga de 30 no forno do dia. A liberação de pagamento na entrega vale apenas para o canal do bot (NAPO-015).

- **RN6 — Pix é destacado e pré-selecionado, sem desconto.** 5% de desconto custa R$ 2,30 e economiza R$ 1,61 de taxa — só empata perto de 3%. O valor do Pix é não ter chargeback e liquidar na hora, não ser mais barato para o cliente.

- **RN7 — A vaga é reservada antes de cobrar, e a reserva cobre o prazo do pagamento.** A reserva de capacidade (NAPO-004) é criada **antes** de gerar a cobrança, e seu vencimento e o do meio de pagamento são o mesmo instante. Reserva de 15 minutos com Pix de 30 é o cliente pagando por uma vaga que já foi de outro.

- **RN8 — Quem confirma o pagamento é o webhook, nunca o navegador.** O retorno do Mercado Pago para a tela é informação, não autorização: a pessoa pode fechar a aba, perder sinal ou forjar a URL de sucesso. Pedido só vira `pago` por notificação do Mercado Pago verificada no servidor.

- **RN9 — A confirmação é idempotente.** O Mercado Pago reenvia a mesma notificação quando não recebe `2xx`. Processar duas vezes baixaria capacidade duas vezes e faria o dia vender menos do que pode. A chave de deduplicação é o identificador do pagamento.

- **RN10 — Notificação é verificada antes de ser obedecida.** O endpoint é público — é a única superfície do sistema sem sessão. A assinatura da notificação é conferida, o pagamento é **consultado na API do Mercado Pago** (o corpo recebido nunca é fonte de valor) e o valor pago é comparado ao total do pedido. Divergência não confirma: registra e alerta.

- **RN11 — Dinheiro que entrou nunca é recusado.** Se o pagamento é aprovado mas o dia já não é viável — cutoff venceu ou o dia encheu no intervalo —, o pedido nasce `pago` com o veredito gravado (`cutoff_vencido` ou `sem_vaga`) e sobe alerta no admin. Realocar ou estornar é decisão humana. Recusar automaticamente devolveria o dinheiro de quem já comprou por um problema de agenda que a casa pode resolver com uma ligação.

- **RN12 — Pagamento confirmado consome a reserva e passa a ocupar a vaga pelo pedido.** A reserva vira `consumida` e o item pago passa a contar como capacidade ocupada do dia. Se a reserva morresse sem o pedido assumir o lugar dela, o motor voltaria a oferecer uma vaga já vendida.

- **RN13 — Pagamento não concluído no prazo expira o pedido e devolve a vaga.** Pedido em `aguardando_pagamento` cujo prazo venceu passa a `expirado` e libera a reserva. Carrinho abandonado que segura vaga é ociosidade fabricada pelo próprio sistema, no negócio cujo gargalo é o forno.

- **RN14 — Cancelar devolve capacidade ou lote, conforme o cutoff.** Antes do cutoff nada foi produzido e volta vaga de forno; depois, a pizza existe e volta lote pronto, vendável para outro dia dentro da validade. A regra já é decisão pura no núcleo (`devolucaoPorCancelamento`, NAPO-004) e é aqui que passa a ser chamada. **O estorno do dinheiro é manual no painel do Mercado Pago** — o sistema registra o cancelamento, não move dinheiro de volta sozinho.

- **RN15 — Cliente só cancela antes do cutoff.** Depois disso a pizza entrou na produção do dia e o cancelamento passa a exigir atendimento humano. O botão some da tela e a via de contato aparece no lugar.

- **RN16 — Todo pedido tem número curto, legível e imutável.** É o que o cliente fala no telefone e o que a cozinha escreve na caixa. Não é o UUID, e não é reaproveitado depois de cancelado.

- **RN17 — Pedido é do cliente e só dele.** Cliente lê e cria apenas os próprios pedidos; equipe (atendente, cozinha, gerente, admin) lê todos para operar. **Ninguém altera pedido pelo cliente**, e mudança de status vem de rota de servidor com papel conferido, nunca de escrita direta do navegador.

- **RN18 — O endereço do pedido precisa estar dentro da área no momento da compra.** Endereço `atendido = false` (NAPO-005 RN9) não pode ser escolhido, e o frete é recalculado no servidor a partir da distância já gravada — nunca recebido do cliente. Frete fora de área devolve `null`, e `null` bloqueia o checkout: frete R$ 0,00 silencioso é prejuízo que não aparece no painel.

- **RN19 — Pedido parado é consultado ativamente.** Webhook perdido existe: se o endpoint ficou fora do ar na janela inteira de reenvio, há dinheiro na conta e pedido `aguardando_pagamento` para sempre — estoque não baixa e o cliente não recebe nada. A tela de retorno consulta o pagamento na hora, e pedidos parados além do prazo são varridos e reconsultados antes de expirar.

- **RN20 — Todo pedido nasce com canal e atividade fiscal explícitos.** Canal `site` e atividade fiscal `congelado_industrializado`. O Simples exige a segregação por atividade na declaração mensal (NAPO-018) e a venda de fresca no balcão (NAPO-013) vai gravar outro valor no mesmo campo — o dado nasce agora para a costura fiscal do NAPO-011 não precisar de migração retroativa.

- **RN21 — Transição de status de pedido é auditada.** Quem mudou, de quê para quê e quando, na tabela de auditoria que já existe (NAPO-001). Pedido é dinheiro; status sem rastro é a diferença entre um cancelamento explicável e um buraco no caixa.

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário | Ação do Usuário | Resposta do Sistema |
|---|---|---|
| Carrinho com item que esgotou | Abre o carrinho ou clica em finalizar | Item marcado como indisponível, quantidade ajustada para o máximo possível (ou removido), aviso explícito; o checkout não segue sem o cliente confirmar |
| Preço mudou desde que o item entrou no carrinho | Clica em finalizar | Total é recalculado, a diferença é mostrada e o cliente reconfirma antes de pagar |
| Sabores com dias de entrega diferentes | Vai para o checkout | Dia único exibido com a razão ("todos entregues em [data] — [sabor] é o mais tardio") |
| Sem endereço cadastrado | Chega ao checkout | Segue para o cadastro de endereço (NAPO-005) e volta ao checkout com o endereço selecionado |
| Endereço fora da área | Seleciona endereço `atendido = false` | Endereço aparece desabilitado com o motivo; checkout bloqueado até escolher outro |
| Telefone não validado | Clica em finalizar | Segue para o gate de OTP (NAPO-002) e retorna ao checkout com o carrinho intacto |
| Sem vaga no instante do checkout | Clica em pagar | `409` antes de qualquer cobrança, dia recalculado e nova data oferecida |
| Mercado Pago fora do ar na criação da cobrança | Clica em pagar | Reserva é liberada, erro amigável e o carrinho permanece — não fica pedido órfão segurando vaga |
| Pagamento recusado (cartão) | Volta do Mercado Pago | Pedido segue `aguardando_pagamento` com a reserva viva até o prazo; tela oferece tentar de novo sem remontar o carrinho |
| Cliente fecha a aba durante o Pix | — | Webhook confirma assim mesmo (RN8); pedido aparece pago na área do cliente |
| Retorno do navegador sem webhook ainda processado | Volta do Mercado Pago | Tela consulta o pagamento na hora (RN19) e mostra "confirmando pagamento" com atualização automática — nunca "não pago" prematuro |
| Notificação com assinatura inválida | — | `401`, nada é processado, evento registrado |
| Notificação duplicada | — | `200` sem reprocessar (RN9) |
| Valor pago diverge do total do pedido | — | Pedido **não** é confirmado; alerta no admin com os dois valores |
| Pagamento aprovado com dia inviável | — | Pedido `pago` com veredito + alerta no admin (RN11) |
| Estorno ou chargeback notificado pelo Mercado Pago | — | Status do pedido acompanha, capacidade ou lote devolvidos conforme RN14, alerta no admin |
| Erro de servidor durante a confirmação | — | Notificação **não** recebe `2xx`, para o Mercado Pago reenviar; erro no Sentry |

---

## 5. Não-Objetivos (Fora do Escopo)

- **E-mail de confirmação do pedido.** Depende do SMTP customizado (Resend) que ainda não existe nem foi provisionado — está em 💡 Ideias e bloqueia o NAPO-021. Cravá-lo aqui subordinaria o checkout a uma pendência de infraestrutura. O cliente confirma na tela e consulta em `/pedido/[numero]`.
- **Área do cliente com histórico e lista de pedidos** — é o NAPO-007. Aqui existe apenas a página do pedido recém-criado, acessível por link direto.
- **Painel administrativo de pedidos** — é o NAPO-008. Os alertas das RN10, RN11 e RN14 são gravados no banco e visíveis por consulta; a tela que os mostra nasce lá.
- **Estorno automático.** Estorno é manual no painel do Mercado Pago (RN14).
- **Cupons, descontos, promoções e frete grátis condicional além da regra de R$ 150** — a única regra promocional do R1 é a do NAPO-005. Está em 💡 Ideias.
- **Parcelamento configurável.** O ticket é de R$ 60–80; parcelamento é decisão de negócio que não foi tomada. O que o Checkout Pro oferecer por padrão é o que vale.
- **Movimentação de estoque com motivo, FEFO e ajuste manual** — NAPO-008. Aqui só o consumo de capacidade e a devolução por cancelamento (RN12, RN14).
- **Emissão fiscal.** O campo de atividade fiscal nasce (RN20), a integração é NAPO-011.
- **Reconciliação financeira** (repasses, taxas efetivas, Stone) — está em 💡 Ideias.
- **Recuperação de carrinho abandonado** (e-mail/WhatsApp) — depende de NAPO-009 e NAPO-016.

---

## 6. Dependências de Negócio

- **NAPO-002** (auth + gate de telefone) — concluído. Fornece a sessão e a validação exigidas pela RN1.
- **NAPO-003** (catálogo) — concluído. Fornece produto, preço por faixa e a vitrine de onde o item entra no carrinho.
- **NAPO-004** (motor de disponibilidade) — concluído. Fornece dia de entrega, reserva atômica e as decisões puras `avaliarViabilidade` e `devolucaoPorCancelamento` (RN11, RN14), que nunca foram plugadas e passam a ser aqui.
- **NAPO-005** (endereços e frete) — concluído. Fornece `POST /api/frete`, escrito nele explicitamente como o contrato que esta spec consome (RN18).
- **Conta PJ do Mercado Pago com credenciais de produção e de teste** — providência externa do PM. As credenciais de teste bastam para implementar; as de produção só são exigidas no NAPO-021.
- **URL pública para o webhook.** Não funciona em `localhost` (`ARCHITECTURE.md` §6.1): exige túnel no desenvolvimento e staging para o teste ponta a ponta.
- **Custo unitário do produto.** A RN4 exige congelar custo, mas o BOM que o calcula é NAPO-008. Enquanto ele não existe, o campo é gravado com o custo conhecido do produto (ou `null` quando não houver) — o **campo nasce agora** para não haver pedido sem custo quando o painel econômico chegar.

---

## 7. Observações e Decisões de Negócio

- **Mercado Pago confirmado sobre Stripe (2026-08-18).** Decisão reaberta pelo PM antes desta spec e mantida: Pix é o meio dominante e tem taxa menor no Mercado Pago; adquirente local aprova melhor cartão nacional, e num ticket de R$ 60–80 uma recusa a mais custa mais que qualquer ganho de DX. O gateway fica isolado atrás de uma porta no código para que a troca, se um dia acontecer, seja localizada. Já registrado em `ARCHITECTURE.md` §2.1.

- **O carrinho anônimo é uma exceção consciente à `ARCHITECTURE.md` §5.2**, que lista "carrinho" entre as áreas logadas. A regra existe para proteger **dado**, e carrinho anônimo não tem dado de pessoa: mora no navegador e só encontra o banco quando vira pedido. A exigência de login e telefone permanece intacta no momento em que existe algo a proteger — o checkout. Não exige ADR porque não muda a fronteira de autorização, apenas o instante em que ela é aplicada.

- **Um pedido, um dia (RN2), resolvido pelo dia mais tardio** e não pelo mais próximo: o mais próximo obrigaria a recusar o sabor que não cabe nele, transformando uma regra de agenda em perda de item da sacola.

- **A reserva passa a durar o que dura o pagamento (RN7).** Isso alonga o tempo em que uma vaga fica presa por alguém que talvez não pague — é o preço de não vender duas vezes a mesma vaga. O contrapeso é a RN13: prazo vencido devolve a vaga sem intervenção. O parâmetro fica em `config_operacao`, alterável sem deploy.

- **Não recusar dinheiro que entrou (RN11) é decisão de negócio, não limitação técnica.** O sistema tem informação suficiente para recusar; a casa tem informação suficiente para resolver. Uma pizzaria que liga para o cliente e reagenda mantém a venda; um estorno automático devolve o dinheiro e perde a pessoa.

- **Pix sem desconto tem gatilho de revisão explícito:** se o Pix não passar de 40% do mix em dois meses de operação, a decisão volta à mesa com dado real (spec do R1 §7).

- **O checkout é a primeira superfície do sistema que aceita requisição sem sessão** (o webhook). Todas as outras rotas até aqui exigem usuário autenticado. É por isso que a RN10 não confia no corpo recebido e consulta a fonte: notificação forjada com valor alto confirmaria um pedido nunca pago.

- **Nenhum ambiente publicado ainda existe** (NAPO-021). Esta spec é implementada e validada em ambiente local com túnel e credenciais de teste; o comportamento com dinheiro real só é exercitado quando o ambiente subir.

---

## 8. Aprovação

- [x] **Spec revisado e aprovado por:** Hudson / 2026-08-19
- [x] **Design técnico criado** (`design.md`) — inclui Gate Visual A aprovado em `preview.html`
- [x] **Critérios de teste criados** (`tests.md`) — 41 cenários, 21 RNs rastreadas
- [x] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
