# ✅ Tests: Carrinho e checkout com Mercado Pago

**Spec:** [`spec.md`](./spec.md)
**Design:** [`design.md`](./design.md)

> 📌 **Contrato executável.** O módulo está pronto quando TODOS os cenários passam.
> Testes escritos **ANTES** da implementação (`AGENTS.md` §3.2).

> **Ferramentas por alvo:** `packages/core` e rotas → **Vitest** · RLS e funções SQL → **pgTAP** · fluxo ponta a ponta do checkout → **Playwright** (exigência da spec do R1 §9).
>
> **Ordem obrigatória:** os cenários de `vagas_ocupadas` (T33, T34) são escritos e passam **antes** de qualquer código de checkout — a função é compartilhada com o motor de disponibilidade do NAPO-004 e errá-la quebra a vitrine inteira (`design.md` §8).

---

## Background compartilhado

```gherkin
DADO a configuração de operação padrão (entrega às sextas, produção seg–sex, teto de 30/dia)
E o catálogo com os 12 produtos ativos do NAPO-003
E o adaptador de pagamento em modo `fake` (salvo onde o cenário disser o contrário)
```

---

## Categoria A — Cenários funcionais

### T1 — Carrinho monta sem conta
*Cobre: RN1*
```gherkin
DADO um visitante anônimo na página de um sabor
QUANDO ele adiciona 2 unidades ao carrinho
ENTÃO o contador do cabeçalho mostra 2 sem nenhuma chamada de autenticação
E o carrinho sobrevive a recarregar a página
```

### T2 — O pedido vai para o dia mais tardio entre os itens
*Cobre: RN2*
```gherkin
DADO um carrinho com um sabor viável em 22/08 e outro só a partir de 29/08
QUANDO o cliente abre o checkout
ENTÃO o dia de entrega exibido é 29/08 para o pedido inteiro
E a tela informa qual sabor determinou a data
```

### T3 — Pedido congela nome, preço e endereço
*Cobre: RN4*
```gherkin
DADO um pedido pago de Calabresa a R$ 39,90 entregue em SQN 210 Bloco C
QUANDO o preço da faixa sobe para R$ 42,90 e o cliente edita o endereço na conta
ENTÃO o pedido continua exibindo R$ 39,90 e o endereço original
```

### T4 — Pix chega pré-selecionado
*Cobre: RN6*
```gherkin
DADO um checkout pronto para pagar
QUANDO a cobrança é criada
ENTÃO a preferência declara Pix como meio preferencial
E nenhum desconto é aplicado ao total por causa do meio de pagamento
```

### T5 — A reserva nasce antes da cobrança e com o prazo do pagamento
*Cobre: RN7*
```gherkin
DADO `config_operacao.pagamento_minutos` igual a 30
QUANDO o cliente clica em pagar
ENTÃO existe reserva ativa para os itens antes de a cobrança ser criada
E `reserva.expira_em` e `pedido.expira_em` são o mesmo instante, 30 minutos à frente
```

### T6 — Notificação verificada confirma o pedido
*Cobre: RN8*
```gherkin
DADO um pedido em `aguardando_pagamento`
QUANDO chega notificação válida de pagamento aprovado
ENTÃO o pedido passa a `pago` com `pago_em` e `mp_payment_id` gravados
E a resposta é 200
```

### T7 — Notificação repetida não processa duas vezes
*Cobre: RN9*
```gherkin
DADO um pedido já confirmado por uma notificação
QUANDO a mesma notificação chega de novo
ENTÃO a resposta é 200 sem alterar o pedido
E a capacidade ocupada do dia continua a mesma
```

### T8 — Pagamento aprovado com dia inviável nasce pago e alerta
*Cobre: RN11*
```gherkin
DADO um pedido aguardando pagamento cujo dia encheu depois da reserva
QUANDO a notificação de aprovação chega
ENTÃO o pedido passa a `pago` com veredito `sem_vaga`
E o evento fica registrado para o alerta do admin
```

### T9 — Confirmação consome a reserva e ocupa a vaga pelo pedido
*Cobre: RN12*
```gherkin
DADO um pedido confirmado com 3 unidades para 22/08
QUANDO a reserva vence
ENTÃO a reserva está `consumida` e a disponibilidade de 22/08 continua reduzida em 3
```

### T10 — Cancelar antes do cutoff devolve capacidade
*Cobre: RN14*
```gherkin
DADO um pedido pago para 22/08 e o cutoff ainda não vencido
QUANDO o cliente cancela
ENTÃO o pedido fica `cancelado` e a devolução registrada é `capacidade`
E a vaga volta a aparecer na disponibilidade de 22/08
```

### T11 — Cancelar depois do cutoff devolve lote
*Cobre: RN14*
```gherkin
DADO um pedido pago para 22/08 e o cutoff já vencido
QUANDO o cancelamento é feito pela equipe
ENTÃO a devolução registrada é `lote`
```

### T12 — Pedido nasce com canal e atividade fiscal
*Cobre: RN20*
```gherkin
QUANDO um pedido é criado pelo site
ENTÃO `canal` é `site` e `atividade_fiscal` é `congelado_industrializado`
```

---

## Categoria B — Cenários de validação

### T13 — Total enviado pelo cliente é ignorado
*Cobre: RN3*
```gherkin
DADO um carrinho de R$ 129,70
QUANDO a requisição de criação inclui campos de total, frete ou distância
ENTÃO os campos extras são rejeitados pelo schema
E o total do pedido é o recalculado pelo servidor
```

### T14 — Preço divergente bloqueia e pede reconfirmação
*Cobre: RN3*
```gherkin
DADO um carrinho montado quando a Calabresa custava R$ 37,90
QUANDO o preço vira R$ 39,90 e o cliente tenta pagar
ENTÃO a resposta é 409 com o preço antigo e o novo
E nenhum pedido e nenhuma reserva são criados
```

### T15 — Pedido vencido expira e devolve a vaga
*Cobre: RN13*
```gherkin
DADO um pedido `aguardando_pagamento` com `expira_em` no passado
QUANDO a rotina de manutenção roda
ENTÃO o pedido fica `expirado` e a reserva é liberada
E a disponibilidade do dia volta ao valor anterior
```

### T16 — Cliente não cancela depois do cutoff
*Cobre: RN15*
```gherkin
DADO um pedido pago cujo cutoff já venceu
QUANDO o cliente chama o cancelamento
ENTÃO a resposta é 409 e o pedido permanece `pago`
E a tela oferece contato em vez do botão
```

### T17 — Número do pedido é único, sequencial e imutável
*Cobre: RN16*
```gherkin
DADO dois pedidos criados em sequência
ENTÃO os números são distintos e crescentes
E cancelar o primeiro não libera o número dele para reuso
```

### T18 — Endereço fora de área não fecha pedido
*Cobre: RN18*
```gherkin
DADO um endereço com `atendido = false`
QUANDO o cliente tenta criar o pedido com ele
ENTÃO a resposta é 422 e nada é persistido
```

### T19 — Frete vem da faixa, não do cliente
*Cobre: RN18*
```gherkin
DADO um endereço a 3,2 km
QUANDO o pedido é criado
ENTÃO o frete gravado é R$ 6,00, calculado pelo núcleo a partir da distância do banco
E um subtotal de R$ 150,00 ou mais grava frete zero pela regra de frete grátis
```

---

## Categoria C — Cenários de segurança

### T20 — Pagar exige sessão e telefone validado
*Cobre: RN1, RN5*
```gherkin
DADO um visitante anônimo com carrinho montado
QUANDO ele chama a criação do pedido
ENTÃO recebe 401
E um cliente logado sem telefone validado recebe 403
```

### T21 — Não existe caminho de pedido sem pagamento
*Cobre: RN5*
```gherkin
DADO um cliente autenticado e validado
QUANDO ele tenta criar pedido declarando forma de pagamento na entrega
ENTÃO o schema rejeita e nenhum pedido é criado
```

### T22 — Cliente não muda status do próprio pedido
*Cobre: RN17*
```gherkin
DADO um cliente dono de um pedido `aguardando_pagamento`
QUANDO ele tenta atualizar o status para `pago` pela API do banco
ENTÃO a escrita é negada pela RLS
```

### T23 — Cliente A não lê pedido de B
*Cobre: RN17*
```gherkin
DADO um pedido do cliente A
QUANDO o cliente B consulta pelo número
ENTÃO recebe 404
E o mesmo `select` com a sessão de B não devolve linha
```

<!-- expandir: RN17 cruza cinco papéis com dois comandos; um cenário por papel esconderia qual combinação falhou -->
### T24 — Equipe lê, ninguém escreve pelo cliente
*Cobre: RN17*
```gherkin
DADO um pedido do cliente A
QUANDO atendente, cozinha, gerente e admin consultam
ENTÃO todos leem o pedido
E nenhum deles consegue inserir pedido em nome de A
E o papel anônimo não lê nem escreve
```

### T25 — Notificação com assinatura inválida é recusada
*Cobre: RN10*
```gherkin
DADO uma notificação com assinatura forjada
QUANDO ela chega ao webhook
ENTÃO a resposta é 401, o pedido não muda
E o evento fica registrado como recusado
```

### T26 — Valor divergente não confirma o pedido
*Cobre: RN10*
```gherkin
DADO um pedido de R$ 135,70
QUANDO a consulta ao Mercado Pago devolve pagamento aprovado de R$ 1,00
ENTÃO o pedido permanece `aguardando_pagamento`
E o evento é registrado como divergência para alerta
```

### T27 — O corpo da notificação nunca é fonte de valor
*Cobre: RN8, RN10*
```gherkin
DADO uma notificação com assinatura válida declarando status aprovado no corpo
QUANDO a consulta ao Mercado Pago devolve o pagamento como recusado
ENTÃO o pedido permanece `aguardando_pagamento`
```

### T28 — Transição de status é auditada
*Cobre: RN21*
```gherkin
QUANDO um pedido passa de `aguardando_pagamento` para `pago`
ENTÃO existe registro em `auditoria` com estado anterior, posterior e autor
```

### T29 — Rota de manutenção exige segredo
*Cobre: RN13, RN19*
```gherkin
QUANDO a rota de manutenção é chamada sem o header de segredo
ENTÃO a resposta é 401 e nenhum pedido é tocado
```

---

## Categoria D — Cenários não-funcionais

### T30 — Webhook responde rápido e falha barulhento
*Cobre: RN9, RN8*
```gherkin
QUANDO uma notificação duplicada chega
ENTÃO a resposta 200 sai sem nenhuma escrita no banco
E quando a confirmação lança erro interno, a resposta é 5xx para forçar reenvio
```

### T31 — Checkout usável em 375 px
```gherkin
QUANDO o checkout é aberto em viewport de 375 px
ENTÃO o total e o botão de pagar ficam visíveis sem rolagem adicional
E não há rolagem horizontal, com alvos de toque de no mínimo 44 px
```

---

## Categoria E — Cenários de borda

### T32 — Carrinho vazio não vira pedido
*Cobre: RN3*
```gherkin
QUANDO a criação de pedido chega com lista de itens vazia
ENTÃO a resposta é 400 e nada é persistido
```

### T33 — `vagas_ocupadas` conta reserva viva e pedido ativo
*Cobre: RN12*
```gherkin
DADO 2 unidades em reserva ativa e 3 unidades em pedido pago para 22/08
QUANDO `vagas_ocupadas` é consultada
ENTÃO devolve 5
```

### T34 — `vagas_ocupadas` ignora o que não ocupa
*Cobre: RN12, RN13*
```gherkin
DADO reserva vencida, pedido `expirado` e pedido `cancelado` no mesmo dia
QUANDO `vagas_ocupadas` é consultada
ENTÃO devolve 0
```

### T35 — Duas confirmações simultâneas do mesmo pagamento
*Cobre: RN9*
```gherkin
DADO duas notificações do mesmo pagamento processadas em paralelo
QUANDO ambas passam pela verificação ao mesmo tempo
ENTÃO exatamente uma confirma, pelo índice único
E a capacidade do dia é reduzida uma única vez
```

### T36 — Carrinho inteiro não cabe mais na fornada
*Cobre: RN7*
```gherkin
DADO um carrinho de 3 itens onde só 2 ainda cabem no dia
QUANDO o cliente clica em pagar
ENTÃO a resposta é 409, nenhuma reserva parcial é criada
E nada é cobrado
```

### T37 — Mercado Pago indisponível não prende vaga
*Cobre: RN7, RN13*
```gherkin
DADO que a criação da cobrança falha no gateway
QUANDO o cliente clica em pagar
ENTÃO a reserva é liberada na mesma requisição e o pedido fica `expirado`
E a resposta é 503 com o carrinho preservado
```

### T38 — Webhook perdido é recuperado por consulta ativa
*Cobre: RN19*
```gherkin
DADO um pagamento aprovado cuja notificação nunca chegou
QUANDO o cliente abre a página do pedido
ENTÃO a consulta ao Mercado Pago confirma e o pedido passa a `pago`
```

### T39 — Estorno notificado reflete no pedido
*Cobre: RN14*
```gherkin
DADO um pedido `pago`
QUANDO chega notificação verificada de estorno
ENTÃO o pedido passa a `estornado` e a devolução correspondente é registrada
```

### T40 — Carrinho corrompido no navegador não quebra a tela
*Cobre: RN1*
```gherkin
DADO conteúdo inválido gravado na chave do carrinho
QUANDO a página abre
ENTÃO o carrinho é tratado como vazio, sem erro em tela
```

### T41 — Item esgotado é sinalizado no carrinho
*Cobre: RN1, RN2*
```gherkin
DADO um carrinho com um sabor que esgotou na fornada
QUANDO o carrinho é revalidado
ENTÃO o item aparece marcado como esgotado com a ação de remover
E o checkout não avança sem a decisão do cliente
```

---

## Critérios visuais de aceite

*Verificados a olho nu no Gate Visual B do `/implementar`, contra [`preview.html`](./preview.html).*

1. **O bloco da fornada é o topo do resumo do checkout** (direção A), com o dia em peso extrabold e tamanho maior que o total, e o recorte de canhoto visível na borda entre cabeçalho e corpo do card.
2. **O frete não aparece no carrinho** — a linha diz "no próximo passo", nunca um valor.
3. **O dia de entrega aparece com o motivo** ("é a primeira fornada que assa todos os seus sabores"), nunca sozinho.
4. **Endereço fora de área é visível e desabilitado**, com o motivo em texto — nunca escondido da lista.
5. **Nenhuma linha do tempo de status.** O estado do pedido é um `<Badge>` com data ao lado.
6. **Avisos de preço mudado e item esgotado são cards que permanecem em tela** até ação do cliente — nunca toast.
7. **O contador do cabeçalho some quando o carrinho está vazio** (ícone sem número, não "0").
8. **Em 375 px o resumo vira barra fixa no rodapé** com total e botão, sem rolagem horizontal em nenhuma das três telas.
9. **Nenhum texto cortado, sobreposto ou colado em borda** em viewport ≥1280 px.
10. **Tokens reais** — nenhuma cor fora de `packages/ui/src/tokens.css`.

---

## Rastreabilidade RN → cenários

| RN | Cenários |
|---|---|
| RN1 carrinho livre | T1, T20, T40, T41 |
| RN2 um pedido, um dia | T2, T41 |
| RN3 total no servidor | T13, T14, T32 |
| RN4 snapshot | T3 |
| RN5 pagamento obrigatório | T20, T21 |
| RN6 Pix sem desconto | T4 |
| RN7 reserva antes de cobrar | T5, T36, T37 |
| RN8 webhook é a verdade | T6, T27, T30 |
| RN9 idempotência | T7, T30, T35 |
| RN10 notificação verificada | T25, T26, T27 |
| RN11 dinheiro não é recusado | T8 |
| RN12 consumo da vaga | T9, T33, T34 |
| RN13 expiração | T15, T29, T34, T37 |
| RN14 devolução e estorno | T10, T11, T39 |
| RN15 cutoff barra cancelamento | T16 |
| RN16 número do pedido | T17 |
| RN17 isolamento | T22, T23, T24 |
| RN18 endereço e frete | T18, T19 |
| RN19 pedido parado | T29, T38 |
| RN20 canal e atividade fiscal | T12 |
| RN21 auditoria | T28 |

---

## Checklist de Conclusão

*Marque `[x]` SOMENTE com evidência verificável.*

### Testes
- [ ] T1..T41 passam (`pnpm test` verde, com output)
- [ ] pgTAP verde, com T33 e T34 escritos **antes** de qualquer código de checkout
- [ ] Playwright cobre o caminho felizardo ponta a ponta (spec do R1 §9)
- [ ] Cada RN do `spec.md` tem ≥1 cenário (tabela de rastreabilidade acima)

### Qualidade
- [ ] Lint verde · typecheck verde
- [ ] Build verde — **com o dev server derrubado antes** (`AGENTS.md` §2 item 12)
- [ ] Sem `console.log` esquecidos · sem `TODO` sem ideia vinculada

### Integração real (não substituível por mock)
- [ ] Fluxo exercitado com `PAGAMENTO_PROVIDER=mercado_pago`, credenciais de teste e túnel público
- [ ] Notificação real recebida, assinatura verificada e pedido confirmado ponta a ponta
- [ ] Verificado no bundle do navegador: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e `MANUTENCAO_SECRET` **ausentes**

### Gate Visual B
- [ ] As três telas abertas no ambiente real **antes** de qualquer bloco ser declarado verde (`AGENTS.md` §2 item 11b)
- [ ] Os 10 critérios visuais acima auditados pelo agente
- [ ] Aprovação explícita do PM na aplicação real

### Escopo
- [ ] Apenas arquivos do Mapa de Impacto (`design.md` §1) modificados
- [ ] `package.json` só ganhou `mercadopago` (`design.md` §6.1)

### Fechamento
- [ ] Retrospectiva feita (`AGENTS.md` §5.1)
- [ ] `ROADMAP.md` atualizado · `spec.md` com `Status: Concluído`
- [ ] Push para `origin/main`
