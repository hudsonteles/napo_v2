# 🏗️ Design: Endereços e frete por faixa de distância

**ID:** NAPO-005
**Status:** Aprovado
**Spec:** [`spec.md`](./spec.md) · **Tests:** [`tests.md`](./tests.md)
**Data:** 2026-08-17

> Contrato técnico consumido pelo agente implementador. Documenta **decisão e WHY**, não restatement de código.
> Stack, árvore de diretórios e regra de dependência: `ARCHITECTURE.md` §2 e §3.

---

## 1. Mapa de Impacto

| Arquivo | Ação | Por quê |
|---|---|---|
| `supabase/migrations/0012_enderecos_frete.sql` | Criar | `ceps`, `enderecos`, `faixas_frete`, `excecoes_area`, colunas de frete em `config_operacao`, RLS |
| `supabase/tests/0012_enderecos_rls.sql` | Criar | Isolamento entre clientes é a proteção mais crítica desta spec (pgTAP) |
| `packages/core/src/frete/frete.ts` | Criar | Faixa → valor, frete grátis, fora de área (RN7, RN8, RN16) |
| `packages/core/src/frete/distancia.ts` | Criar | Haversine, estimativa rodoviária por fator, deslocamento do pin (RN6, RN11) |
| `packages/core/src/frete/area.ts` | Criar | Raio × exceção de CEP → atendido/motivo (RN9, RN10) |
| `packages/core/src/entrega/descricao.ts` | Criar | Dias de entrega + raio → frase exibível (RN17) |
| `packages/core/src/frete/*.test.ts` | Criar | Determinístico, sem rede |
| `packages/core/src/index.ts` | Modificar | Barrel |
| `packages/db/src/types.generated.ts` | Modificar | `pnpm db:types` |
| `apps/web/app/api/cep/[cep]/route.ts` | Criar | Cache → ViaCEP → BrasilAPI (RN2) |
| `apps/web/app/api/enderecos/route.ts` | Criar | `GET` lista do dono · `POST` cria (geocodifica, mede, avalia área) |
| `apps/web/app/api/enderecos/[id]/route.ts` | Criar | `PATCH` edita · `DELETE` desativa (RN15) |
| `apps/web/app/api/enderecos/[id]/padrao/route.ts` | Criar | Troca de padrão é operação atômica (RN13) |
| `apps/web/app/api/frete/route.ts` | Criar | `POST` — endereço + subtotal → frete. Contrato que o NAPO-006 consome |
| `apps/web/src/features/enderecos/services/geocoding.ts` | Criar | Google Geocoding + Routes, only-server |
| `apps/web/src/features/enderecos/services/cep.ts` | Criar | ViaCEP + BrasilAPI com fallback |
| `apps/web/src/features/enderecos/services/enderecos.ts` | Criar | Leitura/escrita no Supabase |
| `apps/web/src/features/enderecos/components/formulario-endereco.tsx` | Criar | Ilha cliente: CEP, campos, mapa |
| `apps/web/src/features/enderecos/components/mapa-pin.tsx` | Criar | Ajuste de pin (RN6) |
| `apps/web/src/features/enderecos/components/card-endereco.tsx` | Criar | Item da lista com estado de área |
| `apps/web/src/features/enderecos/index.ts` | Criar | Barrel da feature |
| `apps/web/app/(conta)/conta/enderecos/page.tsx` | Criar | Lista |
| `apps/web/app/(conta)/conta/enderecos/novo/page.tsx` | Criar | Cadastro |
| `apps/web/app/(conta)/conta/enderecos/[id]/page.tsx` | Criar | Edição |
| `packages/ui/src/components/dialog.tsx` | Criar | Confirmação de desativação — ver §4.1 |
| `.env.example` | Modificar | Duas chaves do Google (§6.2) |
| `apps/web/src/lib/env.ts` | Modificar | Zod das novas variáveis |

---

## 2. Decisões de Schema

### 2.1 Mudanças

- **`ceps`** — cache de CEP com `cep` como PK, campos do ViaCEP e `fonte`. Não é PII: é dado público de logradouro. Serve para não pagar latência de terceiro duas vezes pelo mesmo CEP e para o cadastro continuar funcionando quando ambas as APIs caem.
- **`enderecos`** — o dado do cliente. Guarda **duas coordenadas**: a que o geocoding devolveu (`lat_geocode`/`lng_geocode`) e a final, após o ajuste do pin (`lat`/`lng`). Sem as duas, medir o deslocamento da RN6 é impossível depois do fato — e é esse delta que separa "corrigiu a porta" de "arrastou para baratear o frete".
- **`distancia_km numeric(6,2)`** + **`distancia_estimada boolean`** + **`precisa_conferencia boolean`**: distância é cache (RN12), e as duas flags são o que impede uma estimativa silenciosa virar rota de entrega.
- **`atendido boolean`** — resultado congelado da avaliação de área no momento do cadastro, não derivação em tempo de leitura. Mudar o raio não pode revogar retroativamente o endereço de quem já comprou sem alguém olhar.
- **`faixas_frete`** — `km_de`, `km_ate`, `valor_centavos`. Centavos em `int` pelo mesmo motivo do catálogo: o valor vai ser somado a subtotal, imposto e taxa de cartão.
- **`excecoes_area`** — `tipo` (enum `bloqueio | liberacao`), `cep_prefixo`, `motivo` obrigatório. Exceção sem motivo é dívida: seis meses depois ninguém sabe por que aquele CEP está barrado.
- **`config_operacao`** ganha `raio_km`, `frete_gratis_centavos`, `fator_distancia_estimada numeric(3,2)` e `limite_ajuste_pin_m int`. O comentário da tabela (0003) já reservava o lugar.

### 2.2 Alternativas de modelagem descartadas

- **PostGIS / `geography`** — resolveria distância e raio no banco. Descartado: a distância que importa é **rodoviária** (vem da API, não do banco), o raio é escalar simples, e a extensão adiciona superfície de manutenção ao free tier do Supabase por um ganho que não existe neste volume. Reavaliar se a área virar polígono em vez de raio.
- **Endereço em `jsonb` no profile** — menos tabelas, porém sem FK, sem constraint de padrão único e sem RLS granular. Endereço tem ciclo de vida próprio (padrão, ativo, atendido) e é referenciado pelo pedido.
- **Derivar `atendido` na leitura** — descartado acima: transformaria mudança de configuração em revogação retroativa e silenciosa.

### 2.3 Decisões de índice / performance

- `enderecos (profile_id) where ativo` — a consulta real é "meus endereços ativos".
- Índice único parcial `enderecos (profile_id) where padrao and ativo` — a RN13 vira impossível de violar, inclusive por script.
- `excecoes_area (cep_prefixo)` — a avaliação de área faz busca por prefixo em toda criação de endereço.
- `ceps` não precisa de índice além da PK.

### 2.4 Migration

`0012_enderecos_frete.sql`. Seed das três faixas (R$ 6 / R$ 10 / R$ 14), `raio_km = 12` e `frete_gratis_centavos = 15000` entra na própria migration — é configuração de produto, precisa existir nos três ambientes (mesmo critério do catálogo em `0011`).

**RLS:**

| Tabela | anon | cliente | equipe |
|---|---|---|---|
| `ceps` | — | leitura e escrita pelo servidor | leitura |
| `enderecos` | — | **só as próprias linhas** (select/insert/update) | leitura (suporte e separação de entrega) |
| `faixas_frete` | leitura | leitura | leitura; escrita só admin |
| `excecoes_area` | — | — | leitura; escrita só admin |

`faixas_frete` é pública de leitura de propósito: a página de entrega do site precisa exibir os valores, e hoje eles estão cravados na copy (ideia já registrada no ROADMAP).

---

## 3. Decisões de Contrato

Convenção do projeto (`ARCHITECTURE.md` §4.2): `{ success, data?, error? }`, entrada validada por Zod.

### 3.1 Endpoints triviais

- `GET /api/enderecos` — lista os ativos do dono.
- `PATCH /api/enderecos/[id]` — edita campos textuais; se a coordenada mudar, refaz §3.2.
- `DELETE /api/enderecos/[id]` — desativa (RN15).
- `POST /api/enderecos/[id]/padrao` — em transação: desmarca o anterior, marca este.

### 3.2 Endpoints com decisão

#### `GET /api/cep/[cep]`
Cache → ViaCEP → BrasilAPI → `404` com `podeDigitarManual: true`. **Nunca** propaga erro de terceiro como falha do cadastro (RN2). Timeout curto (3 s) por provedor: o cliente está com o teclado na mão, esperar 30 s por um terceiro fora do ar é pior que digitar.

#### `POST /api/enderecos`
Recebe endereço + coordenada final escolhida no mapa. No servidor, em ordem: geocodifica (se o cliente não moveu o pin, é a mesma coordenada), calcula o deslocamento, mede a distância rodoviária, avalia a área, grava. **A distância nunca vem do corpo da requisição** — se viesse, o cliente escolheria a própria faixa de frete (RN5).

#### `POST /api/enderecos/posicao`
Recebe o endereço em texto, geocodifica, mede a rota, avalia a área e devolve tudo
**sem gravar nada**. É o que permite a etapa 2 existir: sem ele, a posição só seria
conhecida depois de salvar, e o cliente confirmaria um ponto que não viu.

Não recebe nem devolve id: não há linha ainda. O custo é uma geocodificação e uma
rota a mais por endereço (~600/mês contra franquias de 10.000 e 5.000) — ao salvar
o servidor **remede**, porque coordenada que volta do cliente não prova deslocamento
(RN6).

#### `POST /api/frete`
`{ enderecoId, subtotalCentavos }` → `{ freteCentavos, gratis, faixa, foraDeArea, motivo }`. O endereço é lido do banco pelo id do dono; nada de distância vinda do cliente. É o contrato que o checkout do NAPO-006 chama — por isso ele nasce aqui, e não lá.

---

## 4. Decisões de UI

### 4.1 Auditoria de Reuso

| Elemento | Decisão | Componente |
|---|---|---|
| Página, cabeçalho de conta | ♻️ REUSAR | layout de `(conta)` do NAPO-002 |
| Card de endereço | ♻️ REUSAR | `<Card>` |
| Botões e ações | ♻️ REUSAR | `<Button>` (variante `largura` do NAPO-003) |
| Campos do formulário | ♻️ REUSAR | `<Input>`, `<Label>` |
| Selo "padrão" / "fora de área" / "estimado" | ♻️ REUSAR | `<Badge>` |
| Marcar como padrão | ♻️ REUSAR | `<Checkbox>` ou ação no card |
| Mensagens de erro/sucesso | ♻️ REUSAR | `<Toaster>` |
| Confirmação de desativação | ✨ CRIAR NOVO | `<Dialog>` (shadcn) — o catálogo não tem overlay; desativar endereço é destrutivo o bastante para exigir confirmação e um `confirm()` nativo quebra a identidade visual |
| Mapa com pin arrastável | ✨ CRIAR NOVO | `<MapaPin>` — não existe equivalente; encapsula a Maps JS API e emite só `{lat, lng}` |
| Formulário completo | ✨ CRIAR NOVO | `<FormularioEndereco>` — orquestra CEP, campos e mapa; vive na feature, não em `packages/ui` (serve só a este domínio) |

### 4.2 Composição

```
/conta/enderecos                     /conta/enderecos/novo
┌──────────────────────────┐        ┌──────────────────────────┐
│ Meus endereços  [+ Novo] │        │ ← Voltar                 │
├──────────────────────────┤        │ CEP [_____] (buscando…)  │
│ ┌──────────────────────┐ │        │ Logradouro [editável]    │
│ │ Casa      [padrão]   │ │        │ Nº [___]  Compl. [____]  │
│ │ SQN 210 Bl C Ap 302  │ │        │ Bairro / Cidade / UF     │
│ │ 3,4 km · frete R$ 6  │ │        │ Referência [__________]  │
│ │ [Editar] [Desativar] │ │        ├──────────────────────────┤
│ └──────────────────────┘ │        │ ┌── mapa ──────────────┐ │
│ ┌──────────────────────┐ │        │ │   📍 arraste o pin   │ │
│ │ Trabalho             │ │        │ └──────────────────────┘ │
│ │ 9,1 km · frete R$ 14 │ │        │ 3,4 km · faixa R$ 6      │
│ └──────────────────────┘ │        │        [Salvar endereço] │
│ ┌──────────────────────┐ │        └──────────────────────────┘
│ │ Sítio  [fora da área]│ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

### 4.3 Estados visuais

| Estado | Tratamento |
|---|---|
| Lista vazia | Convite a cadastrar o primeiro endereço, não tabela vazia |
| CEP buscando | Campo em carregamento; demais campos travados até responder |
| CEP não encontrado | Campos liberados com aviso "não achamos esse CEP — pode preencher à mão" |
| Geocoding sem resultado | Mapa no centro de Brasília, pin arrastável, aviso de conferência |
| Fora de área | Card com selo próprio, ação de compra indisponível e microcopy honesto |
| Distância estimada | Selo discreto "distância aproximada" — visível ao cliente, sinalizado à operação |
| Salvando | Botão em carregamento, formulário travado (a chamada faz 2 requisições externas) |
| Limite de 10 | Botão de novo endereço desabilitado com explicação |

### 4.4 Preview Visual Aprovado

**Aprovado pelo PM em 2026-08-17.** Mecanismo: HTML standalone + Tailwind v4 via CDN com `@theme` espelhando `packages/ui/src/tokens.css` (matriz da FASE 3.5, linha React/Next + Tailwind). Modelo B — dois arquivos, jornadas distintas.

#### 4.4.1 Arquivos

- [`preview-lista.html`](./preview-lista.html) — `/conta/enderecos`: padrão, distância estimada, fora de área, lista vazia, limite de 10
- [`preview-formulario.html`](./preview-formulario.html) — `/conta/enderecos/novo`, **etapa 1**: preenchido, buscando CEP, CEP não encontrado. A seção de mapa deste arquivo foi **superada** pelo drift
- [`preview-etapa-mapa.html`](./preview-etapa-mapa.html) — **etapa 2**, aprovada em 2026-08-18: posição encontrada, mapa movido além do limite, geocodificação sem resultado, saída sem mouse

**Direção aprovada — régua de distância.** O card posiciona o endereço numa régua de 0 a 12 km com as três faixas marcadas, reaproveitando a linguagem da régua da home (NAPO-003). A alternativa "etiqueta de remessa" (monoespaçada, frete carimbado) foi apresentada e **rejeitada**: é o vocabulário do estoque, não o do cliente — quem cadastra endereço quer saber quanto custa, não conferir uma etiqueta.

#### 4.4.2 Componentes do catálogo usados

| Elemento do preview | Componente | Origem |
|---|---|---|
| Card de endereço, cartões de estado | `<Card>` | `packages/ui/src/components/card.tsx` |
| Ações (novo, editar, desativar, salvar) | `<Button>` (default, outline, ghost) | `packages/ui/src/components/button.tsx` |
| Selos PADRÃO / DISTÂNCIA APROXIMADA / fora de área | `<Badge>` | `packages/ui/src/components/badge.tsx` |
| Campos do formulário | `<Input>` + `<Label>` | `packages/ui/src/components/` |
| "Usar como endereço padrão" | `<Checkbox>` | `packages/ui/src/components/checkbox.tsx` |
| Logotipo do cabeçalho | `<Marca>` | `packages/ui/src/components/marca.tsx` |
| Feedback de salvamento e erro | `<Toaster>` | `packages/ui/src/components/toaster.tsx` |

#### 4.4.3 Componentes novos a criar

| Componente | Onde | Justificativa |
|---|---|---|
| `<Dialog>` | `packages/ui/src/components/dialog.tsx` | O catálogo não tem overlay; desativar endereço é destrutivo e `confirm()` nativo quebra a identidade |
| `<CardEndereco>` | `features/enderecos/components/` | Compõe `<Card>` + `<Badge>` + régua; a régua de faixa não existe em lugar nenhum |
| `<ReguaDistancia>` | `features/enderecos/components/` | Trilho 0–12 km com as três faixas e o pin do endereço — é a direção visual aprovada |
| `<FormularioEndereco>` | `features/enderecos/components/` | Orquestra CEP, campos e mapa; serve só a este domínio, não sobe para `packages/ui` |
| `<MapaConfirmacao>` | `features/enderecos/components/` | Encapsula a Maps JS API com pin fixo no centro e emite `{lat, lng}` do centro (drift.md) |

#### 4.4.4 Markup cru aceito

- Container raiz e grid de campos do formulário (layout de nível mais externo)
- Cabeçalho da página (título + ação primária)
- Barra de resumo do frete no formulário — bloco de dado único, não se repete em outra tela
- O "mapa" do preview é malha CSS: no produto é a Maps JS API real

#### 4.4.5 Critérios visuais de aceite

Derivados em `tests.md` (seção "Critérios visuais de aceite"), verificados no Gate Visual B.

### 4.5 Decisões de UX não-óbvias

- **A frase de cobertura é dado, não texto.** "Entregamos às sextas em Brasília, num raio de 12 km" é montada a partir de `dias_semana_entrega` e `config_operacao.raio_km` (RN17). A função pura recebe a lista de dias ativos e o raio e devolve a frase já flexionada — plural, "e" antes do último dia, singular quando há um só. A página de lista é Server Component: lê a configuração e passa a frase pronta, sem chamada extra no cliente.

- **A confirmação da posição é etapa própria, não elemento da página** (drift.md, 2026-08-18). A spec previu o risco e escolheu o remédio fraco: instrução não compete com hierarquia. Numa tela com nove campos, a atenção vai para o botão de salvar. O que faz alguém conferir a posição é a conferência **ser a tarefa**.
- **O pin é fixo no centro e o mapa se move.** Pin arrastável é o padrão errado em celular: o alvo é pequeno e o dedo cobre o que a pessoa precisa ver.
- **A régua de distância fica colada à confirmação.** Mover o mapa move o dinheiro — é o que dá motivo para olhar. Deslocamento acima do limite risca o número e anuncia o recálculo, em vez de deixá-lo mudar calado depois de salvar.
- **Cadastro é página, não modal.** O fluxo tem CEP, sete campos e um mapa; em celular, modal com mapa arrastável dentro é armadilha de scroll — arrastar o pin rola a página.
- **O frete aparece no cadastro, não só no checkout.** É a resposta à pergunta que o cliente realmente tem ("quanto sai para minha casa?") e antecipa a objeção antes do carrinho.
- **Fora de área não usa vermelho de erro.** O cliente não errou; a casa é que ainda não chega lá. Erro visual em quem fez tudo certo é o que faz a pessoa não voltar.
- ~~**O pin nasce onde o geocoding colocou**, com instrução explícita.~~ Superado pelo drift de 2026-08-18: a conclusão estava certa (mapa sem peso é decoração), o remédio não. Ver `drift.md`.

### 4.6 Responsividade

Mobile-first (é onde o cliente cadastra). Mapa com altura fixa proporcional, nunca `100vh`. Formulário em coluna única até 768 px; a partir daí, campos curtos (número, CEP, UF) em linha.

### 4.7 Acessibilidade

Cada campo com `<Label>` associado. O mapa **não pode ser o único caminho**: a coordenada final é ajustável pelo pin, mas o endereço é válido sem tocar no mapa — arrastar pin não é operável por teclado, e um cadastro que exige mouse exclui.

---

## 5. Decisões Técnicas Gerais

- **Duas chaves do Google, não uma.** A chave de servidor (Geocoding + Routes) nunca sai do Route Handler; a de navegador (Maps JS) é restrita por referrer. Uma chave só, exposta no bundle, permitiria a terceiros consumirem a franquia gratuita da Napo — e é a franquia que mantém o custo em zero.
- **Google, não OSM/Leaflet.** `ARCHITECTURE.md` §5 já decidiu. Além disso, os tiles públicos do OpenStreetMap têm política de uso justo que não cobre produto comercial.
- **Cache de CEP no banco, não em memória.** Serverless não tem processo longevo; cache em memória morre a cada cold start.
- **A regra de frete não sabe o que é HTTP nem banco.** `packages/core/src/frete` recebe números e devolve números (RN16) — mesma disciplina do motor de disponibilidade, mesmo motivo: é a regra que, errada, cobra frete abaixo do custo.
- **Teto de chamadas externas por endereço.** Uma geocodificação e uma rota por endereço salvo; edição só refaz se a coordenada mudou (RN12). Sem esse teto, um cliente arrastando o pin dez vezes gasta dez rotas.
- **Formatação de dias vive no core, não no componente.** É a mesma frase que a home, o checkout e o e-mail de confirmação vão precisar; nascer dentro de um `.tsx` de conta garante que o segundo consumidor a reescreva diferente.
- **`numeric(6,2)` para distância**, não float: 12,00 km precisa comparar com o raio sem surpresa de ponto flutuante na borda exata da faixa.

---

## 6. Dependências Novas

### 6.1 Bibliotecas

- `@googlemaps/js-api-loader` — carrega a Maps JS API sem `<script>` manual e sem duplicar carregamento entre navegações do App Router.

### 6.2 Variáveis de ambiente

| Variável | Escopo | Uso |
|---|---|---|
| `GOOGLE_MAPS_SERVER_KEY` | servidor | Geocoding + Routes. **Nunca** com prefixo público |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | navegador | Maps JS, restrita por referrer |

### 6.3 Integrações externas

| Serviço | Franquia mensal | Consumo estimado |
|---|---|---|
| ViaCEP / BrasilAPI | gratuitas, sem chave | 1 por CEP novo (com cache) |
| Google Geocoding | 10.000 | ~300 |
| Google Routes | 5.000 | ~300 |
| Google Maps JS | 10.000 | ~600 (cadastro + edição) |

---

## 7. Plano de Blocos

Mais de 5 blocos previstos (schema, core, serviços externos, API, UI de lista, UI de formulário+mapa) → `plan.md` na execução do `/implementar`.

---

## 8. Riscos Conhecidos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Geocoding erra em quadra do Plano Piloto | Alta | Entrega no bloco errado | Pin ajustável (RN6) + referência textual + conferência do endereço marcado |
| Pico anômalo estoura a franquia do mês | Baixa | Cobrança inesperada | Cache de CEP e de distância, teto por endereço, alerta de cota no Google Cloud |
| ViaCEP e BrasilAPI fora do ar juntas | Baixa | Cadastro manual | Caminho manual é RN, não fallback improvisado |
| Cliente arrasta o pin para baixar o frete | Média | Frete abaixo do custo | Limite de 300 m com marcação para conferência (RN6) |
| Distância estimada vira rota real sem conferência | Média | Prejuízo por entrega | Flag no banco + selo na UI + KPI de conferência |
| Faixas ficarem desatualizadas com o combustível | Média | Margem corroída | Configuração em tabela; simulador de custo é NAPO-008 |
