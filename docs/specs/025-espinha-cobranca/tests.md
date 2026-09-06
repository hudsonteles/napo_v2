# ✅ Tests: Espinha de cobrança (NAPO-025)

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)
**Contrato visual:** [`preview.html`](./preview.html)

> 📌 **Contrato executável.** O módulo está pronto quando TODOS os cenários passam.
> Testes escritos **ANTES** da implementação (`AGENTS.md` §3.2).

> **Ferramentas por alvo:** `packages/core` e rotas → **Vitest** · derivação, restrições, RLS e `vagas_ocupadas` → **pgTAP** · fluxo do checkout ponta a ponta → **Playwright** · os seis caminhos do gateway real → **verificação manual registrada** (§F).
>
> **Ordem obrigatória:** os cenários de `vagas_ocupadas` (T12, T13) e da derivação (T5–T9) são escritos e passam **antes** de qualquer código de aplicação. São a função e a regra que o site inteiro lê — errá-las quebra a vitrine, não só o checkout (`design.md` §2.5, §8).

---

## Background compartilhado

```gherkin
DADO a configuração de operação padrão (entrega às sextas, produção seg–sex, teto de 30/dia)
E o catálogo com os 12 produtos ativos do NAPO-003
E o adaptador de pagamento em modo `fake` (salvo onde o cenário disser o contrário)
E um cliente autenticado com telefone validado e um endereço atendido
```

---

## Categoria A — O modelo

### T1 — Pedido nasce sem cobrança nenhuma
*Cobre: RN1, RN3*
```gherkin
QUANDO o cliente reserva a vaga no checkout
ENTÃO existe um pedido com status `novo` e nenhuma cobrança
E a situação de pagamento derivada é `sem_pagamento`
```

### T2 — Cada tentativa é uma cobrança
*Cobre: RN1, RN12*
```gherkin
DADO um pedido reservado cuja primeira cobrança foi recusada
QUANDO o cliente envia outro cartão e ele é aprovado
ENTÃO o pedido tem duas cobranças: uma `recusada` e uma `aprovada`
E a situação derivada é `pago`
```

### T3 — Nenhum dado de pagamento sobrou no pedido
*Cobre: RN1*
```gherkin
QUANDO as migrations 0016 e 0017 são aplicadas
ENTÃO a tabela `pedidos` não tem colunas `mp_payment_id`, `mp_preference_id`, `forma_pagamento` nem `pago_em`
E o enum de status não contém `aguardando_pagamento`, `pago` nem `estornado`
```

### T4 — Backfill preserva o histórico
*Cobre: RN1*
```gherkin
DADO um pedido antigo pago com `mp_payment_id` gravado na coluna do pedido
QUANDO a migration 0016 roda
ENTÃO existe uma cobrança `online` `aprovada` com aquele `mp_payment_id`
E a situação derivada continua sendo `pago`
```

### T5 — Derivação: nenhuma cobrança
*Cobre: RN2*
```gherkin
DADO um pedido sem cobranças
ENTÃO `situacao_pagamento` devolve `sem_pagamento`
```

### T6 — Derivação: aprovada cobre o total
*Cobre: RN2*
```gherkin
DADO um pedido de R$ 139,70 com uma cobrança aprovada de R$ 139,70
ENTÃO `situacao_pagamento` devolve `pago`
```

### T7 — Derivação: pagamento parcial
*Cobre: RN2*
```gherkin
DADO um pedido de R$ 139,70 com uma cobrança aprovada de R$ 50,00
ENTÃO `situacao_pagamento` devolve `parcial`
```

### T8 — Derivação: estorno vence tudo
*Cobre: RN2, RN19*
```gherkin
DADO um pedido com uma cobrança aprovada e outra estornada
ENTÃO `situacao_pagamento` devolve `estornado`
```

### T9 — Derivação: recusadas não somam
*Cobre: RN2*
```gherkin
DADO um pedido com três cobranças recusadas e nenhuma aprovada
ENTÃO `situacao_pagamento` devolve `sem_pagamento`
```

### T10 — Não existe caminho que marque pedido como pago
*Cobre: RN2*
```gherkin
QUANDO o código-fonte é varrido por escrita direta em situação de pagamento
ENTÃO nenhum serviço, rota ou trigger grava esse valor
E a única forma de um pedido ficar pago é ter cobrança aprovada
```

### T11 — Os dois eixos não se confundem
*Cobre: RN3*
```gherkin
DADO um pedido pago
QUANDO a casa move o pedido para `em_producao` e depois `entregue`
ENTÃO a situação de pagamento continua `pago` sem nenhuma escrita adicional
```

### T12 — Capacidade não sabe de pagamento
*Cobre: RN4*
```gherkin
DADO um pedido `novo` sem nenhuma cobrança para a fornada de 11/09
QUANDO `vagas_ocupadas` é consultada para o dia
ENTÃO o pedido é contado como ocupando vaga
```

### T13 — Encerrado devolve a vaga
*Cobre: RN4*
```gherkin
DADO dois pedidos na mesma fornada, um `cancelado` e outro `expirado`
QUANDO `vagas_ocupadas` é consultada
ENTÃO nenhum dos dois é contado
E a reserva viva de um terceiro cliente continua sendo contada
```

---

## Categoria B — Instrumentos

### T14 — Os cinco instrumentos existem atrás da mesma porta
*Cobre: RN5*
```gherkin
QUANDO uma cobrança é aberta em qualquer um dos cinco instrumentos
ENTÃO ela é gravada com o instrumento declarado
E `online`, `pix_qr`, `link` e `point` passam pela mesma porta de pagamento
```

### T15 — Confirmação nasce do webhook, não da tela
*Cobre: RN6*
```gherkin
DADO um pagamento aprovado no gateway e nenhuma notificação recebida
QUANDO o cliente recarrega a tela do pedido
ENTÃO a situação continua `aguardando` até a notificação chegar ou a consulta ativa acontecer
```

### T16 — Dinheiro sem operador não confirma
*Cobre: RN7*
```gherkin
DADO uma cobrança em `dinheiro` sem operador
QUANDO alguém tenta marcá-la como aprovada
ENTÃO o banco recusa por violação de restrição
E nada é persistido
```

---

## Categoria C — O pagamento online

### T17 — A criação do pedido não toca o gateway
*Cobre: RN8*
```gherkin
QUANDO o cliente reserva a vaga no checkout
ENTÃO nenhuma chamada ao Mercado Pago acontece
E a resposta não contém URL de pagamento de terceiro
```

### T18 — Nada de cartão chega ao servidor
*Cobre: RN9*
```gherkin
QUANDO o cliente envia o pagamento pelo Brick
ENTÃO o corpo aceito pela rota contém apenas token, método e parcelas
E o schema recusa qualquer campo que se pareça com número, validade ou código de cartão
```

### T19 — Duplo clique vira uma cobrança só
*Cobre: RN10*
```gherkin
DADO um pedido reservado
QUANDO dois envios de pagamento chegam ao mesmo tempo
ENTÃO existe exatamente uma cobrança pendente para o pedido
E as duas respostas apontam para a mesma cobrança
```

### T20 — A mesma chave de idempotência vai ao gateway
*Cobre: RN10*
```gherkin
QUANDO uma cobrança é enviada ao gateway e a chamada é repetida
ENTÃO as duas chamadas carregam o `X-Idempotency-Key` com o id da cobrança
E o gateway não registra dois pagamentos
```

### T21 — Cobrança e vaga vencem no mesmo instante
*Cobre: RN11*
```gherkin
QUANDO uma cobrança é aberta para um pedido reservado
ENTÃO o vencimento dela é idêntico ao `expira_em` do pedido
E a data de expiração enviada ao gateway é a mesma
```

### T22 — Vencido desmonta o pagamento
*Cobre: RN11*
```gherkin
DADO um pedido cuja reserva venceu
QUANDO o cliente permanece na tela de pagar
ENTÃO o formulário é retirado da tela
E ele lê que a entrega não está mais reservada, com caminho para o carrinho
```

### T23 — Recusa não reinicia o relógio
*Cobre: RN12*
```gherkin
DADO um pedido reservado às 20h00 com vencimento às 20h30
QUANDO o cartão é recusado às 20h10 e o cliente tenta outro às 20h12
ENTÃO o vencimento do pedido e da nova cobrança continua sendo 20h30
```

### T24 — O gateway não fala com o cliente
*Cobre: RN13*
```gherkin
DADO uma recusa do gateway com detalhe `cc_rejected_insufficient_amount`
QUANDO a tela mostra o resultado
ENTÃO o texto é o da família `saldo` definida em `design.md` §4.3
E nenhum código, texto ou tela do Mercado Pago aparece
```

---

## Categoria D — O que não pode se perder

### T25 — Pagamento desconhecido devolve nulo, não exceção
*Cobre: RN14*
```gherkin
DADO um gateway que responde 404 para o id consultado
QUANDO a porta consulta o pagamento
ENTÃO ela devolve "não encontrado" sem lançar exceção
```

### T26 — A corrida do webhook deixa rastro
*Cobre: RN14, RN15*
```gherkin
DADO uma notificação para um pagamento que o gateway ainda não conhece
QUANDO o webhook a processa
ENTÃO existe uma linha em `pagamento_eventos` registrando o não encontrado
E a resposta é 5xx, para o gateway reenviar
```

### T27 — Assinatura inválida também é registrada
*Cobre: RN15*
```gherkin
QUANDO chega uma notificação com assinatura que não confere
ENTÃO a resposta é 401 e o evento fica gravado
E nenhuma cobrança ou pedido é tocado
```

### T28 — Idempotência é do banco
*Cobre: RN16*
```gherkin
QUANDO duas notificações do mesmo pagamento são processadas em paralelo
ENTÃO só uma cobrança é aprovada, por violação do índice único
E a segunda é registrada como duplicada
```

### T29 — Valor vem do gateway, não do corpo
*Cobre: RN17*
```gherkin
DADO uma notificação forjada declarando valor maior que o do pedido
QUANDO o webhook consulta o gateway e encontra valor menor
ENTÃO o evento é `valor_divergente` e a cobrança não é aprovada
```

### T30 — Dinheiro que entrou não é recusado
*Cobre: RN18*
```gherkin
DADO um pagamento aprovado para uma fornada que ficou inviável
QUANDO a notificação chega
ENTÃO o pedido fica pago com o veredito gravado
E o evento registra o motivo da inviabilidade
```

### T31 — Estorno encerra e devolve
*Cobre: RN19*
```gherkin
DADO um pedido pago
QUANDO chega notificação de estorno
ENTÃO a cobrança vira `estornada`, a situação derivada vira `estornado` e o pedido vira `cancelado`
E o evento registra se o que voltou foi vaga de forno ou lote pronto
```

---

## Categoria E — Segurança e bordas

### T32 — Pedido de outra pessoa não existe
*Cobre: RN8*
```gherkin
DADO um pedido do cliente A
QUANDO o cliente B abre a tela de pagar daquele pedido
ENTÃO ele recebe 404, igual a pedido inexistente
```

### T33 — Cobrança é invisível ao cliente pela API do banco
*Cobre: RN1*
```gherkin
QUANDO um cliente autenticado consulta `cobrancas` diretamente
ENTÃO a RLS devolve conjunto vazio, mesmo para as cobranças dele
E só a aplicação, pelo caminho do servidor, lê a situação derivada
```

### T34 — Pedido já pago não abre nova cobrança
*Cobre: RN10*
```gherkin
DADO um pedido já pago
QUANDO chega um envio de pagamento para ele
ENTÃO a resposta é 409 e nenhuma cobrança é criada
```

### T35 — Gateway fora do ar mantém a vaga
*Cobre: RN12*
```gherkin
DADO um pedido reservado
QUANDO o gateway não responde ao envio do pagamento
ENTÃO a cobrança é encerrada como expirada e a resposta é 503
E a reserva do pedido continua viva até o vencimento normal
```

### T36 — Sem credencial, o Brick não é oferecido
*Cobre: RN8*
```gherkin
DADO um ambiente com `PAGAMENTO_PROVIDER=fake`
QUANDO o cliente abre a tela de pagar
ENTÃO o painel de simulação aparece no lugar do formulário do gateway
E nenhuma chamada ao SDK do Mercado Pago é feita
```

---

## Categoria F — O gateway de verdade (RN20)

> Verificação **manual**, contra o Mercado Pago em ambiente de desenvolvimento, pelo túnel `cloudflared`, com credenciais de teste e assinatura HMAC real. Cada linha só é marcada com o `mp_payment_id` observado e a linha correspondente de `pagamento_eventos`. **Simulação não conta** — foi a lacuna que produziu o defeito da RN14.

### T37 — Os seis caminhos
*Cobre: RN20*

**Execução em 2026-09-06**, contra a conta NAPOBSB com credenciais `TEST-`, pelo túnel
`attribute-screen-none-cards.trycloudflare.com`, com `PAGAMENTO_PROVIDER=mercado_pago`.

| # | Caminho | Estado | Evidência |
|---|---|---|---|
| 1 | Pix aprovado | ⏳ **bloqueado** | ver nota abaixo |
| 2 | Cartão aprovado | ⏳ **bloqueado** | 6 tentativas; sem `binary_mode` caem em `pending_contingency`, com ele recusam — a simulação por nome do titular não vale nesta conta |
| 3 | Cartão recusado | ✅ | pagamentos `1351485149` e `1328078678`, `cc_rejected_other_reason`; notificação real → evento `pagamento_nao_aprovado` com detalhe `recusado` |
| 4 | Pix pendente | ✅ | pagamento `1328075818`, `pending_waiting_transfer`, **QR devolvido**; evento `pagamento_nao_aprovado` |
| 5 | Notificação duplicada | ⏳ **bloqueado** | depende de uma cobrança aprovada existir |
| 6 | Assinatura inválida | ✅ | `401` + evento `assinatura_invalida` (`mp_payment_id` = `teste`) |

**O que ficou provado contra o gateway real, além dos dois caminhos fechados:**

- **A assinatura HMAC real confere.** Quatro notificações do Mercado Pago chegaram pelo
  túnel e nenhuma virou `assinatura_invalida` — o caminho que o NAPO-006 nunca exercitou.
- **RN14 corrigida e provada:** notificação de pagamento que o gateway não conhece
  devolveu `502` **com** a linha em `pagamento_eventos`. No código antigo era `500` sem
  rastro nenhum — o defeito que originou esta spec.
- **Status novo não confirma por omissão:** `in_process` virou `pendente` e nenhum pedido
  foi confirmado, em três notificações independentes.
- **`consultarPagamento` contra a API real** rodou em cada notificação, sem exceção.

**Achado que vale virar decisão de produto: `binary_mode`.** Sem a flag, todo cartão desta
conta para em `pending_contingency` — e continuava lá 2h30 depois. Com ela, o gateway
decide na hora. Isso importa além do teste: um cartão "em análise" segura vaga de fornada
por horas contra uma reserva de 30 minutos, e o cliente fica sem resposta. Ligar
`binary_mode` troca essa espera por um não imediato — ao custo de recusar o que a análise
poderia aprovar. Não foi ligado no adaptador; está registrado como pergunta ao PM.

**Bloqueio dos caminhos 1, 2 e 5:** a simulação determinística por nome do titular
(`APRO`) não tem efeito com estas credenciais. O Mercado Pago exige credenciais de um
**usuário de teste vendedor**, e o `MP_ACCESS_TOKEN` é a credencial de teste da conta real
NAPOBSB (termina em `-3567856762`; a do vendedor de teste terminaria em `-3665486978`).
Tentativa por API descartada: `POST /applications` e a listagem de test users respondem
403/405 — aplicação só nasce no painel. O par de usuários de teste já existe
(vendedor `3665486978`, comprador `3665500982`); falta só criar a aplicação no painel
logado como o vendedor.

---

## Critérios visuais de aceite

*Derivados do [`preview.html`](./preview.html) aprovado no Gate Visual A. Verificados a olho nu no Gate Visual B do `/implementar`, na aplicação real.*

1. O passo 2 do checkout afirma que o pagamento acontece **no site**, e o botão do resumo diz **"Reservar e pagar R$ X"** — em nenhuma tela sobra a promessa antiga de ir ao ambiente do Mercado Pago.
2. Os selos de forma de pagamento usam `<Badge>` do catálogo, não `<span>` com classes soltas.
3. A tela de pagar mostra o cronômetro no topo, em fonte mono tabular, decrescendo de verdade — e aos 00:00 o formulário some da tela.
4. O Brick aparece com tema escuro, sobre `--color-superficie`, com raio e tipografia dos tokens — sem faixa branca, sem fonte de sistema e sem borda clara em volta.
5. A recusa aparece em **card permanente** com a nossa mensagem e um botão de tentar outro cartão; nunca em toast, nunca com texto do gateway.
6. Em viewport ≥1280px nenhuma das três telas tem texto cortado, sobreposto ou colado na borda; abaixo de 768px o Brick ocupa a largura inteira e o resumo colapsa para o topo, sem barra fixa disputando espaço com o teclado.
7. A tela do pedido mostra a situação de pagamento derivada e oferece o caminho de volta ao pagamento enquanto a vaga viver.
8. Nenhuma tela do fluxo exibe bolha de validação nativa do navegador nem página de erro de terceiro (`ARCHITECTURE.md` §2.2.3).
9. **Vocabulário:** nas superfícies onde o cliente reserva e possui — ficha do resumo, frase da reserva, cronômetro, expiração e tela do pedido — a palavra é **entrega**. "Fornada" só aparece onde explica a escassez (vitrine, barra, seletor, "esgotado nesta fornada"). Nenhuma tela do checkout ou do pagamento diz "vaga na fornada".

---

## Checklist de Conclusão

*Marque `[x]` SOMENTE com evidência verificável.*

### Testes
- [ ] Todos os cenários T1..T37 passam
- [ ] pgTAP verde, com T5–T9 (derivação) e T12–T13 (`vagas_ocupadas`) escritos **antes** de qualquer código de aplicação
- [ ] Playwright cobre reservar → pagar → confirmar ponta a ponta com o adaptador `fake`
- [ ] Cada RN do `spec.md` tem ≥1 cenário correspondente

### Qualidade
- [ ] Lint verde · Typecheck verde
- [ ] Build verde — **com o dev server derrubado antes** (postmortem 2026-08-18)
- [ ] `NEXT_PUBLIC_MP_PUBLIC_KEY` presente no bundle do navegador; `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` **ausentes**
- [ ] Sem `console.log` esquecidos e sem `TODO` sem ideia vinculada

### Escopo
- [ ] Apenas arquivos do Mapa de Impacto (`design.md` §1) foram modificados
- [ ] `package.json` só ganhou `@mercadopago/sdk-react`
- [ ] Nenhum instrumento além de `online` ganhou tela

### Gates
- [x] **Gate Visual B** (aprovado pelo PM em 2026-09-06) — as três telas abertas na aplicação real **antes** de qualquer bloco ser declarado verde, com aprovação explícita do PM (postmortem 2026-08-18, `AGENTS.md` §2 item 11b)
- [~] **T37 (RN20)** — 2 de 6 caminhos fechados; 4 bloqueados por credencial da conta (ver §F)

### Fechamento
- [ ] Retrospectiva feita (`AGENTS.md` §5.1)
- [ ] `ROADMAP.md` atualizado — NAPO-025 em ✅ Concluídos com data
- [ ] `spec.md` com **Status: Concluído**
- [ ] Push para `origin/main`
