# 📋 Spec: Endereços e frete por faixa de distância

**ID:** NAPO-005
**Status:** Aprovado
**Responsável:** Hudson
**Data:** 2026-08-17
**Item no Roadmap:** NAPO-005

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.

---

## 1. Visão Geral (User Stories)

> **Como** cliente, **eu quero** cadastrar meu endereço a partir do CEP e conferir no mapa onde a entrega vai chegar, **para que** a pizza não pare no portão errado de uma quadra com seis blocos iguais.

> **Como** cliente, **eu quero** ver o frete antes de decidir a compra, **para que** o valor não apareça como surpresa no fim do checkout.

> **Como** cliente de fora da área, **eu quero** deixar meu endereço registrado mesmo sem poder comprar, **para que** a casa saiba que existe demanda no meu bairro.

> **Como** gerente, **eu quero** que raio, faixas e exceções vivam em configuração, **para que** abrir uma região nova ou reajustar o frete não dependa de deploy.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] 100% dos endereços atendidos com coordenada e `distancia_km` gravadas — sem isso o frete do NAPO-006 não tem base
- [ ] Nenhuma faixa de frete abaixo do custo de referência de **R$ 9,60 por entrega** (rota de 10 entregas / 30 pizzas / ~60 km ≈ R$ 96)
- [ ] Endereços fora do raio registrados e contáveis por região — é a métrica que decide onde a área cresce
- [ ] Zero endereços com distância estimada em rota de entrega sem conferência humana prévia

---

## 3. Regras de Negócio Obrigatórias

- **RN1 — Endereço é do cliente e só dele.** Cada endereço pertence a um `profile`; ninguém lê nem escreve endereço alheio. Equipe (atendente, gerente, admin) lê para dar suporte e para separar a entrega — nunca escreve no lugar do cliente. Endereço com coordenada é o dado mais sensível do projeto: é onde a pessoa mora.

- **RN2 — O CEP preenche, mas nunca trava o cadastro.** A busca tenta ViaCEP, cai para BrasilAPI e, se nenhuma responder ou o CEP vier sem logradouro, o cliente digita à mão e o cadastro segue. CEP recém-criado leva meses para ser indexado, e muito CEP do entorno do DF é geral da cidade — travar aqui é recusar cliente por falha de terceiro.

- **RN3 — O endereço de Brasília não é "rua e número".** `SQN 210 Bloco C Apto 302` e `SHIS QI 15 Conjunto 4 Casa 12` são a norma, não a exceção. O logradouro devolvido pelo CEP é **sempre editável**, o número aceita `s/n` e o complemento é campo próprio, obrigatório quando o endereço é de quadra ou condomínio — sem bloco e apartamento, a entrega não chega.

- **RN4 — A coordenada é buscada depois do número, não a partir do CEP.** O CEP devolve o meio da rua; o número devolve a porta. A diferença entre os dois é uma quadra inteira de caminhada para o entregador.

- **RN5 — Distância é rodoviária e calculada no servidor.** Linha reta mente em Brasília: 6 km de distância aérea podem virar 14 km contornando o lago. O cálculo (e a chave da API) vivem no servidor — distância que chega pronta do navegador é distância que o cliente escolhe.

- **RN6 — O cliente ajusta o pin, dentro de um limite.** O pin corrige geocodificação ruim, não escolhe faixa de frete: deslocamento acima de **300 m** em relação ao ponto geocodificado é aceito, mas marca o endereço para conferência e a distância é sempre recalculada a partir da coordenada final.

- **RN7 — O frete é a faixa da distância, não uma fórmula.** 0–4 km R$ 6 · 4–8 km R$ 10 · 8–12 km R$ 14. As faixas vivem em tabela, com o raio e o valor de frete grátis, e são alteráveis sem deploy.

- **RN8 — Pedido a partir de R$ 150 tem frete grátis.** O piso é o subtotal dos produtos, antes do frete.

- **RN9 — Fora do raio o endereço é salvo, não recusado.** O cadastro conclui, o endereço nasce `atendido = false` com aviso claro de que ainda não há entrega naquela região, e ele não pode ser escolhido para compra. Recusar apaga a informação de onde está a demanda reprimida.

- **RN10 — Exceção por prefixo de CEP vence o raio.** Um bloqueio recusa região dentro do raio (acesso impossível, condomínio fechado a entregas); uma liberação atende endereço fora dele. A exceção é sempre explícita e tem motivo registrado.

- **RN11 — Quando a rota não pode ser calculada, o sistema estima e avisa.** Falha da API cai para distância em linha reta multiplicada por um fator de correção, e o endereço fica marcado como **estimado** até conferência — nunca em silêncio. Distância errada para baixo cobra frete abaixo do custo; para cima, perde a venda.

- **RN12 — Distância é calculada uma vez e gravada.** Recalcula apenas quando a coordenada muda. Cada consulta é dinheiro e latência, e a distância de um endereço não muda sozinha.

- **RN13 — Um endereço padrão por cliente.** O primeiro cadastrado nasce padrão; marcar outro como padrão desmarca o anterior.

- **RN14 — Máximo de 10 endereços ativos por cliente.** Acima disso a conta vira lista morta e a escolha no checkout deixa de ser escolha.

- **RN15 — Endereço não é apagado, é desativado.** Some da conta e do checkout, mas continua existindo para o histórico e para a auditoria de entrega.

- **RN16 — Frete é decisão pura, calculada em um único lugar.** A regra que transforma distância e subtotal em valor de frete mora em `packages/core`, sem banco e sem rede — é a mesma função que o checkout, o admin e qualquer simulador futuro vão chamar. Duas implementações da mesma regra é como um canal passa a cobrar diferente do outro.

- **RN17 — A tela não repete o que a configuração já sabe.** Dia de entrega e raio de atuação aparecem nas telas desta spec **derivados do banco** (`dias_semana_entrega` do NAPO-004 e `raio_km` desta spec), nunca escritos no código. Ligar o sábado ou esticar o raio para 15 km é `UPDATE`, não deploy — e uma frase cravada que contradiz a configuração é pior que frase nenhuma: ela promete entrega em dia que a operação não faz. A formatação da lista de dias ("às sextas", "às quartas e sextas") é função pura em `packages/core`.

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário | Ação do Usuário | Resposta do Sistema |
|---|---|---|
| CEP inválido (formato) | Digita 7 dígitos ou letras | Validação inline antes de qualquer chamada externa |
| CEP não encontrado nas duas APIs | Digita CEP novo/inexistente | Campos liberados para digitação manual, com aviso — cadastro segue (RN2) |
| ViaCEP fora do ar | Busca CEP | Cai para BrasilAPI de forma transparente; se ambas falham, digitação manual |
| CEP sem logradouro (geral de cidade) | Busca CEP do entorno | Cidade e UF preenchidas, logradouro em branco para digitar (RN2) |
| Geocodificação não encontra o endereço | Salva endereço | Mapa abre no centro da cidade com pin arrastável e aviso de que a posição precisa ser conferida |
| API de rota indisponível | Salva endereço | Distância estimada por linha reta com fator, endereço marcado para conferência (RN11) |
| Endereço fora do raio | Conclui cadastro | Salvo com aviso "ainda não entregamos nessa região"; não selecionável para compra (RN9) |
| CEP em exceção de bloqueio | Conclui cadastro | Mesmo tratamento do fora de área, com o motivo cadastrado (RN10) |
| Décimo primeiro endereço | Tenta adicionar | Bloqueio com orientação de desativar um existente (RN14) |
| Endereço de outro cliente | Manipula id na URL/API | Não encontrado — a linha é invisível, não "proibida" (RN1) |
| Pin arrastado para longe | Move o pin 2 km | Aceito, distância recalculada, endereço marcado para conferência (RN6) |

---

## 5. Não-Objetivos (Fora do Escopo)

- **Não faz checkout nem congela o pedido** — o snapshot de endereço e o frete gravado no pedido são NAPO-006. Aqui o frete é calculado e exibido, não cobrado.
- **Não entrega tela de admin** para editar faixas, raio ou exceções — a configuração nasce em tabela e é editada por migration/SQL até o NAPO-008.
- **Não derruba a copy cravada do resto do site** (home, seletor de fornada, `/eventos`, faixas de frete na página de entrega). A RN17 vale para as telas desta spec; converter as superfícies do NAPO-003 continua sendo a ideia já registrada no ROADMAP, que depende também do NAPO-008.
- **Não faz o simulador de viabilidade de frete** (custo da rota, pedido mínimo por distância, alerta de faixa abaixo do custo) — está previsto no NAPO-008 e na ideia registrada no ROADMAP.
- **Não roteiriza a entrega** — ordenar as ~10 paradas do dia é feito à mão e só vira software acima de ~25 entregas/dia (ideia no ROADMAP).
- **Não usa zonas por tempo de viagem**, padrão do delivery de comida quente. A Napo entrega congelado em rota consolidada semanal: 20 minutos a mais não degradam o produto — o que pesa é o custo por parada. Descartado no benchmarking de 2026-08-17.
- **Não integra Correios, transportadora ou frete interestadual** — o canal é entrega própria dentro do DF.
- **Não trata comissão nem repasse ao entregador** — custo real de entrega é NAPO-008.

---

## 6. Dependências de Negócio

- **NAPO-001** (fundação, RLS deny-by-default) — concluída
- **NAPO-002** (auth e gate de telefone; cadastrar endereço exige conta com telefone validado) — concluída
- **Conta Google Cloud com billing ativo** e chave de API restrita — dependência externa do PM. O volume da Napo (~300 endereços novos/mês, distância calculada uma vez) cabe no free tier atual (10.000 geocodificações/mês; 5.000 rotas), mas a chave não é emitida sem cartão cadastrado.

---

## 7. Observações e Decisões de Negócio

- **Faixas fixas venceram a fórmula por quilômetro.** A fórmula `km × 2 ÷ qtd` da fase 5 do roadmap modelava viagem dedicada quando a operação é rota consolidada: cobrava R$ 38,40 numa pizza a 12 km. Além disso, o desconto por quantidade invertia o incentivo — comissão por pizza é o maior componente do custo, não distância.
- **Custo de referência:** rota de 10 entregas / 30 pizzas / ~60 km ≈ R$ 96, ou **R$ 9,60 por entrega**. As três faixas cobrem esse custo; a de 0–4 km cobre com folga e sustenta a de 8–12 km.
- **Fator de correção da distância estimada:** a razão entre distância rodoviária e linha reta em Brasília gira em torno de 1,3–1,4 pela geografia do lago e das vias de acesso. O valor exato é configuração, não constante de código.
- **Endereço fora de área é lead, não erro.** É a única fonte de dado sobre demanda em região não atendida, e a decisão de esticar o raio precisa desse número.
- **Custo do Google verificado em 2026-08-17:** o modelo de março de 2025 substituiu o crédito único de US$ 200 por franquias por SKU — Geocoding 10.000 eventos/mês, Routes 5.000. No volume da Napo o custo é zero, mas um pico anômalo em um único mês cai na faixa paga do mês inteiro: a chamada precisa de cache e de teto.

---

## 8. Aprovação

- [x] **Spec revisado e aprovado por:** Hudson / 2026-08-17
- [x] **Design técnico criado** (`design.md`)
- [x] **Critérios de teste criados** (`tests.md`)
- [x] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
