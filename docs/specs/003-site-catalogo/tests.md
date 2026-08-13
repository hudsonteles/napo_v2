# ✅ Tests: Site público, catálogo e SEO

**ID:** NAPO-003
**Status:** Aprovado
**Data:** 2026-08-13
**Spec:** [`spec.md`](./spec.md) · **Design:** [`design.md`](./design.md) · **Plano:** [`plan.md`](./plan.md)

> 📌 Contrato de validação consumido pelo agente implementador.
> Toda RN de `spec.md` tem ≥1 cenário aqui. Gherkin puro; máx. 4 steps por cenário.

---

## Background

```gherkin
Background:
  Dado o catálogo com os 12 produtos do seed (10 pizzas + 2 massas)
  E a operação configurada com entrega às sextas e produção de segunda a sexta
  E o motor de disponibilidade (NAPO-004) respondendo com o horizonte de fornadas
```

---

## Categoria A — Cenários funcionais

### T1 — Vitrine lista o catálogo ativo da fornada escolhida

*Cobre: RN1, RN6, RN13*

```gherkin
Cenário: visitante abre a vitrine
  Quando acesso "/sabores"
  Então vejo os 12 produtos ativos com nome, preço e quantidade disponível
  E a fornada ativa é a primeira que o motor oferece
```

### T2 — Página de produto abre pelo slug

*Cobre: RN2, RN8*

```gherkin
Cenário: visitante abre um sabor
  Quando acesso "/sabores/nutella-com-avela"
  Então vejo denominação de venda, "Contém", "Pode conter", peso, validade, conservação e preparo
  E nenhum desses campos está vazio
```

### T3 — Cliente troca a fornada

*Cobre: RN13*

```gherkin
Cenário: escolher outra data de entrega
  Dado que estou em "/sabores" com a fornada de 21.08 ativa
  Quando escolho a fornada de 28.08
  Então a quantidade disponível de cada produto passa a ser a de 28.08
  E a URL passa a conter "?entrega=2026-08-28"
```

### T4 — Esgotado oferece a próxima fornada com estoque

*Cobre: RN14*

```gherkin
Cenário: sabor sem estoque na fornada ativa
  Dado que "Pepperoni" tem 0 unidades em 21.08 e 20 unidades em 28.08
  Quando vejo o card de "Pepperoni" com a fornada de 21.08 ativa
  Então o card exibe "esgotado" sem oferecer compra para 21.08
  E oferece comprar na fornada de 28.08, com data e quantidade explícitas
```

### T5 — Home mostra as três mais pedidas em ordem

*Cobre: RN6*

```gherkin
Cenário: seção "As mais pedidas"
  Dado que três produtos têm ranking_mais_pedidas 1, 2 e 3
  Quando acesso "/"
  Então vejo exatamente esses três, na ordem do ranking
  E o primeiro exibe o selo "1º mais pedida"
```

### T6 — Porta de entrada de eventos

*Cobre: RN16*

```gherkin
Cenário: visitante procura pizza para festa
  Quando acesso "/eventos"
  Então vejo as faixas de preço por pessoa e o CTA de WhatsApp
  E "forno de pedra no local" aparece como serviço incluído, não como opcional
```

### T7 — Sitemap e robots são gerados no build

*Cobre: RN1, RN9*

```gherkin
Cenário: buscador varre o site
  Quando acesso "/sitemap.xml"
  Então vejo a URL de cada produto ativo e nenhuma de produto inativo
  E "/robots.txt" aponta para o sitemap
```

---

## Categoria B — Cenários de validação

### T8 — Produto sem rotulagem não pode ser publicado

*Cobre: RN2*

```gherkin
Cenário: tentativa de ativar produto incompleto
  Quando tento gravar um produto com ativo = true e peso_liquido_g nulo
  Então o banco rejeita a operação pelo CHECK de rotulagem
```

### T9 — Produto inativo responde 404

*Cobre: RN1*

```gherkin
Cenário: URL de produto descontinuado
  Dado que "Pepperoni" está com ativo = false
  Quando acesso "/sabores/pepperoni"
  Então recebo 404 com a página da marca
  E a URL não aparece no sitemap nem gera JSON-LD
```

### T10 — Preço vem da faixa, override vence

*Cobre: RN5*

```gherkin
Cenário: precedência de preço
  Dado que "Margherita" está na faixa Tradicional de R$ 39,90 sem override
  E que "Banana" tem preco_override de R$ 42,00
  Quando leio o preço efetivo de cada um
  Então "Margherita" custa R$ 39,90 e "Banana" custa R$ 42,00
```

### T11 — Slug não muda quando o nome muda

*Cobre: RN8*

```gherkin
Cenário: renomear produto
  Dado que "Frango c/ Catupiry" tem slug "frango-com-catupiry"
  Quando o nome comercial muda para "Frango Especial"
  Então o slug permanece "frango-com-catupiry"
```

### T12 — Alérgeno crítico aparece na listagem

*Cobre: RN3, RN4*

```gherkin
Cenário: cliente com alergia percorre a vitrine
  Quando acesso "/sabores"
  Então o card de "Nutella com Avelã" exibe "Contém avelã" em texto
  E a página exibe o aviso de cozinha compartilhada
```

### T13 — Conteúdo não faz alegação de saúde

*Cobre: RN7*

```gherkin
Cenário: varredura de conteúdo regulado
  Quando percorro títulos, descrições, meta descriptions e JSON-LD
  Então nenhum texto alega benefício de saúde, digestão ou funcional
```

### T14 — Área de entrega é declarada

*Cobre: RN10*

```gherkin
Cenário: visitante de fora da área
  Quando acesso "/"
  Então vejo a cidade e o raio de entrega antes de qualquer botão de compra
```

### T15 — Carrinho pertence a uma única fornada

*Cobre: RN15*

```gherkin
Cenário: trocar de fornada com itens escolhidos
  Dado que tenho itens escolhidos para a fornada de 21.08
  Quando troco para a fornada de 28.08
  Então o sistema pede confirmação explícita antes de trocar
```

> `<!-- expandir: a implementação do carrinho é NAPO-006; aqui valida-se apenas o contrato da tela -->`

---

## Categoria C — Cenários de segurança

### T16 — Anônimo lê o catálogo e nada além dele

*Cobre: RN12*

```gherkin
Cenário: leitura pública do catálogo
  Dado um cliente Supabase com a chave anônima
  Quando consulto "produtos", "categorias" e "faixas_preco"
  Então recebo apenas as linhas ativas
  E consultas a "profiles", "lotes", "reservas" e "auditoria" retornam vazio
```

### T17 — Anônimo não escreve no catálogo

*Cobre: RN12*

```gherkin
Cenário: tentativa de escrita anônima
  Dado um cliente Supabase com a chave anônima
  Quando tento inserir, atualizar ou remover em "produtos"
  Então a operação é negada pela RLS
```

### T18 — Produto inativo é invisível para anônimo

*Cobre: RN1, RN12*

```gherkin
Cenário: vazamento de produto desativado
  Dado que "Pepperoni" está com ativo = false
  Quando consulto "produtos" com a chave anônima
  Então "Pepperoni" não vem no resultado
```

---

## Categoria D — Cenários não-funcionais

### T19 — Páginas do site são estáticas

*Cobre: KPI de custo (`ARCHITECTURE.md` §4.5)*

```gherkin
Cenário: build do site
  Quando rodo o build de produção
  Então as rotas de "(site)" são marcadas como estáticas com revalidate
  E as 12 páginas de produto são pré-renderadas por generateStaticParams
```

### T20 — Imagem não desloca o layout

*Cobre: RN11*

```gherkin
Cenário: medição de CLS
  Quando carrego "/sabores" e "/sabores/margherita" em 4G simulado
  Então o CLS fica abaixo de 0,1
  E o bloco de disponibilidade reserva a altura final antes do dado chegar
```

---

## Categoria E — Cenários de borda

### T21 — Motor de disponibilidade fora do ar

*Cobre: RN6*

```gherkin
Cenário: API de disponibilidade falha
  Dado que "/api/disponibilidade" responde erro
  Quando abro a página de um produto
  Então o conteúdo e o preço continuam visíveis
  E o bloco de disponibilidade mostra estado indeterminado, sem oferecer compra
```

### T22 — Fornada perde a validade durante a navegação

*Cobre: RN13*

```gherkin
Cenário: cutoff passa com a página aberta
  Dado que a fornada de 21.08 estava ativa
  Quando o motor deixa de oferecer 21.08 na leitura seguinte
  Então a seleção passa para a próxima fornada válida, com aviso visível
```

### T23 — Produto esgotado em todas as fornadas

*Cobre: RN14*

```gherkin
Cenário: sem estoque em nenhuma data
  Dado que "Pepperoni" tem 0 unidades em todas as fornadas do horizonte
  Quando abro "/sabores/pepperoni"
  Então vejo esgotado sem alternativa de data
  E o JSON-LD marca "OutOfStock"
```

### T24 — Produto sem foto

*Cobre: RN11*

```gherkin
Cenário: sabor ainda não fotografado
  Dado que "Lombo Canadense" não tem foto
  Quando vejo seu card na vitrine
  Então o placeholder ocupa exatamente a mesma área da foto dos demais
```

### T25 — JSON-LD não diverge da tela

*Cobre: RN9*

```gherkin
Cenário: coerência entre marcação e página
  Quando comparo preço e disponibilidade do JSON-LD com os exibidos
  Então os valores são idênticos, porque vêm da mesma função pura
```

---

## Critérios visuais de aceite (Gate Visual B)

Verificáveis a olho nu contra os previews aprovados em `preview-*.html`:

1. **Hero cabe na tela:** header + hero ocupam exatamente a altura da viewport, sem rolagem interna, de 320 px a 1440 px de largura e em telas baixas (landscape de celular).
2. **Disco:** produto sempre circular, dentro do painel `superficie-alta`, ocupando ~74% da largura do card, com sombra separando-o do painel.
3. **Grid responsivo:** 1 coluna < 640 px · 2 colunas < 1024 px · 3 colunas ≥ 1024 px, sem estouro horizontal em nenhuma largura.
4. **Selos:** ranking como marca circular amarela ou fita ancorada na base do disco; esgotado como carimbo diagonal sobre foto dessaturada. Nenhuma pílula cinza genérica.
5. **Alérgeno legível sem cor:** o texto "Contém …" está presente em todo card e na página de produto — a cor é reforço, nunca o único sinal.
6. **Régua comparativa da home** identifica os dois lados ("Congelada de supermercado" × "Napo") antes das linhas.
7. **Unidade correta:** toda contagem exibida ao cliente fala em "pizzas", nunca em "vagas".
8. **Nenhum texto cortado, sobreposto ou colado em borda** em qualquer viewport ≥ 320 px, incluindo os nomes longos ("Peito de Peru com Gorgonzola").

---

## Checklist de Conclusão

### Testes

- [ ] Todos os cenários acima implementados e verdes
- [ ] pgTAP cobrindo T16, T17, T18 (RLS do catálogo)
- [ ] Testes puros de `packages/core/catalogo` (preço efetivo, completude, JSON-LD)

### Qualidade

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build` e `pnpm test` verdes
- [ ] `pnpm db:types:check` sem diferença pendente
- [ ] Build do cliente validado (lição do postmortem 2026-06-12 — SDM-021)

### Escopo

- [ ] Mapa de Impacto (`design.md` §1) respeitado — nenhum arquivo fora dele
- [ ] Nenhum token novo em `tokens.css` sem justificativa registrada
- [ ] Nenhum componente novo além dos listados em `design.md` §4.4.3

### Fechamento

- [ ] Gate Visual B conferido contra os 8 critérios acima
- [ ] `ARCHITECTURE.md` §7.3 atualizado (`Product` + `Offer`)
- [ ] Retrospectiva disparada (`AGENTS.md` §5.1)
- [ ] `Status:` dos documentos alterado para `Concluído`
