# 📋 Spec: Espinha de cobrança — cobrança como entidade e pagamento sem sair do site

**ID:** NAPO-025
**Status:** Concluído
**Responsável:** Hudson (PM)
**Data:** 2026-09-05
**Item no Roadmap:** NAPO-025

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.
>
> **Origem:** [`docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md`](../../superpowers/specs/2026-09-05-espinha-cobranca-design.md) §3 e §9.
> **ADR pré-requisito:** [ADR-0001 — Checkout Bricks](../../adr/0001-checkout-bricks.md) (Aceito).
> **Absorve:** NAPO-023 (cancelado por absorção).

---

## 1. Visão Geral (User Stories)

> **Como** cliente do site, **eu quero** pagar sem ser jogado para outra página,
> **para que** a compra termine onde ela começou — e eu não tenha que decidir, no
> meio do caminho, se aquele site desconhecido é confiável.

> **Como** cliente que teve o cartão recusado, **eu quero** tentar outro cartão sem
> perder o pedido, **para que** um problema do meu banco não me faça começar tudo de novo
> e descobrir que a fornada encheu.

> **Como** sócio da Napo, **eu quero** que toda tentativa de receber dinheiro fique
> registrada como um fato próprio, **para que** eu consiga responder "esse pedido foi
> pago?" olhando o sistema, e não perguntando no grupo do WhatsApp.

> **Como** sócio da Napo, **eu quero** que o sistema saiba cobrar por mais de um
> instrumento desde já, **para que** o balcão, a rua e o WhatsApp entrem depois sem
> reescrever a regra de dinheiro pela quinta vez.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] **Zero pedidos com dinheiro sem cobrança correspondente.** A consulta que
      cruza pedido pago × cobrança aprovada deve devolver conjunto vazio, sempre.
      Hoje isso nem é uma pergunta que dá para fazer.
- [ ] **Zero notificações recebidas sem linha em `pagamento_eventos`.** É o defeito
      que estamos consertando: o 404 do gateway sobe como exceção e o rastro some.
- [ ] **Linha de base de conversão do checkout** medida a partir do primeiro dia
      com o Brick — é o risco declarado no ADR-0001 e não existe como número hoje.
- [ ] **Os seis caminhos do gateway real observados em desenvolvimento** (RN20),
      não simulados. Era a razão de existir do NAPO-023.

---

## 3. Regras de Negócio Obrigatórias

### A. O modelo

- **RN1 — Cobrança é entidade, não campo.** Toda tentativa de receber um valor de
  um pedido é uma linha própria, com instrumento, valor, situação, quem criou e o
  rastro do gateway. Um pedido tem **0..n cobranças**: zero quando o pagamento é na
  entrega e ainda não começou, uma no caso comum, várias quando o cartão recusou e
  o cliente tentou de novo. **Nenhum dado de pagamento volta a morar no pedido.**

- **RN2 — A situação de pagamento do pedido é derivada das cobranças, nunca
  gravada.** Não existe no sistema um caminho que "marque o pedido como pago": o
  pedido está pago porque tem cobrança aprovada que cobre o total. Campo solto é
  como pedido pago aparece pendente às 22h de sexta.

- **RN3 — O eixo do dinheiro é separado do eixo da entrega.** O `status` do pedido
  passa a descrever só o ciclo do que foi vendido (novo → em produção → pronto → em
  rota → entregue, além de cancelado e expirado). Se o dinheiro entrou é outra
  pergunta, respondida pela RN2. **Consequência que justifica a separação:** um
  pedido de balcão que será pago na entrega (NAPO-026) precisa ocupar vaga de forno
  sem ter pago nada — hoje isso não tem como ser expresso.

- **RN4 — O que consome capacidade é o pedido não encerrado, independente de
  pagamento.** Pedido cancelado ou expirado devolve a vaga; qualquer outro estado
  a ocupa. Vaga vendida duas vezes continua sendo pior que cobrança não criada.

### B. Os instrumentos

- **RN5 — Cinco instrumentos, uma porta só.** `online`, `pix_qr`, `link`,
  `dinheiro` e `point`. Todos passam pela mesma porta de pagamento. Nesta spec só
  `online` tem tela e fluxo real; `pix_qr`, `link` e `dinheiro` existem no modelo e
  atrás da porta, e ganham superfície no NAPO-026. `point` é o NAPO-027.

- **RN6 — Quem confirma é o webhook, nunca a tela.** Vale para os quatro
  instrumentos que têm gateway. O retorno do navegador é informação, não
  autorização. (Herdada do NAPO-006, RN8 — continua valendo palavra por palavra.)

- **RN7 — `dinheiro` é a exceção honesta e exige responsável.** Sem gateway, a
  confirmação é declaração de um operador identificado, e o nome dele fica gravado
  na cobrança. Cobrança em dinheiro sem operador não confirma. Não é brecha: é o
  que torna o acerto do vendedor possível — *"você declarou R$ 480, entregue R$ 480."*

### C. O pagamento online

- **RN8 — O cliente não sai do site para pagar.** Cartão de crédito, cartão de
  débito e Pix acontecem no nosso domínio. Conta Mercado Pago e boleto **não são
  oferecidos** (§5).

- **RN9 — Dado de cartão nunca toca o nosso servidor.** O que trafega até nós é o
  token gerado pelo SDK do Mercado Pago dentro dos campos isolados dele. Número,
  CVV e validade não passam pela nossa aplicação em nenhum momento, nem em log.

- **RN10 — Uma tentativa do cliente nunca vira duas cobranças no gateway.** Duplo
  clique, retry de rede ou reenvio do formulário resolvem para a **mesma** cobrança.
  Com o Brick somos nós que criamos o pagamento — a proteção que hoje existe só na
  confirmação passa a ser necessária também na criação.

- **RN11 — O relógio é um só.** A cobrança nasce com o mesmo vencimento da reserva
  do pedido, os 30 minutos da RN7 do NAPO-006. O QR do Pix expira junto com a vaga
  de forno: QR que vive mais que a reserva é cliente pagando fornada que já encheu.

- **RN12 — Recusa não mata o pedido nem reinicia o relógio.** Cartão recusado
  mantém pedido e reserva vivos, e a nova tentativa é uma cobrança nova do mesmo
  pedido. O prazo continua correndo do primeiro clique — reiniciar a cada tentativa
  deixaria alguém segurar a fornada indefinidamente trocando de cartão.

- **RN13 — Motivo de recusa é traduzido, nunca repassado.** O cliente lê a nossa
  mensagem, por família de motivo (saldo, dados do cartão, recusa do emissor).
  Nenhum texto, código ou tela do gateway aparece para ele — `ARCHITECTURE.md`
  §2.2.3 vale aqui como vale no resto do produto, e detalhar recusa é também dar
  retorno a quem testa cartão roubado.

### D. O que não pode se perder

- **RN14 — A porta cumpre o próprio contrato.** Gateway que não conhece o pagamento
  resulta em "não encontrado", nunca em exceção que sobe. **Este é o defeito
  encontrado no spike de 2026-09-05:** o SDK do Mercado Pago lança no 404 e a
  exceção passa por cima do registro do evento — o reenvio até acontece, porque é
  5xx, mas o rastro de auditoria se perde. Notificação chegando antes de o pagamento
  ficar consultável é corrida real em produção.

- **RN15 — Toda notificação recebida deixa rastro, verificada ou não.** Inclusive
  assinatura inválida, pedido desconhecido e erro nosso. É a única evidência
  disponível quando alguém perguntar por que um pedido não confirmou.

- **RN16 — Idempotência da confirmação continua sendo do banco.** Duas notificações
  simultâneas para o mesmo pagamento viram violação de restrição, não dois consumos
  de capacidade. (Herdada do NAPO-006, RN9.)

- **RN17 — O valor é conferido contra o gateway, não contra o corpo da
  notificação.** Notificação forjada com valor alto não confirma nada. (Herdada do
  NAPO-006, RN10.)

- **RN18 — Dinheiro que entrou não é recusado.** Pagamento que chega para dia
  inviável nasce pago, com o veredito gravado e alerta para a casa resolver por
  telefone. (Herdada do NAPO-006, RN11.)

- **RN19 — Estorno devolve o que dá para devolver.** Notificação de estorno ou
  chargeback encerra o pedido e devolve vaga de forno antes do cutoff, lote depois.
  (Herdada do NAPO-006, RN14.)

- **RN20 — O item só fecha com o gateway de verdade.** Seis caminhos observados
  contra o Mercado Pago em desenvolvimento, pelo túnel, com assinatura HMAC real:
  Pix aprovado, cartão aprovado, cartão recusado, Pix pendente que expira,
  notificação duplicada e assinatura inválida. Simulação não conta — foi
  exatamente a lacuna que produziu o defeito da RN14.

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário | Ação do cliente | Resposta do sistema |
|---|---|---|
| Cartão recusado | Envia o pagamento no Brick | Mensagem nossa por família de motivo, na própria tela; o pedido e a vaga continuam de pé e ele pode tentar outro cartão (RN12, RN13) |
| Duplo clique em pagar | Envia duas vezes | Uma cobrança só; a segunda resolve para a mesma (RN10) |
| Pix gerado e não pago | Fecha a aba e some | Cobrança e reserva vencem juntas em 30 min; a vaga volta e o carrinho continua lá (RN11) |
| Pix pago depois de vencer | Paga o QR fora do prazo | O dinheiro não é recusado: pedido nasce pago com veredito e alerta para a casa ligar (RN18) |
| Gateway fora do ar na criação | Envia o pagamento | Reserva liberada e pedido expirado **na mesma requisição** — indisponibilidade de terceiro não prende o forno por meia hora |
| Notificação antes do pagamento existir | — | Evento gravado como não encontrado e resposta 5xx para o gateway reenviar (RN14) |
| Notificação com assinatura inválida | — | 401, evento gravado, nada tocado no banco (RN15) |
| Cliente volta para a tela de pagamento de um pedido já pago | Recarrega a página | A tela mostra o pedido pago; não existe caminho para cobrar de novo |
| Erro nosso no processamento | — | 5xx deliberado: o gateway reenvia. Devolver 200 num erro nosso transforma falha temporária em pedido pago que nunca confirma |

---

## 5. Não-Objetivos (Fora do Escopo)

- **Conta Mercado Pago (carteira) e boleto no checkout.** A carteira redireciona o
  cliente — o oposto do que o ADR-0001 decidiu — e exigiria manter o Checkout Pro
  vivo em paralelo. Boleto compensa em 1 a 3 dias úteis contra uma reserva de 30
  minutos: seria vender vaga de fornada que não dá para segurar. Decisões do PM em
  2026-09-05, revisíveis se a conversão cair.
- **Cobrança na maquininha (Point)** — NAPO-027, inclusive o cadastro de frota e o
  tópico `point_integration_wh`.
- **Tela de admin para registrar venda** (balcão, WhatsApp, carga) — NAPO-026. É lá
  que `pix_qr`, `link` e `dinheiro` ganham superfície.
- **Conciliação por relatório** — NAPO-028. **Carga de rua** — NAPO-029.
- **Cartão salvo e pagamento em um toque** — está em 💡 Ideias e depende do
  consentimento versionado do NAPO-009.
- **Trava para pagamento na entrega.** Decisão consciente: com ~99% de conversão,
  qualquer limite perde venda boa para resolver problema de 1%. A espinha registra
  a evidência; a política, se um dia existir, se decide com número na mão.
- **Envio automatizado de link por WhatsApp** — o operador compartilha do próprio
  aparelho. Automação em massa é NAPO-015/016 e depende do NAPO-017, bloqueado.
- **Exercitar os momentos além de `antecipado`.** `no_ato`, `na_entrega` e
  `a_combinar` nascem no schema para não exigir backfill, mas só o NAPO-026 os liga.
- **Reabrir a spec do NAPO-006.** Ela continua válida no contrato de negócio e
  desatualizada no mecanismo; o registro disso fica lá, conforme o ADR-0001.

---

## 6. Dependências de Negócio

- **NAPO-006** (concluído) — carrinho, checkout, reserva de capacidade e o pipeline
  de confirmação que esta spec preserva.
- **ADR-0001** (Aceito) — sem ele esta spec não começa.
- **Credenciais de teste do Mercado Pago** (`MP_ACCESS_TOKEN`,
  `NEXT_PUBLIC_MP_PUBLIC_KEY`) e **túnel `cloudflared`** de pé durante a validação —
  a RN20 não fecha sem isso. `MP_WEBHOOK_SECRET` depende do túnel, e a URL do túnel
  grátis muda a cada execução.

---

## 7. Observações e Decisões de Negócio

- **Por que a entidade agora e não quando o balcão chegar.** Se cada canal
  implementar seu próprio pagamento, a matriz origem × momento × instrumento é
  reescrita a cada canal — em código que mexe em dinheiro, com cinco cópias livres
  para divergir sobre quando um pedido está pago. Cinco itens do ROADMAP dependem
  desta decisão estar tomada uma vez só.
- **O que sobrevive intacto do NAPO-006.** Webhook, assinatura HMAC, idempotência
  de banco, `confirmar-pagamento.ts`, a consulta ativa da RN19 e a própria porta de
  pagamento. A porta foi criada exatamente para este momento: trocar de mecanismo é
  escrever um adaptador, não reescrever o checkout.
- **Sinal e saldo de evento saem de graça.** Duas cobranças do mesmo pedido. Não é
  escopo desta spec, mas é consequência do modelo — e é por isso que a derivação da
  RN2 já contempla pagamento parcial.
- **"Fornada" deixa de nomear o que o cliente reserva** (decisão do PM, 2026-09-05,
  antes do primeiro commit de código). A palavra continua onde **explica a escassez**
  — vitrine, barra de disponibilidade, seletor, "esgotado nesta fornada" —, porque ali
  ela é a narrativa que faz o limite parecer honesto em vez de arbitrário. Mas onde o
  cliente reserva e possui algo, a palavra passa a ser **entrega**: a ficha do resumo,
  a frase da reserva, o cronômetro, a expiração e a tela do pedido. O cliente não
  guarda um lugar numa assadeira; ele guarda a entrega de sexta. São dois objetos
  distintos na cabeça dele — compra-se da fornada de sexta, recebe-se a entrega de
  sexta —, e o contrato visual foi ajustado antes de virar código.
- **Risco declarado no ADR-0001:** o Brick é componente do Mercado Pago e aceita
  customização de cor, tipografia e raio, mas não fica 100% na identidade Napo. Se
  o Gate Visual A reprovar mesmo depois de customizado, a alternativa é reabrir o
  Checkout Transparente, com o custo já conhecido no ADR.

---

## 8. Aprovação

- [x] **Spec revisado e aprovado por:** Hudson / 2026-09-05
- [x] **Design técnico criado** (`design.md`)
- [x] **Critérios de teste criados** (`tests.md`)
- [x] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
