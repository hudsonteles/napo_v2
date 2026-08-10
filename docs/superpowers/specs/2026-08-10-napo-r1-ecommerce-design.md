# Spec — Napo R1: E-commerce de Pizza Congelada

> **Status:** aprovado para implementação · **Data:** 2026-08-10
> **Escopo:** Release 1 — site de vendas, catálogo, checkout, frete, área do cliente
> e site administrativo. O módulo de eventos é o R2 e não está aqui.

---

## 1. Contexto e diagnóstico

A Napo é uma pizzaria napolitana de Brasília, fundada por quatro sócios, que vende
pizza **assada e congelada**. O cliente descongela e aquece no forno de casa. A massa
é de longa fermentação e a pizza passa por forno italiano a 400°C antes de congelar.

A operação hoje vende **70 pizzas/semana** por WhatsApp e balcão. O diagnóstico
econômico definiu o objetivo do release:

| Indicador | Valor |
|---|---|
| Capacidade de produção | 30 pizzas/dia × 5 dias = **650/mês** |
| Volume atual | **303/mês** (47% da capacidade) |
| Ponto de equilíbrio | **207/mês** |
| Margem de contribuição média | **R$ 20,82**/pizza |
| Custo fixo mensal | R$ 4.300 (sem pró-labore) |
| Resultado hoje | R$ 2.008/mês |
| Resultado a capacidade cheia | R$ 9.233/mês |

**O gargalo do negócio é o forno, não o mercado.** Sobram 347 pizzas/mês de
capacidade ociosa, que valem **R$ 7.700/mês de margem não capturada** sem nenhum
aumento de custo fixo.

**Objetivo do R1:** converter capacidade ociosa em receita, criando um canal de venda
próprio. O objetivo secundário é instrumentar o negócio para que a decisão de comprar
o segundo forno seja tomada com dado, e não por intuição.

---

## 2. Escopo

### Entra no R1

- Site de vendas público com SEO, storytelling e catálogo
- Carrinho e checkout com Mercado Pago (Pix, crédito, débito)
- Motor de disponibilidade (dias de entrega, cutoff derivado, dois tetos)
- Cálculo de frete por faixa de distância
- Cadastro de endereços com CEP → ViaCEP → geocoding → ajuste de pin
- Autenticação com validação obrigatória de telefone por WhatsApp
- Área do cliente (pedidos, endereços)
- Admin: pedidos, catálogo, insumos e ficha técnica, estoque, entregadores,
  configuração de operação, custos fixos, painel econômico
- LGPD: termos, política de privacidade, consentimento versionado, banner
- Log de auditoria

### Fica fora do R1 (por decisão, não por esquecimento)

| Item | Motivo |
|---|---|
| Módulo de eventos | É o R2 |
| Emissão fiscal (NFC-e/NF-e) | Depende do contador e de certificado A1; a costura fica pronta |
| Capacidade por etapa-gargalo | Números não medidos; teto simples resolve a 30/dia |
| Roteirização automática | ~10 entregas/dia se organizam à mão |
| Impressão de etiqueta de lote | Rótulo em R2; o dado de lote já é capturado |
| Contagem cíclica de inventário | Ajuste manual com motivo cobre o R1 |
| Estorno automatizado | Cancelamento devolve estoque; estorno é manual no painel MP |
| DRE e fluxo de caixa | Margem de contribuição e ponto de equilíbrio bastam para decidir |
| KDS, PDV, bot WhatsApp, iFood | Fases posteriores do roadmap |

---

## 3. Arquitetura

### Stack

| Camada | Decisão |
|---|---|
| Monorepo | pnpm workspaces (sem Turborepo até o build doer) |
| App | Next.js 15 App Router, único, dividido por grupos de rota |
| Linguagem | TypeScript strict |
| UI | Tailwind + shadcn/ui, tema preto / branco / amarelo |
| Animação | Motion, respeitando `prefers-reduced-motion` |
| Backend | Supabase — Postgres, Auth, Storage |
| Hospedagem | Vercel · domínio `napobsb.com.br` (DNS no Registro.br) |
| Pagamento | Mercado Pago Checkout Pro, conta PJ |
| E-mail | Resend, `pedido@napobsb.com.br` |
| Erros | Sentry |
| Testes | Vitest (unitário + RLS) · Playwright (checkout) |
| CI | GitHub Actions — typecheck, lint, testes, migrations |

### Estrutura

```
napo/
├── apps/web/
│   ├── app/(site)/          SSG/ISR — home, sabores, sobre, legal
│   ├── app/(loja)/          catálogo, carrinho, checkout
│   ├── app/(conta)/         área do cliente
│   ├── app/(admin)/         painel administrativo
│   └── app/api/             frete, disponibilidade, otp, webhook/mp
├── packages/core/           REGRAS PURAS: cutoff, CTP/ATP, frete, BOM, margem
├── packages/ui/             tokens, componentes, padrão de listagem
├── packages/db/             tipos gerados do Supabase, factories de client
└── supabase/migrations/
```

**`packages/core` não importa React, Supabase, nem faz HTTP.** É a decisão
arquitetural central: as regras que, quando erram, vendem pizza que não existe ou
cobram frete errado ficam isoladas e testáveis com testes rápidos e determinísticos.

### Ambientes

`local` (Supabase CLI) → `staging` (projeto Supabase + preview Vercel) → `prod`.
Toda alteração de banco via migration versionada.

### Fuso horário

Tudo persistido em `timestamptz` UTC. **Toda** decisão de data de negócio passa por
um único helper em `packages/core` fixado em `America/Sao_Paulo`. Nenhum cálculo de
cutoff ou dia de entrega fora desse helper.

---

## 4. Modelo de dados

### Identidade e acesso

```
profiles           id (=auth.users) · nome · email · telefone_e164 (unique quando
                   validado) · telefone_validado_em · role · criado_em
                   role: cliente | atendente | cozinha | gerente | admin

telefone_verificacoes  id · profile_id · telefone_e164 · codigo_hash · tentativas
                       · expira_em · validado_em · ip · criado_em
```

### Endereços

```
ceps          cep (PK) · logradouro · bairro · cidade · uf · lat · lng · fonte
              · atualizado_em                          ← cache compartilhado

enderecos     id · profile_id · apelido · cep · logradouro · numero · complemento
              · referencia · bairro · cidade · uf · lat · lng
              · distancia_km · distancia_calculada_em
              · atendido (bool) · padrao (bool) · ativo · criado_em
```

`distancia_km` é calculada **uma vez ao salvar** e recalculada só se o pin mudar.
Nunca a cada visita ao carrinho.

### Catálogo

```
categorias      id · nome · slug · ordem          Salgadas · Doces · Massas
faixas_preco    id · nome · preco · ordem · ativo  39,90 / 45,90 / 49,90 / 15,00

produtos        id · nome · slug · descricao · categoria_id · faixa_preco_id
                · preco_override · alergenos[] · validade_dias
                · ncm · unidade · origem            ← exigidos pela nota futura
                · foto_url · destaque · ativo
                · vagas_forno (default 1)
```

Catálogo inicial: 10 pizzas + 2 massas, conforme seção 10.

### Insumos e ficha técnica (BOM de dois níveis)

```
insumos            id · nome · unidade · preco_atual · estoque_atual
                   · estoque_minimo · lead_time_dias · ativo
insumo_precos      id · insumo_id · preco · data · origem      ← histórico

ficha_tecnica_itens  id · produto_id · quantidade
                     · insumo_id            (nullable)
                     · componente_produto_id (nullable)
                     CHECK: exatamente um dos dois preenchido
```

`componente_produto_id` é o que dá os dois níveis: a massa é produto vendável **e**
componente das 10 pizzas. O custo de um produto é a soma recursiva da ficha.

### Capacidade, calendário e frete

```
config_operacao (singleton)
  tempo_preparo_horas          48
  teto_forno_dia               30
  capacidade_freezer           150
  sub_teto_massa_dia           6
  limite_ocupacao_massa_pct    80
  raio_km                      12
  frete_gratis_valor           150,00

dias_semana_entrega    dia_semana (0-6) · entrega · janela_inicio · janela_fim
dias_semana_producao   dia_semana (0-6) · produz
excecoes_calendario    data (PK) · tipo · motivo
                       tipo: sem_producao | sem_entrega | entrega_extra
faixas_frete           id · km_de · km_ate · valor
excecoes_area          id · tipo (bloqueio|liberacao) · cep_prefixo · motivo
```

### Estoque

```
lotes                id · produto_id · quantidade · produzido_em · validade
                     · dia_entrega_alocado (nullable) · ativo
movimentos_estoque   id · produto_id · lote_id · tipo · quantidade · motivo
                     · pedido_id · profile_id · criado_em
                     tipo: producao | venda | ajuste | perda | cancelamento
producao_planejada   id · data · produto_id · quantidade · status
```

Todo movimento é registrado. Estoque nunca é editado direto — só por movimento com
motivo. É o que mantém o saldo projetado colado na realidade.

**Consumo por FEFO**: a alocação de um pedido sempre toma o lote de validade mais
próxima primeiro. Lote vencido sai do estoque alocável e exige movimento de `perda`.

### Pedidos

```
pedidos       id · numero · profile_id · status · canal · atividade_fiscal
              · dia_entrega · endereco_snapshot (jsonb)
              · subtotal · frete · total
              · forma_pagamento · mp_payment_id · pago_em
              · entregador_id · custo_entrega_real · criado_em
              status: aguardando_pagamento | pago | em_producao | pronto
                      | em_rota | entregue | cancelado
              canal: site | balcao | whatsapp        (ifood, 99food em fases futuras)
              atividade_fiscal: congelado_industrializado | fresca_balcao

pedido_itens  id · pedido_id · produto_id · nome_snapshot · quantidade
              · preco_unitario_snapshot · custo_unitario_snapshot
```

**Snapshots são obrigatórios.** O pedido congela endereço, nome, preço e custo do dia
da venda. Sem isso, editar um endereço reescreve o histórico de entrega e um reajuste
de insumo reescreve a margem de meses passados.

### Entregadores e financeiro

```
entregadores   id · nome · telefone · veiculo · custo_km · ajuda_combustivel
               · comissao_por_pizza · ativo
custos_fixos   id · nome · valor_mensal · categoria · ativo
config_fiscal  aliquota_imposto · taxa_pix · taxa_credito · taxa_debito
```

### LGPD, auditoria e costura fiscal

```
termos_versoes    id · tipo · versao · conteudo · publicado_em
consentimentos    id · profile_id · tipo · versao · aceito_em · ip
                  tipo: termos | privacidade | marketing
auditoria         id · tabela · registro_id · acao · profile_id
                  · dados_antes (jsonb) · dados_depois (jsonb) · criado_em
documentos_fiscais id · pedido_id · tipo · numero · chave · status
                   · xml_url · emitido_em         ← tabela sem integração no R1
```

---

## 5. Motor de disponibilidade

Vive em `packages/core`, sem dependências. É a peça mais sensível do release.

### Cutoff é derivado, nunca digitado

```
cutoff(D) = (D + janela_inicio(D)) − tempo_preparo_horas
            e, se cair em dia sem produção,
            recua até o último dia de produção válido
```

Recuar em vez de avançar é deliberado: pode cortar a venda um pouco mais cedo, nunca
prometer o que não se consegue produzir.

### Janela e disponibilidade

Horizonte de **2 semanas deslizantes** (corrente + próxima). Quando o último dia de
entrega da semana corrente passa do cutoff, a janela desliza.

Para cada dia de entrega `D` dentro da janela:

```
se agora < cutoff(D):        CTP
   disponível = estoque_alocável + capacidade_restante(D)
senão:                       ATP
   disponível = apenas lotes já prontos alocados para D

estoque_alocável = lotes ativos, dentro da validade, ainda não alocados a
                   outro dia de entrega nem consumidos por pedido pago

capacidade_restante(D) = min(
    teto_forno_dia × dias_de_producao_entre(agora, D) − já_planejado,
    capacidade_freezer − pico_de_saldo_projetado_até(D)
)
```

**Dois tetos, não um.** O teto de forno limita o fluxo diário; a capacidade de freezer
limita o **acúmulo**. Sem o segundo, o sistema aceita produção que não tem onde ser
guardada. Com 30/dia × 5 dias = 150 e freezer de 150, o freezer é a restrição que
aperta primeiro quando há poucos dias de entrega.

### Regra da massa

Massa consome **uma vaga de forno**, igual a uma pizza, mas rende R$ 7,21 de margem
contra R$ 20,82. Por isso:

- limitada a `sub_teto_massa_dia` por dia de entrega
- **removida do catálogo daquele dia** quando a ocupação passa de
  `limite_ocupacao_massa_pct`, preservando a vaga para pizza

Enquanto há capacidade ociosa, massa é margem incremental. Quando o dia enche, ela
destrói R$ 13,61 por vaga. A regra existe para que isso nunca aconteça sem decisão.

### Sabor esgotado

Se um produto esgota para `D`, o sistema oferece **o próximo dia de entrega com vaga
real** — herdando a capacidade daquele dia, nunca prometendo um dia também lotado.
Com teto de 30, esse caminho é rotina, não exceção.

### Escassez na vitrine

O catálogo exibe a quantidade real restante para o próximo dia de entrega quando
abaixo de um limite. É verdade verificável, não artifício.

---

## 6. Frete

```
frete(endereco, subtotal):
  se subtotal >= frete_gratis_valor        → 0
  se distancia_km > raio_km e sem liberação → bloqueia com mensagem clara
  senão                                     → valor da faixa
```

| Faixa | Valor |
|---|---|
| 0–4 km | R$ 6 |
| 4–8 km | R$ 10 |
| 8–12 km | R$ 14 |
| Pedido ≥ R$ 150 | grátis |

Faixas fixas em vez da fórmula da Fase 5 do roadmap, por três razões: a fórmula
`km × 2` modela viagem dedicada e a operação é **rota consolidada**; ela cobrava
R$ 38 de frete numa pizza a 12 km, o que não é venda perdida por margem mas por
preço; e o desconto por quantidade invertia o incentivo, já que **comissão por pizza
é o maior componente do custo**, não distância.

Custo real de referência: rota de 10 entregas / 30 pizzas / ~60 km ≈ R$ 96, ou
**R$ 9,60 por entrega**. As faixas cobrem.

**Distância é rodoviária, não linha reta.** Em Brasília, endereços a 6 km em linha
reta podem exigir contornar o lago. Haversine só entra como fallback se a API falhar,
com multiplicador e marcação para revisão.

### Simulador de viabilidade (admin)

Ao configurar o raio, a tela mostra, calculando pelo **entregador ativo mais caro**
(pior caso): custo estimado da rota, custo médio por entrega, resultado por tamanho de
pedido na borda do raio, **pedido mínimo para não dar prejuízo naquela distância**, e
alerta quando uma faixa de frete fica abaixo do custo.

---

## 7. Fluxos

### Autenticação e gate de telefone

```
/entrar  →  Magic Link ou Google (ambos, para cliente e equipe)
         →  profile criado com role = cliente
         →  telefone_validado_em IS NULL ?
              SIM → preso em /validar-telefone
              NÃO → redireciona por role
```

Navegação pública (home, catálogo, preços, legal) é livre — exigência de SEO e
conversão. **Tudo que é logado exige telefone validado:** carrinho, checkout, conta.

Regras do OTP:

- 6 dígitos, **gravado com hash**, expira em 10 min
- máx. 5 tentativas por código · reenvio com espera de 60s · limite diário
- rate limit por número **e** por IP
- normalização E.164 e validação de celular BR (DDD válido, nono dígito)
- **telefone único entre contas validadas**
- **override de admin** para marcar como validado manualmente (suporte)
- camada de envio com interface trocável: remetente falso em dev/staging, WhatsApp
  Business API oficial em produção

### Cadastro de endereço

```
1. CEP → cache `ceps` → ViaCEP (fallback BrasilAPI) → grava no cache
2. Cliente informa número e complemento
3. Geocoding Google com logradouro + número      ← precisão de porta, não de rua
4. Tela do mapa: cliente ajusta o pin se necessário
5. Salva coordenadas finais, calcula e grava distancia_km
6. Fora do raio → salva com atendido = false
```

Geocodificar **depois do número** é melhor que a partir do CEP: o CEP devolve o meio
da rua. Endereço fora de área é salvo, não recusado — o lead tem valor e revela
demanda reprimida.

### Checkout

```
carrinho → escolhe endereço (salvo ou novo)
        → sistema resolve dia de entrega e disponibilidade
        → calcula frete
        → Mercado Pago Checkout Pro (Pix destacado e pré-selecionado)
        → webhook confirma → pedido = pago, estoque baixado, e-mail enviado
```

**Pagamento online é obrigatório no canal site.** Um no-show não custa só a viagem:
custa uma vaga de 30. O pagamento na entrega segue liberado no canal do bot (Fase 6),
conforme decidido no roadmap.

Pix é destacado e pré-selecionado, **sem desconto**: 5% de desconto custa R$ 2,30 e
economiza R$ 1,61 de taxa — só empata perto de 3%. Reavaliar com dado se o Pix não
passar de 40% do mix em dois meses. O valor real do Pix é não ter chargeback e liquidar
na hora.

---

## 8. Segurança

- **RLS negando por padrão em toda tabela.** Nenhuma tabela sem política.
- **Trigger bloqueando alteração de `role`** que não venha de admin. Sem isso, um
  cliente com o próprio token se promove a gerente.
- `service_role` **nunca** no browser — apenas em Route Handlers.
- Chave do Google Maps restrita por referrer; chave de geocoding só no servidor.
- Middleware protege rota; **RLS protege dado.** Middleware sozinho não é segurança.
- Auditoria em preço, estoque, capacidade, role e configuração de operação.

---

## 9. Testes

| Alvo | Ferramenta | O que cobre |
|---|---|---|
| `packages/core` | Vitest | derivação de cutoff incluindo recuo por dia sem produção · CTP vs ATP · dois tetos · sub-teto de massa · faixas de frete · rollup de custo do BOM de dois níveis · margem de contribuição · ponto de equilíbrio |
| RLS | Vitest + Supabase local | cliente A não lê pedido de B · cliente não acessa admin · cliente não altera própria role |
| Checkout | Playwright | caminho felizardo: login → validação → endereço → carrinho → pagamento |

UI decorativa não é testada. Regra de negócio e autorização, sempre.

---

## 10. Catálogo inicial

| Faixa | Preço | Produtos |
|---|---|---|
| Tradicional | R$ 39,90 | Calabresa · Lombo Canadense · Margherita · Banana |
| Especial | R$ 45,90 | Pepperoni · Frango c/ Catupiry · Peito de Peru c/ Gorgonzola · 4 Queijos · Chocolate Nestlé |
| Premium | R$ 49,90 | Nutella com Avelã |
| Massa | R$ 15,00 | Massa doce · Massa salgada |

**Nutella com Avelã carrega avelã**, alérgeno de declaração obrigatória — destaque no
site e no rótulo. Glúten e leite alcançam quase todo o catálogo.

A conferir quando a ficha técnica existir: **Peito de Peru com Gorgonzola** a R$ 45,90
provavelmente tem o insumo mais caro do catálogo. **Banana** a R$ 39,90 provavelmente
tem a melhor margem e merece destaque na vitrine.

---

## 11. Posicionamento e conteúdo

O concorrente da Napo não é a pizzaria da esquina — é a **pizza congelada de
supermercado**. E a diferença é física, não retórica:

```
Supermercado   massa crua  →  forno doméstico a 200°C  →  nunca fica boa
Napo           assada a 400°C em forno italiano  →  cliente só aquece
```

O cliente não reproduz 400°C em casa. A promessa não é "nossa pizza é melhor", é
**"fizemos a parte que a sua casa não consegue fazer"**. Defensável e não copiável.

Segundo eixo: longa fermentação, que entrega sabor **e não pesar depois**. Manter a
formulação sensorial — "leve", "não pesa". Alegação de saúde ou digestão é território
regulado pela ANVISA.

Eixo do site:

> **Longa fermentação. Forno italiano a 400°C. Em casa, só aquecer.**
> *A parte difícil já foi feita.*

Os quatro sócios são a seção "quem somos" — prova de que não é fábrica — não a
manchete.

Fotos entram depois; o site é construído com placeholders nas proporções finais.
Direção de fotografia (luz de trás, quatro ângulos, espaço negativo para texto,
consistência entre os doze produtos) está registrada na conversa de brainstorming e
será anexada quando o ensaio for agendado.

---

## 12. Painel econômico (admin)

Uma tela, quatro números que hoje não existem em lugar nenhum:

- margem de contribuição por produto, calculada da ficha técnica
- ponto de equilíbrio em pizzas/mês
- **ocupação da capacidade** contra o ponto de equilíbrio, lado a lado
- fechamento de comissão por entregador e período

Ponto de equilíbrio e teto de capacidade se olhando é o que transforma o sistema de
registro em instrumento de decisão — e é o que vai dizer quando o segundo forno se
paga.

---

## 13. Premissas abertas

Nenhuma bloqueia a implementação. Valores iniciais assumidos, todos editáveis:

| Premissa | Valor assumido | Como se resolve |
|---|---|---|
| Dias de entrega e janelas | sexta e sábado | configuração no admin |
| Dias de produção | segunda a sexta | configuração no admin |
| Custo de insumos | 40% do preço | ficha técnica real no cadastro |
| Embalagem | R$ 3,50 pizza · R$ 2,00 massa | cadastro de insumo |
| `custo_km` por veículo | R$ 0,60 | cadastro do entregador |
| Comissão por pizza | R$ 2,00 | cadastro do entregador |
| Alíquota do Simples | 4,5% | contador |
| Taxas Mercado Pago | 2,5% médio ponderado | extrato real do MP |
| Alérgenos por produto | glúten e leite no geral | cadastro de produto |
| Fotos e textos | placeholders | ensaio a agendar |

Duas premissas de negócio a levar ao contador: o **anexo do Simples** para pizza
congelada industrializada, e a **atividade mista** (congelado industrializado vs.
fresca no balcão), que exige segregação de receita na declaração mensal. O campo
`atividade_fiscal` no pedido existe para isso.

---

## 14. Providências externas (caminho crítico não técnico)

Correm em paralelo ao desenvolvimento e nenhuma depende de código:

| Providência | Bloqueia |
|---|---|
| **Verificação da empresa na Meta** + template de OTP aprovado | o login em produção |
| **Conversa com o contador** — anexo, atividade mista, documento exigido no DF | o emissor fiscal |
| **Certificado digital A1** | qualquer emissão fiscal |
| **Ensaio de fotografia** | o lançamento do site |

A verificação na Meta tem o maior lead time e bloqueia o lançamento, não o
desenvolvimento — a interface de envio trocável permite construir e testar o fluxo
inteiro antes da aprovação.

---

## 15. Riscos aceitos

1. **O R1 é grande.** Colocar e-commerce antes de eventos pôs o motor de
   disponibilidade no caminho crítico. Decisão consciente, e o diagnóstico de
   capacidade ociosa a justifica: o gargalo é canal de venda.
2. **O teto de 30 é estimativa.** Nas primeiras semanas pode vender demais ou de
   menos. Mitigado por número editável e painel comparando vendido × produzido.
3. **Venda online sem nota fiscal.** Cada pedido gera rastro eletrônico via Mercado
   Pago. Não é dívida técnica — é uma janela com prazo curto. A costura fiscal e a
   captura de CPF/NCM existem para fechar isso rápido.
4. **WhatsApp é ponto único de validação**, sem fallback SMS, conforme decidido no
   roadmap. Se o envio falhar, o cadastro trava. Mitigado pelo override de admin.
5. **Checkout exige cadastro completo**, sem compra como convidado. Custa conversão no
   primeiro pedido; entrega uma base com telefone verificado, que é o que sustenta o
   marketing e o bot depois.

---

## 16. Revisões que esta spec faz no roadmap

| Roadmap dizia | Esta spec decide |
|---|---|
| Fase 1 = site institucional/vendas, sem checkout definido | site com e-commerce completo |
| "Como seguir": Fase 0 → Fase 5 → Fase 2 → Fases 1 e 3 | R1 = site + checkout + admin · R2 = eventos |
| `[FECHADO]` capacidade por etapa-gargalo, sem concessão MVP | teto simples por dia + teto de freezer; etapas ficam no schema |
| Fase 5: fórmula `MAX(4; km×2×1,60 ÷ qtd) × (1−desconto)` | faixas fixas de distância + frete grátis por valor |
| Stack "React + Supabase" | Next.js App Router em pnpm workspaces, com `packages/core` puro |
| Magic Link **ou** Google | ambos, para cliente e equipe, com role decidindo o destino |
| OTP como validação de telefone (Fase 3) | mesma decisão, mas como **gate obrigatório** de plataforma no R1 |
| Pagamento na entrega liberado para todos | mantido no bot; **site exige pagamento online** |
