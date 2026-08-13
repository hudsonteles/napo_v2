# 📋 Spec: Site público, catálogo e SEO

**ID:** NAPO-003
**Status:** Aprovado
**Responsável:** Hudson
**Data:** 2026-08-12
**Item no Roadmap:** NAPO-003

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.

---

## 1. Visão Geral (User Stories)

> **Como** alguém que nunca ouviu falar da Napo e caiu aqui pelo Google, **eu quero**
> entender em segundos por que essa pizza é diferente da congelada de supermercado,
> **para que** eu decida se vale pagar mais caro que a do mercado.

> **Como** cliente decidindo o que pedir, **eu quero** ver os sabores com preço, foto e
> o que realmente vem dentro, **para que** eu escolha sem precisar perguntar no WhatsApp.

> **Como** cliente com alergia (ou comprando para alguém com alergia), **eu quero** saber
> antes de comprar o que o produto contém e o que ele pode conter por contato na cozinha,
> **para que** a decisão de risco seja minha e não uma surpresa quando a caixa chegar.

> **Como** cliente que já comprou, **eu quero** saber como conservar e como aquecer,
> **para que** a pizza chegue na mesa como saiu do forno italiano — a promessa da marca
> só se cumpre no forno da casa do cliente.

> **Como** dona do negócio, **eu quero** que cada sabor tenha um endereço próprio e
> estável que o Google indexe, **para que** a Napo apareça para quem busca pizza
> congelada em Brasília sem eu pagar por cada clique.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] **12 produtos publicados** com rotulagem completa (denominação de venda, alérgenos, precaucional, peso, validade, conservação e preparo) — nenhum campo vazio em produto ativo.
- [ ] **100% das páginas de produto indexáveis** e presentes no `sitemap.xml`, com JSON-LD válido no Rich Results Test.
- [ ] **LCP < 2,5 s e CLS < 0,1** na página de produto e na vitrine, em 4G simulado — a página é a vitrine de um produto premium; travar ou pular layout desmonta o argumento.
- [ ] **Zero requisição de renderização por visita** no grupo `(site)`: páginas servidas do CDN (SSG + `revalidate` longo), conforme `ARCHITECTURE.md` §4.5.
- [ ] **Disponibilidade exibida bate com o motor NAPO-004** — nenhum sabor aparece comprável quando não há capacidade.

---

## 3. Regras de Negócio Obrigatórias

- **RN1 — Só o que está ativo existe publicamente.** Produto com `ativo = false` não aparece na vitrine, não aparece no `sitemap.xml`, não gera JSON-LD e sua URL responde 404. Não basta esconder da listagem: uma URL viva de produto descontinuado continua indexada e vende o que não existe.

- **RN2 — Rotulagem completa é condição para publicar.** Todo produto ativo exibe, na sua página: denominação de venda (nome legal do que o produto é, não o nome comercial), lista **"Contém"**, lista **"Pode conter"**, peso líquido, prazo de validade, instruções de conservação e instruções de preparo. Nenhum desses campos pode ficar vazio em produto ativo — a validação impede publicar produto incompleto.

- **RN3 — Alérgeno aparece também na listagem.** A vitrine sinaliza os alérgenos de destaque de cada produto (a avelã da Nutella é o caso crítico). Quem tem alergia não deve precisar abrir 12 páginas para descobrir qual pode comer.

- **RN4 — "Pode conter" é declaração de cozinha compartilhada, não texto opcional.** A mesma cozinha manipula glúten, leite e avelã. O precaucional é declarado por produto e é editorial da casa, não derivado automaticamente da ficha técnica.

- **RN5 — Preço exibido é o preço da faixa, salvo exceção explícita.** O produto herda o preço da sua faixa (Tradicional R$ 39,90 · Especial R$ 45,90 · Premium R$ 49,90 · Massa R$ 15,00). Quando há `preco_override`, ele vence. O site sempre deixa claro que o preço **não inclui frete**.

- **RN6 — Disponibilidade exibida é a real, vinda do motor NAPO-004.** A quantidade restante aparece **sempre**, não só quando está baixa. Sabor sem capacidade na fornada escolhida aparece como **esgotado** e não oferece compra para aquela data. É verdade verificável, nunca escassez artificial: o número exibido é o mesmo que o motor calcula.

- **RN7 — Nada de alegação de saúde ou digestão.** O conteúdo usa formulação sensorial ("leve", "não pesa"). Alegação funcional ou de saúde é território regulado pela ANVISA e não entra em nenhuma superfície — nem em texto de produto, nem em meta description, nem em JSON-LD.

- **RN8 — A URL de um produto é permanente.** Cada produto vive em `/sabores/[slug]`. O slug é definido na publicação e **não muda** quando o nome comercial muda — trocar URL indexada custa mapa de 301 e descarta autoridade acumulada. Renomear "Frango c/ Catupiry" não pode mover a página.

- **RN9 — Cada produto se declara ao buscador como produto à venda.** JSON-LD `Product` + `Offer` por página de produto (preço, moeda BRL, disponibilidade coerente com a RN6) e `Restaurant` no site. Preço e disponibilidade no JSON-LD são os mesmos exibidos na tela — divergência entre marcação e página é motivo de penalização, não de ranking.

- **RN10 — O site não promete entregar onde não entrega.** A área de entrega (Brasília, raio configurável de 12 km) é visível no site público. Cliente fora da área descobre antes de montar carrinho, não no checkout.

- **RN11 — Imagem nunca empurra o layout.** Toda imagem tem proporção reservada, inclusive os placeholders que antecedem o ensaio fotográfico (NAPO-020). O site nasce com placeholders nas proporções finais e recebe as fotos reais sem mexer em layout.

- **RN12 — O catálogo é público para leitura e só para leitura.** Visitante anônimo lê categorias, faixas de preço e produtos ativos; não alcança nenhuma outra tabela e não escreve nada. Esta é a primeira superfície do banco exposta a anônimo — o padrão do projeto é deny-by-default e ele não é afrouxado aqui.

- **RN13 — O cliente escolhe a fornada.** Toda a vitrine é relativa a uma data de entrega escolhida entre as que o motor oferece no horizonte (`config_operacao.horizonte_semanas`). Trocar a fornada troca preço nenhum e disponibilidade toda. A fornada ativa é visível o tempo todo — o cliente nunca deve descobrir no checkout para quando está comprando.

- **RN14 — Esgotado não é fim de linha.** Quando um sabor está esgotado na fornada ativa mas tem estoque em uma seguinte, a tela oferece **comprar naquela fornada**, com a data e a quantidade explícitas. O forno ocioso da semana seguinte é o ativo que essa regra transforma em venda.

- **RN15 — Um pedido pertence a uma única fornada.** O carrinho carrega uma data de entrega; trocar a fornada com itens dentro exige confirmação explícita do cliente. Um pedido é uma entrega, um frete e uma rota — misturar datas criaria pedido com dois status de entrega e dois fretes, complexidade que o R1 não paga. (O carrinho em si é NAPO-006; a regra nasce aqui porque é a tela que a impõe.)

- **RN16 — O site tem uma porta de entrada para eventos.** Uma seção na home e a página `/eventos` apresentam o serviço, as faixas de preço por pessoa e os opcionais, com CTA que abre conversa no WhatsApp. A tela separa o que é **serviço** — forno de pedra no local e pizza assada na hora, sempre incluídos — do que é **escolha do cliente**: louças e talheres, bebidas e garçons. Tratar o forno como opcional descaracterizaria o produto. Os valores exibidos são **conteúdo**, não cálculo: nenhum orçamento é fechado pelo site no R1. Existe porque hoje não há caminho nenhum para quem procura pizza para festa — lacuna que o próprio ROADMAP já registrava como ideia em aberto.

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário | Ação do Usuário | Resposta do Sistema |
|---|---|---|
| Produto inexistente ou desativado | Acessa `/sabores/slug-que-nao-existe` | Página 404 da marca, com caminho de volta para a vitrine — nunca erro cru do framework |
| Sabor esgotado na fornada ativa | Abre a página do produto | Estado "esgotado" explícito para aquela data, sem oferta de compra, e caminho direto para a primeira fornada com estoque (RN14); JSON-LD marca `OutOfStock` só quando não há estoque em fornada nenhuma |
| Nenhuma fornada com estoque do produto | Abre a página do produto | Esgotado sem alternativa, sem prometer data que o motor não confirmou |
| Fornada escolhida passa do cutoff durante a navegação | Tenta comprar | A fornada sai da lista na próxima leitura do motor; a seleção cai para a próxima válida, com aviso — nunca compra silenciosa para outra data |
| Motor de disponibilidade indisponível | Abre vitrine ou produto | Catálogo continua servido (conteúdo e preço vêm do build); o bloco de disponibilidade degrada para estado neutro, sem afirmar disponibilidade que não foi confirmada |
| Foto do produto ainda não existe | Abre qualquer página | Placeholder na proporção final, com `alt` descritivo real — sem espaço vazio e sem salto de layout |
| Visitante fora da área de entrega | Lê a home | Área de entrega declarada no site, com o raio e a cidade explícitos |
| Cliente tenta comprar antes do NAPO-006 existir | Clica no CTA da página de produto | CTA presente e desabilitado, com microcopy honesto sobre o canal ainda não estar aberto |

---

## 5. Não-Objetivos (Fora do Escopo)

- **Carrinho, checkout e pagamento** — NAPO-006. Aqui o CTA existe no layout, desabilitado.
- **Página "Sobre / quem somos"** — decisão do PM em 2026-08-12. Consequência aceita: perde-se a prova de "não é fábrica" e um sinal de autoridade para o buscador. Entra depois como rota nova, sem retrabalho no catálogo.
- **CRUD de catálogo no admin** — NAPO-008. Os 12 produtos entram por seed versionado no repositório, revisável em pull request; alterar catálogo no R1 é mudança de código, deliberadamente.
- **Texto legal real e banner de consentimento** — NAPO-009. Aqui existem apenas as rotas com conteúdo provisório, para não deixar link quebrado no rodapé.
- **Avaliações, notas e `AggregateRating`** — não há avaliação real coletada. Marcar nota inventada em rich result é dado falso, com risco de penalização.
- **Promoções, cupons, descontos e combos** — perguntado pelo PM em 2026-08-13 e mantido fora. Não existia no R1 nem no ROADMAP: mexe em preço, checkout e margem ao mesmo tempo, e precisa nascer como item próprio. Registrado em 💡 Ideias do ROADMAP na mesma data. A única regra promocional do R1 continua sendo frete grátis acima de R$ 150 (NAPO-005).
- **Simulador de orçamento de eventos** — o cliente informar número de pessoas, opcionais e garçons e receber o valor calculado é **item próprio do ROADMAP**, registrado em 2026-08-13 com todos os parâmetros (R$ 99,00/pessoa a partir de 10 até R$ 64,90/pessoa em 100; garçom a R$ 250; louças, talheres e bebidas como opcionais). Fica fora daqui por uma razão objetiva: o PM exige que **todos os valores sejam editáveis no admin**, e o admin é NAPO-008. Sem ele, os preços nasceriam cravados no código e mudar o valor do garçom exigiria deploy. Além disso, o item precisa de faixas de preço, catálogo de opcionais, calculadora em `packages/core` e captação de lead com consentimento LGPD — metade da precificação assistida do NAPO-010.
- **Aviso de reposição ("avise-me quando voltar")** — descartado em 2026-08-13 em favor da RN14. Capturar e-mail para talvez vender depois é pior que vender agora numa fornada com forno vago.
- **Ensaio fotográfico** — NAPO-020, bloqueado externamente. O site é construído com placeholders.
- **Blog, receitas e conteúdo editorial recorrente** — fora do R1.
- **Vercel Analytics e Speed Insights** — cota paga, fora do R1 por `ARCHITECTURE.md` §4.5.
- **Etiqueta física de lote/validade** — já capturada em 💡 Ideias do ROADMAP; aqui os dados que ela vai consumir nascem no schema.

---

## 6. Dependências de Negócio

- **NAPO-001** (fundação: monorepo, Supabase, CI) — concluído.
- **NAPO-002** (auth e base de UI: tokens, primitivos shadcn, `<Marca>`) — concluído; esta spec herda a base e revisa a calibragem em vez de recriá-la.
- **NAPO-004** (motor de disponibilidade) — concluído; é a fonte da RN6.
- **Conteúdo de rotulagem dos 12 produtos** — peso líquido, validade, conservação, preparo, "contém" e "pode conter" precisam existir como informação do negócio antes do seed. É levantamento do PM, não decisão técnica.
- **NAPO-020** (ensaio fotográfico) — **deixou de bloquear**. Em 2026-08-13 o PM indicou `docs/images/ensaio/`, com fotos utilizáveis de 9 dos 12 produtos, mais ambiente de forno e produção. Faltam **Lombo Canadense, Massa doce e Massa salgada**, que nascem com placeholder até serem fotografados. O item continua aberto no ROADMAP, mas como pendência pequena, não como bloqueio do catálogo.

---

## 7. Observações e Decisões de Negócio

- **Uma spec só, fatiada em blocos de execução** (decidido 2026-08-12). Fatiar em "schema" e "site" faria a segunda spec redesenhar telas sobre dados que a primeira já teria fixado — e o SEO ficaria órfão da estrutura de URL.
- **`/sabores/[slug]`** — adere ao vocabulário que `ARCHITECTURE.md` §3.1 já registra para o grupo `(site)`. A palavra "cardápio", de maior volume de busca, vive no `<title>` e no `<h1>`, que é onde o buscador lê intenção. URL não é palavra-chave: é endereço permanente.
- **`Product` + `Offer` no JSON-LD, além de `Restaurant`** — `Restaurant` sozinho alimenta features locais, não o resultado de e-commerce com preço e disponibilidade. Complementa `ARCHITECTURE.md` §7.3, que menciona apenas `Restaurant`; a arquitetura é atualizada junto com esta spec.
- **Rotulagem completa desde a primeira migration** — campo obrigatório adicionado depois exige migration com backfill dos 12 produtos, e o dado de rotulagem é reaproveitado três vezes: site, etiqueta física (💡 Ideias) e NFC-e (NAPO-011).
- **O concorrente é a congelada de supermercado, não a pizzaria da esquina.** O eixo do conteúdo é físico, não retórico: _"Longa fermentação. Assada na pedra. Em casa, só aquecer. A parte difícil já foi feita."_ A casa do cliente não tem forno de pedra — a promessa é defensável e não copiável.
- **Eixo alterado pelo PM em 2026-08-12,** durante o Gate Visual A: a formulação anterior era _"Forno italiano a 400 °C"_. "Assada na pedra" é imagem concreta e imediata; o número era o argumento técnico de por que a casa não reproduz o resultado. Consequência aceita: perde-se o dado verificável e ganha-se a imagem. `ARCHITECTURE.md` §7.3 e a spec macro do R1 §11 registram o eixo antigo e são atualizados junto com esta spec.
- **O selo da vitrine é factual: "Mais pedida", não "Destaque"** (decidido 2026-08-12). Isso muda o significado do campo: um rótulo factual só pode marcar o que a casa realmente mede. A spec R1 §10 sugeria destacar **Banana** por ter provavelmente a melhor margem — com o rótulo novo, isso deixa de caber, porque margem alta não é "mais pedida". Por isso o campo vira um `selo` com valores nomeados (`mais_pedida`, `novidade`) em vez de um booleano genérico: cada selo carrega uma afirmação específica, que precisa ser verdade.
- **Peito de Peru com Gorgonzola** — a spec R1 §10 registra que provavelmente tem o insumo mais caro do catálogo; a confirmação depende da ficha técnica (NAPO-008).
- **Vender para fornadas futuras não exigiu nada do backend.** Descoberto durante o Gate Visual A: `diasDeEntregaDoHorizonte()` (NAPO-004) já devolve **todas** as datas de entrega do horizonte, cada uma com cutoff, modo CTP/ATP e disponibilidade por produto. A tela é que estava desenhada como se existisse uma fornada só. A RN13 apenas expõe o que o motor já calcula.
- **A fornada virou o eixo visual do site** (decidido 2026-08-13). A ocupação do forno — "47/130 desta fornada já têm dono" — aparece na home e na vitrine. É o número mais honesto que a Napo tem: escassez real de capacidade, não urgência fabricada, e nenhum concorrente pode copiar sem ter o dado.
- **A pizza vista de cima é o sistema visual** (decidido 2026-08-13): produto aparece em disco, não em retângulo. Além de usar o ativo da marca (o `O` do logotipo é a pizza), o recorte circular **apara o fundo** — as fotos do ensaio foram feitas sobre tábua, granito e toalha xadrez, e num grid de 12 essa variação apareceria. O disco vive num painel de tom mais claro (variação "A3"), que dá chão à foto e delimita a informação.
- **Selos redesenhados** (2026-08-13): ranking como marca circular amarela ou fita ancorada no disco; esgotado como carimbo diagonal sobre foto dessaturada. A pílula cinza genérica saiu.
- **O hero ocupa exatamente uma tela**: `header + hero = 100dvh`, com tipografia e espaçamentos em `clamp()` para caber de 320 px a 1440 px sem estourar altura. Uma seta no rodapé sinaliza que há conteúdo abaixo — tela cheia sem borda visível esconde a rolagem.
- **O site não vai ao ar ao fim desta spec.** Publicação é NAPO-021, e faz sentido publicar só depois do NAPO-006 — site indexado com CTA desabilitado gera visita que não converte e primeira impressão ruim de domínio novo.

---

## 8. Aprovação

- [ ] **Spec revisado e aprovado por:** [Nome / Data]
- [ ] **Design técnico criado** (`design.md`)
- [ ] **Critérios de teste criados** (`tests.md`)
- [ ] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
