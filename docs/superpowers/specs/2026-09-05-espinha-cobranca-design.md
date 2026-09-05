# Spec — Espinha de Cobrança: venda e pagamento em todos os canais

> **Status:** aprovado para decomposição · **Data:** 2026-09-05
> **Escopo:** o modelo de cobrança que serve site, WhatsApp, balcão, rua, eventos e
> marketplaces. Substitui a decisão de Checkout Pro do `ARCHITECTURE.md` §2.1 e
> absorve o NAPO-023. Não é uma spec de implementação — é o desenho que gera seis
> itens de ROADMAP, cada um com sua própria spec.

---

## 1. Contexto

O NAPO-006 entregou o checkout online com `PAGAMENTO_PROVIDER=fake`: o fluxo nunca
tocou o Mercado Pago de verdade. O item seguinte na fila (NAPO-023) era exercitar
esse caminho em desenvolvimento.

Ao especificá-lo, o PM levantou dois requisitos que o item não comportava:

1. **O cliente não deve sair do site para pagar** — a experiência imersiva importa.
2. **As vendas de balcão e de rua precisam nascer no sistema**, com a cobrança indo
   para a maquininha Mercado Pago que a casa já opera.

O segundo requisito não é uma feature: é a espinha de vendas do negócio. Este
documento é o resultado do brainstorming que decorreu daí.

### 1.1 Como a Napo vende hoje

| Canal | Como funciona hoje | Registro |
| --- | --- | --- |
| Site | pagamento online antecipado | automático |
| **WhatsApp** | encomenda no chat; entregador cobra na maquininha na entrega | **manual, um dia antes, para bater estoque** |
| Balcão | cliente leva e paga na hora | frequentemente nenhum |
| **Carga de rua** | vendedor sai com ~30 pizzas; sistema registra só "saíram 30" | agregado, sem cliente |

O WhatsApp com pagamento na entrega é o **canal dominante** — cerca de 99% dos
clientes pagam normalmente. Não há problema de calote a resolver.

### 1.2 O problema real

**A baixa depende de disciplina humana, e disciplina humana não escala.**

O pedido fica registrado, ninguém dá baixa de entrega nem de pagamento, e um sócio
reconstrói a verdade depois pelo WhatsApp e pela memória. Decisão administrativa
remota fica impossível: para saber o que aconteceu, é preciso perguntar no grupo.

O objetivo deste desenho não é pedir mais disciplina. É fazer o sistema não precisar
dela.

---

## 2. Diagnóstico: três eixos, não um

O sistema hoje crava **uma** combinação: origem `site` + momento `antecipado` +
instrumento `checkout online`. Tudo que a operação real faz são outras combinações de
três eixos independentes:

| Eixo | Valores |
| --- | --- |
| **Origem** | site · WhatsApp · balcão · carga de rua · evento · marketplace |
| **Momento** | antecipado · no ato · na entrega · a combinar |
| **Instrumento** | online · maquininha Point · Pix QR · link · dinheiro |

O ROADMAP fragmentava isso em módulos independentes (NAPO-008 admin, 010 eventos,
012 KDS, 013 PDV, 014 iFood). Se cada um implementar seu próprio pagamento, a matriz
é reescrita a cada canal — em código que mexe em dinheiro, com cinco cópias livres
para divergir sobre quando um pedido está pago.

### 2.1 Alternativas rejeitadas

**Cada canal com seu fluxo de pagamento.** Entrega o primeiro canal mais rápido e
evita refatorar o checkout atual. Rejeitada: conciliação e dedução de taxa
reimplementadas por canal, e risco concreto de balcão e site discordarem sobre o
estado de um pedido.

**Terceirizar na Orders API unificada do Mercado Pago.** Eles estão migrando Payment
Intents → Orders justamente para unificar online, Point e QR sob um contrato só.
Rejeitada como estratégia: acopla a espinha do negócio ao roadmap deles e **não
resolve o que é nosso** — consignação, dinheiro na entrega, quem devolveu pizza. A
Orders API continua candidata *dentro* do adaptador.

---

## 3. Decisão: cobrança é entidade de primeira classe

Hoje pagamento é um punhado de campos no pedido. Passa a ser entidade própria.

**`pedido`** continua respondendo *o que foi vendido, para quem, quando entrega*. Não
sabe de dinheiro além do total.

**`cobranca`** é **uma tentativa de receber um valor de um pedido**: instrumento,
valor, status, quem criou e o rastro do gateway.

Um pedido tem **0..n cobranças**:

- **0** — pagamento na entrega, ainda não iniciado
- **1** — o caso comum
- **n** — tentou no Point, cartão recusou, gerou Pix. Cada tentativa fica registrada

`situacao_pagamento` do pedido é **derivada das cobranças**, nunca um campo que
alguém pode esquecer de atualizar. Campo solto é como pedido pago aparece pendente às
22h de sexta.

Sinal e saldo de evento saem de graça: são duas cobranças do mesmo pedido.

### 3.1 Os cinco instrumentos

| Instrumento | Como cobra | Como confirma |
| --- | --- | --- |
| `online` | cliente paga no site (Bricks) | webhook |
| `point` | intenção de pagamento para o `device_id` | webhook |
| `pix_qr` | QR na nossa tela | webhook |
| `link` | URL compartilhável (WhatsApp, SMS) | webhook |
| `dinheiro` | operador declara | **humano** — não existe gateway |

Quatro dos cinco confirmam por notificação do gateway e reaproveitam **o mesmo
pipeline de confirmação já escrito e testado** no NAPO-006. As RN8, RN9, RN10 e RN11
sobrevivem intactas — inclusive **RN8: quem confirma é o webhook, nunca a tela**.

Ressalva de implementação: `point` não chega pelo mesmo *tópico*. `online`, `pix_qr` e
`link` chegam em `payment`; a intenção de pagamento do Point chega em
`point_integration_wh` (ou `orders`, na Orders API). São duas portas de entrada para o
mesmo `confirmar-pagamento.ts`, não um endpoint só.

**`dinheiro` é a exceção honesta.** Sem gateway, a confirmação é declaração de um
operador identificado. Não é brecha: é o que torna o acerto do vendedor possível
("você declarou R$ 480 em dinheiro, entregue R$ 480"). Exige responsável gravado.

**Decisão do PM (2026-09-05):** dinheiro é ofertado, mas **sem destaque**. Os
instrumentos com confirmação automática ocupam a escolha primária; dinheiro fica
atrás de um passo a mais. Não é bloqueio — é atrito deliberado.

### 3.2 Sair do Checkout Pro

O requisito de não redirecionar o cliente **só é atendível com Checkout Bricks**: o
modal do Checkout Pro foi descontinuado em 21/12/2023, por causa da restrição de
cookies de terceiros do Google. Hoje o Checkout Pro só existe em redirect.

O Payment Brick roda no nosso domínio, com cartão, Pix (QR na nossa página), boleto e
conta Mercado Pago. O cartão é tokenizado pelo SDK deles em campos isolados — dado
sensível não passa pelo nosso servidor.

O que quebra na troca: `criarCobranca() → {preferenciaId, urlPagamento}` deixa de
fazer sentido; o `PagamentoFake` muda de forma; entra `NEXT_PUBLIC_MP_PUBLIC_KEY` e a
dependência `@mercadopago/sdk-react`; a tela de checkout ganha o Brick, o que dispara
Gate Visual A.

O que sobrevive: webhook, assinatura HMAC, idempotência, `confirmar-pagamento.ts`
inteiro, consulta ativa da RN19 e a porta `PortaPagamento` — que foi criada
exatamente para isto.

**Trade-offs aceitos:** o Brick é customizável (cores, fonte, raio) mas é componente
deles — não fica 100% na identidade Napo. E o pagamento em um toque com cartão salvo
do Mercado Pago deixa de vir de graça: vira o Wallet Brick, se e quando fizer sentido.

**Exige ADR** — `ARCHITECTURE.md` §2.1 crava "Checkout Pro".

---

## 4. Momentos de pagamento

O cliente escolhe **no ato da compra**. Isso é parte do contrato do pedido, não uma
preferência de tela.

| Momento | Quem usa | O pedido nasce |
| --- | --- | --- |
| `antecipado` | site, link no WhatsApp | confirma depois do dinheiro (o que existe hoje) |
| `no_ato` | balcão, rua com a maquininha do lado | pedido e cobrança no mesmo gesto |
| `na_entrega` | WhatsApp, rua | devendo |
| `a_combinar` | eventos | sinal agora, saldo depois |

### 4.1 Nenhuma trava para `na_entrega`

Um pedido `na_entrega` consome vaga de forno e estoque sem dinheiro nenhum, e vaga de
forno é o ativo escasso do negócio (47% de ocupação, `docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`).

**Decisão: não construir trava nenhuma.** Com ~99% de conversão, qualquer limite de
valor ou regra de "só cliente com histórico" perde venda boa para resolver um
problema de 1%.

O que a espinha **precisa** fazer é registrar a evidência para a decisão futura
existir: quem escolheu `na_entrega`, quem honrou, quem não apareceu, quanto custou. É
barato agora e impossível de recuperar retroativamente.

Isso converte a ideia **"Histórico de calote/no-show por cliente"**, hoje parada em 💡
no ROADMAP: deixa de ser feature e vira consequência automática.

---

## 5. A baixa é subproduto, não tarefa

**Princípio: toda mudança de estado nasce de um ato que a pessoa já precisa fazer de
qualquer jeito para receber.**

**Pagamento — resolvido.** O operador manda o valor para a maquininha pelo sistema, o
cliente paga, o webhook chega, o pedido vira `pago` com a forma de pagamento junto.
Ninguém marca nada.

**Entrega — resolvida junto, com uma condição.** Para pedido `na_entrega`, uma
**cobrança no instrumento `point` aprovada é prova de entrega**: a maquininha estava
fisicamente na porta do cliente.

A condição importa: **vale para `point`, não para `link`.** Link aprovado só prova que
alguém pagou — pode ter pago com o entregador a dez quadras. Confundir os dois
marcaria pedido como entregue sem pizza na mão de ninguém.

**O que sobra manual:** pedido pago antecipado no site chega na porta já pago, sem
cobrança que sirva de prova. Precisa de gesto rápido do entregador — não de
formulário.

**Consequência para o sócio:** o painel reflete a realidade porque o dado nasce do ato
de cobrar, não de alguém alimentar o sistema depois.

---

## 6. Os três anéis de controle

Não dá para forçar o fluxo, e não se deve tentar: regra que atrapalha na porta do
cliente é regra que o entregador burla — e aí se perde o dado *e* a venda.

O PM descreveu dois cenários reais de pagamento fora do sistema:

- **A** — pedido existe; o entregador cobra direto na maquininha, ou em dinheiro, ou o
  cliente faz Pix para a conta. Entrega e pagamento aconteceram; o sistema só soube
  depois.
- **B** — alguém passa na loja, leva uma pizza, paga. Nenhuma venda registrada.

A resposta: **mesmo quando o pagamento não passa pelo nosso sistema, ele passa pelo
Mercado Pago** — e isso é legível por relatório.

| Anel | Como o dado chega | Esforço humano | Objetivo |
| --- | --- | --- | --- |
| **1. Integrado** | cobrança nasce no sistema, webhook confirma | zero | maximizar |
| **2. Conciliado** | pagamento nasce no MP, o sistema pesca e casa | um toque | rede de segurança |
| **3. Declarado** | alguém digita | total | minimizar |

**Cenário A** → o pagamento aparece no relatório sem a nossa referência; o sistema
casa por maquininha + valor + janela de tempo e propõe. Casamento inequívoco pode
fechar sozinho.

**Cenário B** → dinheiro sem pedido nenhum. O sistema não adivinha o sabor, mas
avisa: *"R$ 75 recebidos na maquininha do balcão às 14:32, sem venda registrada."*
Alguém registra retroativamente; estoque baixa, margem entra na conta. Hoje isso
evapora.

**Dinheiro vivo** não tem rastro no Mercado Pago. É o único furo real, e o controle
dele é outro: acerto por operador (declarado × conferido) e divergência de estoque.

### 6.1 O que muda o comportamento é velocidade, não regra

Se mandar o valor para a maquininha pelo sistema for mais rápido que digitar na
maquininha, o operador usa o caminho integrado porque é mais fácil. Hoje digitar é
mais rápido porque o sistema não existe. Esse é o trabalho de design da tela de
cobrança: um toque, valor preenchido, maquininha já vinculada.

**E o anel 1 é o único com dado em tempo real** — o anel 2 é relatório assíncrono.
Para o sócio que decide remotamente, a diferença entre os anéis é "sabe agora" ×
"sabe amanhã". Esse é o argumento que o operador entende.

### 6.2 A segunda rede é o estoque

Pizza que saiu sem venda faz o contador físico divergir do sistema. Dinheiro
conciliado + estoque conferido pega quase tudo — inclusive o dinheiro vivo, que o
Mercado Pago não vê.

Isso converte a ideia **"Contagem cíclica de inventário e registro de perdas"** de
higiene para metade do sistema de controle.

---

## 7. Evidências do spike (2026-09-05)

Relatório **Todas as transações / settlement** da conta real, 45 linhas, gerado à mão
no painel do vendedor. Analisado sem expor dados individuais.

| Cenário | Aparece? | Identificadores presentes |
| --- | --- | --- |
| Venda avulsa na maquininha (12 linhas) | ✅ | `POI_ID`, `POS_ID`, `APPLICATION_ID` — **12/12** |
| Pix direto na chave (25 linhas) | ✅ | nenhum — só valor e horário |
| Link gerado no painel (6 linhas) | ✅ | `APPLICATION_ID`; sem referência externa |
| QR (1 linha) | ✅ | `POI_ID`, `POS_ID` |

**Achados que sustentam o desenho:**

1. **`APPLICATION_ID` é o discriminador entre os anéis.** Toda venda avulsa da
   maquininha carrega `8462159799283646` — o app do Point do próprio Mercado Pago.
   Cobrança criada por nós virá com o id da nossa aplicação. Separar "passou pelo
   sistema" de "não passou" é comparação de string, não heurística.
2. **`SUB_UNIT` entrega o canal pronto:** `Point`, `QR`, `Link`, `Wallet`.
3. **`FEE_AMOUNT` vem por transação**, com `PAYMENT_METHOD`, `FRANCHISE`,
   `INSTALLMENTS` e `CARD_ENTRY_MODE`. A dedução da taxa da credora — pedida pelo PM —
   **vem pronta do Mercado Pago**, sem modelar tabela de taxa por bandeira e
   parcelamento. Isso poupa uma parte errável do painel econômico do NAPO-008.
4. **`TRANSACTION_DATE` × `MONEY_RELEASE_DATE`** dá fluxo de caixa real: quando
   vendeu × quando o dinheiro cai.

**Limites conhecidos:**

- **Webhook não cobre venda avulsa.** O tópico `payment` vale para Checkout, Bricks,
  Assinaturas e Wallet; Point usa `point_integration_wh`, ligado a intenções criadas
  por API. Venda digitada na maquininha e Pix direto **não notificam** — só relatório.
  Logo, **o anel 2 tem latência**; o anel 1 não.
- **Pix direto na chave é o casamento mais fraco:** só valor e horário.
- **Só um `POI_ID` apareceu no período.** Ou só uma das duas maquininhas rodou, ou a
  segunda não registra. Conferir antes de confiar em atribuição por operador.
- A geração do relatório é assíncrona e sem latência garantida em documentação.
  Verificar na spec de conciliação se há API de agendamento/geração.

---

## 8. Gestão da frota de maquininhas

**Requisito do PM (2026-09-05):** o parque de maquininhas muda — compra-se mais,
quebra, perde. O sistema precisa gerenciar isso, não ter dois identificadores
cravados em configuração.

**`maquininha` é cadastro**, com apelido, situação (ativa, manutenção, perdida,
baixada) e datas.

Três regras que decorrem do spike e do requisito:

1. **`device_id` e `POI_ID` são identificadores diferentes e ambos são necessários.**
   O `device_id` é o que a API do Point usa para **enviar** a intenção de pagamento; o
   `POI_ID` (número de série, formato `N950NCC…`) é o que **volta** no relatório de
   conciliação. Sem o par guardado, a conciliação não atribui uma linha do relatório a
   uma máquina conhecida.
2. **Maquininha nunca é excluída.** Quebrou, sumiu ou foi devolvida → muda de
   situação. Venda de três meses atrás aponta para ela; histórico de dinheiro não pode
   ficar órfão.
3. **O vínculo aparelho↔operador é datado, não um campo "atual".** Ao conciliar uma
   venda de três semanas atrás, importa quem estava com aquele aparelho *naquele dia*.
   Efeito colateral útil: controle patrimonial — aparelho sumiu, o vínculo diz com
   quem estava.

---

## 9. Decomposição em itens de ROADMAP

O achado que reorganiza a fila: **o NAPO-008 precisa ser quebrado.** A maquininha não
serve de nada sem um lugar onde a venda é registrada, e esse lugar está enterrado
dentro do item mais caro do backlog, junto de BOM, estoque, custos e painel.

| Item | Escopo | Depende de |
| --- | --- | --- |
| **Espinha de cobrança** | `cobranca` como entidade, instrumentos plugáveis, Bricks, Pix QR, link, dinheiro. **Absorve o NAPO-023.** Exige ADR. | — |
| **Registrar venda no admin** | a fatia mínima do NAPO-008: quem vende, o que sai, para quem | espinha |
| **Cobrança na maquininha** | adaptador Point, **cadastro de frota** (§8), vínculo datado aparelho↔operador, webhook `point_integration_wh` | registrar venda |
| **Conciliação por relatório** | ingestão do settlement, casamento por `APPLICATION_ID`/`POI_ID`/valor/janela, caixa de entrada de dinheiro sem venda | espinha |
| **Carga de rua** | consignação: carga sai, venda debita da carga, retorno reentra no estoque | registrar venda |
| **NAPO-008 (o resto)** | BOM, estoque, custos, painel econômico — recebe a taxa por venda da conciliação | conciliação |

**Por que carga de rua é item separado:** ela é um problema de *estoque* ("essa pizza
saiu de onde?"), não de pagamento ("esse dinheiro entrou?"). A tela do vendedor é uma
só e usa as duas capacidades; a separação é sobre quem é dono de qual regra. Misturar
é o que faz specs incharem.

**Ordem recomendada:** espinha → NAPO-007 (já especificado e independente) →
registrar venda → maquininha → conciliação → carga.

A espinha vem primeiro porque tudo depende dela e porque já está na fila: o NAPO-023
era o próximo item, e é ela agora.

---

## 10. Não-objetivos

- **Trava para pagamento na entrega** — decisão consciente (§4.1); registrar a
  evidência, não construir a política.
- **Modelar tabela de taxa por bandeira e parcelamento** — vem pronta do relatório
  (§7).
- **Envio automatizado de link por WhatsApp** — o operador compartilha do próprio
  aparelho (`wa.me` ou compartilhamento nativo). Envio automatizado e em massa é o
  NAPO-015/016 e depende do NAPO-017 (Meta), que segue bloqueado. **A espinha não
  depende disso.**
- **Conciliação em tempo real de venda avulsa** — impossível pelo caminho documentado
  (§7); é relatório, com latência.
- **PDV completo, KDS e fiscal** — seguem sendo NAPO-012, 013 e 011.

---

## 11. Pendências antes da primeira spec

1. **ADR da troca Checkout Pro → Checkout Bricks** (`docs/adr/`), pré-requisito da
   spec da espinha.
2. **Atualizar `ARCHITECTURE.md` §2.1** após o ADR ser aceito.
3. **Reescopar o ROADMAP**: NAPO-023 absorvido, cinco itens novos, NAPO-008 quebrado.
4. **Conferir a segunda maquininha** — se registra `POI_ID` (§7).
5. **Credenciais de teste no `.env.local`** (`MP_ACCESS_TOKEN`,
   `NEXT_PUBLIC_MP_PUBLIC_KEY`); `MP_WEBHOOK_SECRET` depende do túnel.
6. **Webhook do painel** precisa assinar também o tópico do Point
   (`point_integration_wh` ou `orders`), não só `payment`.
