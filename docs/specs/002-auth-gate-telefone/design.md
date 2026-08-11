# 🏗️ Design: Autenticação, papéis e gate de telefone por WhatsApp

**Spec relacionado:** [`spec.md`](./spec.md)
**Testes relacionados:** [`tests.md`](./tests.md)

> 📌 Este documento define o **COMO** — focado em **DECISÕES**, não em restatement.
> Para regras de negócio veja `spec.md`. Para validação veja `tests.md`.
> Dono primário: **Agente / Tech Lead**.

---

## 1. Mapa de Impacto

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `supabase/migrations/0006_auditoria.sql` | Criar | Médio | Tabela genérica de auditoria prevista no R1 §4. Nasce aqui porque RN14 exige rastro do override; NAPO-008 herda pronta. |
| `supabase/migrations/0007_telefone.sql` | Criar | **Alto** | Unicidade de telefone validado, formato E.164 e a tabela `telefone_verificacoes`. Toca `profiles`, compartilhada por todo o sistema. |
| `supabase/migrations/0008_consentimentos.sql` | Criar | Médio | `termos_versoes` + `consentimentos` + semente da versão zero (RN15). |
| `supabase/migrations/0009_admin_functions.sql` | Criar | **Alto** | `validar_telefone_manual()` e `promover_usuario()` — `SECURITY DEFINER` com escalada de privilégio se mal escritas. |
| `supabase/tests/0005_telefone_rls_test.sql` | Criar | Baixo | Prova que `telefone_verificacoes` é inalcançável pela chave anônima. |
| `supabase/tests/0006_admin_functions_test.sql` | Criar | Baixo | Prova que não-admin não executa as funções de override. |
| `supabase/config.toml` | Modificar | Médio | Habilitar Google, ajustar `otp_expiry`, `site_url` e URLs de redirect. |
| `supabase/seed.sql` | Modificar | Baixo | Semente da versão zero dos termos + telefone validado no admin de seed. |
| `packages/core/src/telefone/e164.ts` | Criar | Baixo | Normalização e validação de celular BR (RN8). Regra pura, determinística. |
| `packages/core/src/telefone/index.ts` | Criar | Baixo | Barrel da nova área do núcleo. |
| `packages/core/src/otp/codigo.ts` | Criar | Baixo | Geração do código, cálculo de expiração e decisão de tentativa/reenvio (RN6, RN7) — sem I/O. |
| `packages/core/src/otp/index.ts` | Criar | Baixo | Barrel. |
| `packages/core/src/index.ts` | Modificar | Baixo | Reexporta as duas áreas novas. |
| `packages/ui/src/components/*` | Criar | Médio | Primeiros primitivos shadcn do projeto (§4.1). Base que o NAPO-003 herda. |
| `packages/ui/src/patterns/auth-card.tsx` | Criar | Baixo | Pattern de composição das duas telas de auth (§4.1). |
| `packages/ui/src/lib/cn.ts` | Criar | Baixo | Helper `clsx` + `tailwind-merge` exigido pelos primitivos shadcn. |
| `packages/ui/src/tokens.css` | Modificar | Baixo | Acrescenta os tokens que os primitivos consomem (superfícies, borda, foco, raio, fonte). |
| `packages/ui/package.json` | Modificar | Baixo | Dependências de UI (§6.1) e exports do pacote. |
| `apps/web/app/globals.css` | Criar | Baixo | Entrada do Tailwind v4 + import dos tokens. |
| `apps/web/postcss.config.mjs` | Criar | Baixo | `@tailwindcss/postcss`. |
| `apps/web/app/layout.tsx` | Modificar | Médio | Passa a carregar Tailwind, fonte via `next/font` e o container de toasts. Hoje tem estilo inline do NAPO-001. |
| `apps/web/app/(conta)/entrar/page.tsx` | Criar | Médio | Tela de entrada (Magic Link + Google). |
| `apps/web/app/(conta)/validar-telefone/page.tsx` | Criar | Médio | Tela do gate: nome, telefone, código e consentimentos. |
| `apps/web/app/(conta)/conta/layout.tsx` | Criar | **Alto** | Guarda da área do cliente — exige sessão e telefone validado (RN3). |
| `apps/web/app/(conta)/conta/page.tsx` | Criar | Baixo | Destino mínimo pós-login do cliente; prova o guarda. |
| `apps/web/app/(admin)/admin/layout.tsx` | Criar | **Alto** | Guarda do painel — exige papel de equipe (RN4). |
| `apps/web/app/(admin)/admin/page.tsx` | Criar | Baixo | Destino mínimo da equipe; prova o guarda. |
| `apps/web/app/api/auth/callback/route.ts` | Criar | **Alto** | Troca do código PKCE por sessão e roteamento por papel (RN5). |
| `apps/web/app/api/auth/sair/route.ts` | Criar | Baixo | Encerra sessão e limpa cookies. |
| `apps/web/app/api/otp/enviar/route.ts` | Criar | **Alto** | Emissão do código: rate limit, unicidade, envio (RN6-RN9, RN11). |
| `apps/web/app/api/otp/validar/route.ts` | Criar | **Alto** | Conferência do código e gravação do consentimento (RN6, RN10, RN15). |
| `apps/web/src/features/auth/components/*` | Criar | Médio | Formulários client-side das duas telas. |
| `apps/web/src/features/auth/services/sessao.ts` | Criar | **Alto** | Leitura de sessão + perfil no servidor; fonte única dos guardas. |
| `apps/web/src/features/auth/services/verificacao.ts` | Criar | **Alto** | Orquestra emissão e conferência do código com a `service_role`. |
| `apps/web/src/features/auth/services/consentimento.ts` | Criar | Médio | Registra aceite com versão e IP. |
| `apps/web/src/features/auth/destino.ts` | Criar | Médio | Papel → rota de destino (RN5). |
| `apps/web/src/features/auth/index.ts` | Criar | Baixo | Barrel da feature. |
| `apps/web/src/lib/otp/remetente.ts` | Criar | Médio | Interface do canal de envio + seleção por variável de ambiente (RN16). |
| `apps/web/src/lib/otp/remetente-fake.ts` | Criar | Baixo | Escreve o código no log do servidor. Dev e staging. |
| `apps/web/src/lib/otp/remetente-meta.ts` | Criar | Médio | Cloud API oficial do WhatsApp. Produção. |
| `apps/web/src/lib/supabase/admin.ts` | Criar | **Alto** | Client com `service_role`, restrito a Route Handlers. |
| `apps/web/src/lib/supabase/middleware.ts` | Criar | **Alto** | Renovação de sessão compartilhada pelo middleware. |
| `apps/web/middleware.ts` | Criar | **Alto** | Renova sessão e barra rota protegida sem sessão. |
| `apps/web/src/lib/env.ts` | Modificar | **Alto** | Novas variáveis de servidor (§6.2). Ponto único de leitura de `process.env`. |
| `apps/web/src/lib/ip.ts` | Criar | Baixo | Extrai IP do cliente atrás do proxy da Vercel (RN7, RN15). |
| `apps/web/package.json` | Modificar | Baixo | Tailwind, PostCSS e `@napo/ui`. |
| `scripts/admin.mjs` | Criar | Médio | Wrapper de linha de comando das funções de override (RN14). |
| `.env.example` | Modificar | Baixo | Documenta as variáveis novas. |
| `apps/web/src/lib/supabase/server.ts` | Reutilizar | — | Já existe; os guardas o consomem. |
| `supabase/migrations/0002_profiles.sql` | Reutilizar | — | `user_role`, `is_admin()` e o trigger de auto-promoção (RN12) já existem. |

> O mapa passa de 15 linhas porque metade dele é infraestrutura de primeira vez (Tailwind, primitivos de UI, client `service_role`) que nenhuma spec futura vai repetir. O plano de blocos (§7) separa exatamente essa parte.

---

## 2. Decisões de Schema

### 2.1 Mudanças

- **`profiles.telefone` guarda E.164 e ganha `check`** de `^\+55\d{11}$`. Optei por **manter o nome atual** em vez de renomear para `telefone_e164` como o R1 escrevia: rename propaga em tipos gerados e no seed para ganhar só clareza de nome, e um `comment on column` entrega a mesma informação de graça.
- **Índice único parcial `where telefone_validado_em is not null`** implementa a RN9 no banco. Único parcial, não único simples: dois cadastros podem estar *tentando* o mesmo número ao mesmo tempo (a pessoa errou a conta e recomeçou); só não podem terminar os dois validados. A corrida entre eles é resolvida pelo próprio índice, não por leitura prévia na aplicação.
- **`telefone_verificacoes`** — uma linha por código emitido: `profile_id`, `telefone`, `codigo_hash`, `tentativas`, `expira_em`, `validado_em`, `ip`, `criado_em`. A tabela é ao mesmo tempo o registro do desafio e a fonte do rate limit: contar linhas por número ou IP nas últimas 24h responde a RN7 sem armazenamento adicional.
- **`auditoria`** genérica (`tabela`, `registro_id`, `acao`, `profile_id`, `dados_antes`, `dados_depois`, `motivo`, `criado_em`) conforme o R1 §4. Acrescentei `motivo` ao desenho original: para override manual, *por que* foi feito importa mais que o diff, e um `jsonb` de antes/depois não responde isso.
- **`termos_versoes`** (`tipo`, `versao`, `conteudo`, `publicado_em`) e **`consentimentos`** (`profile_id`, `tipo`, `versao`, `aceito_em`, `ip`). O consentimento aponta para a versão textual, não para um booleano: "aceitou os termos" sem dizer *quais* termos não sustenta prova nenhuma.
- **Semente da versão zero** dos termos e da privacidade na migration (não no `seed.sql`): produção também precisa dela para o cadastro funcionar, e `seed.sql` só roda em local.

### 2.2 Alternativas de modelagem descartadas

- **A — Código no `auth.users.phone` nativo do Supabase.** O Supabase tem fluxo de OTP por telefone embutido. **Descartada porque** ele pressupõe provedor de SMS (Twilio/Vonage/MessageBird), trata o telefone como credencial de login e não permite injetar WhatsApp como canal. Estaríamos lutando contra o produto.
- **B — Tabela de rate limit separada com contador agregado.** **Descartada porque** duplica estado: `telefone_verificacoes` já tem uma linha por envio com hora e IP. Contador agregado precisaria de janela, reset e uma segunda fonte de verdade para divergir da primeira.
- **C — Guardar o código em texto puro com expiração curta.** **Descartada porque** um dump de banco entrega códigos ativos, e o custo do hash é irrelevante no volume desta operação.

### 2.3 Decisões de índice

- `profiles (telefone) where telefone_validado_em is not null` — único, implementa RN9.
- `telefone_verificacoes (telefone, criado_em desc)` — a query do rate limit por número.
- `telefone_verificacoes (ip, criado_em desc)` — a query do rate limit por IP.
- `telefone_verificacoes (profile_id, criado_em desc)` — busca do desafio ativo da pessoa.
- `auditoria (tabela, registro_id, criado_em desc)` — a consulta que o NAPO-008 vai fazer. Sem índice em `dados_antes`/`dados_depois`: busca dentro do jsonb não é caso de uso previsto.

### 2.4 RLS

- `telefone_verificacoes` — RLS ligada e **política explícita de negação** (`using (false)`) para o papel autenticado. A tabela é acessada exclusivamente pela `service_role` dentro de Route Handlers. Existe política declarada em vez de "nenhuma política" porque o teste do NAPO-001 exige declaração explícita, e porque *negar de propósito* e *esquecer de declarar* precisam ser distinguíveis na leitura.
- `auditoria` — leitura só para admin; escrita só pelas funções `SECURITY DEFINER`. Ninguém escreve auditoria diretamente, inclusive admin: registro que o autor pode forjar não é auditoria.
- `termos_versoes` — leitura pública (a tela de cadastro precisa mostrar antes de haver sessão), escrita só admin.
- `consentimentos` — cada um lê o próprio; admin lê todos; escrita pela `service_role` no ato do cadastro.

### 2.5 Migration

Todas aditivas e idempotentes. O único ponto de atenção é o índice único de telefone: se algum dia rodar sobre base com duplicata validada, falha na criação. Hoje só existe o admin de seed, então não há backfill. Sem `down` — nada destrutivo a reverter.

---

## 3. Decisões de Contrato

### 3.1 Endpoints com decisão

#### `POST /api/otp/enviar` — `{ telefone, nome }`

- **Decisão:** um único endpoint faz normalização, verificação de unicidade, rate limit, gravação do desafio e envio. **Motivo:** são passos de uma transação lógica; separá-los criaria estado intermediário observável (desafio gravado sem mensagem enviada) sem ganho nenhum.
- **Resposta uniforme e cega:** `200 { success: true, data: { expiraEm, podeReenviarEm } }` em todos os casos de recusa **por unicidade** (RN11). O corpo não distingue "enviei" de "não enviei porque o número é de outro". Sem isso, o endpoint vira oráculo de enumeração de clientes.
- **Códigos de erro que *podem* ser distinguidos:** `400` telefone mal formado (é erro do próprio usuário sobre o próprio dado — não vaza nada), `429` teto excedido, `401` sem sessão, `502` falha do provedor.
- **Rate limit é verificado antes do envio e contado pela gravação** — a linha do desafio *é* o contador.
- **`nome` viaja junto** porque a tela é uma só: a pessoa preenche nome e telefone e pede o código de uma vez. Nome é gravado no perfil na hora, independentemente do desfecho da validação.

#### `POST /api/otp/validar` — `{ codigo, aceiteTermos, aceiteMarketing }`

- **Decisão:** a validação do código e o registro dos consentimentos acontecem no **mesmo** endpoint, dentro da mesma transação. **Motivo:** RN15 diz que o aceite é condição para concluir o cadastro. Endpoints separados abrem a janela de um cadastro concluído sem consentimento gravado — exatamente a lacuna que decidimos não deixar existir.
- **`aceiteTermos: false` é `400`**, não é um caminho de sucesso silencioso.
- **Idempotência:** repetir com código já usado devolve `410`, não sucesso. Código de uso único.
- **Contador de tentativas incrementa antes da comparação**, para que uma requisição abortada no meio não conceda tentativa grátis.
- **Comparação em tempo constante** (`timingSafeEqual`). O ganho prático contra uma rede é pequeno; o custo de fazer certo é uma linha.
- **Erros distinguíveis aqui:** `400` código errado (com tentativas restantes no corpo — a pessoa precisa saber), `410` expirado ou esgotado, `409` corrida perdida na unicidade do telefone.

#### `GET /api/auth/callback?code=…&proximo=…`

- **Decisão:** o `proximo` é validado como **caminho relativo interno** antes de qualquer redirect. **Motivo:** parâmetro de destino é o vetor clássico de open redirect — `?proximo=https://site-falso` transformaria nosso domínio em trampolim de phishing. Aceita apenas string começando com `/` e sem `//`.
- **Perfil criado aqui, não por trigger de banco.** Alternativa rejeitada: trigger `on auth.users insert`. Rejeitada porque o trigger roda fora do contexto da requisição, não enxerga o IP nem o `proximo`, e falha silenciosamente — a criação de perfil passaria a ser invisível para o teste de integração.
- **Roteamento por papel acontece no servidor** e ignora qualquer papel vindo do cliente.

---

## 4. Decisões de UI

### 4.1 Auditoria de Reuso

> O catálogo do projeto (`packages/ui`) hoje contém **apenas `tokens.css`** — nenhum componente. Esta spec é a primeira com UI, então a auditoria é atípica: quase tudo é "criar", mas criar **importando do shadcn/ui**, que é a biblioteca externa já adotada pela arquitetura §2.2. Não é invenção de componente — é a instalação do catálogo que a arquitetura mandou existir.

| Elemento | Decisão | Componente alvo | Justificativa |
|---|---|---|---|
| Botão primário / secundário / com carregamento | ✨ **CRIAR NOVO** (via shadcn) | `<Button>` | Catálogo vazio. Código-fonte do shadcn, sem customização além dos tokens. |
| Campo de texto (e-mail, nome, telefone) | ✨ **CRIAR NOVO** (via shadcn) | `<Input>` | Idem. |
| Rótulo de campo | ✨ **CRIAR NOVO** (via shadcn) | `<Label>` | Idem. Acessibilidade correta de saída de fábrica. |
| Caixa de aceite (termos, marketing) | ✨ **CRIAR NOVO** (via shadcn) | `<Checkbox>` | Idem. |
| Campo de 6 dígitos do código | ✨ **CRIAR NOVO** (via shadcn) | `<InputOTP>` | Componente dedicado do shadcn (`input-otp`): colar código, navegar entre casas e teclado numérico no celular já vêm resolvidos. Fazer à mão custa mais e acerta menos. |
| Recipiente das telas de auth | ✨ **CRIAR NOVO** (via shadcn) | `<Card>` | Idem. |
| Mensagem de sucesso / erro flutuante | ✨ **CRIAR NOVO** (via shadcn) | `<Toaster>` (sonner) | Arquitetura §4.4 exige Toast para info e sucesso, e proíbe `alert()`. |
| Moldura das duas telas de auth (logotipo + título + subtítulo + conteúdo centralizado) | ✨ **CRIAR NOVO** (pattern próprio) | `<AuthCard>` | Duas telas compartilham a mesma moldura. Repetir a composição em ambas é a "markup cru extenso" que a arquitetura §2.2.1 proíbe. |
| Ícones (Google, seta, escudo) | ♻️ **REUSAR** | `lucide-react` | Biblioteca declarada na arquitetura §2.2. |

**Sobre o aviso de qualidade do template** (">50% CRIAR NOVO indica catálogo incompleto"): aqui 100% é criar, e isso é o diagnóstico correto — o catálogo está de fato vazio. O que evita que isso vire componente caseiro é a origem: oito dos nove itens vêm do shadcn/ui, e o único autoral (`<AuthCard>`) é composição dos outros.

### 4.2 Composição

```
/entrar                                  /validar-telefone
┌────────────────────────────┐           ┌────────────────────────────┐
│         [ NAPO ]           │           │         [ NAPO ]           │
│                            │           │                            │
│  Entrar ou criar conta     │           │  Confirme seu WhatsApp     │
│  Sem senha. Sem cadastro   │           │  É por ele que a gente     │
│  longo.                    │           │  avisa quando sua pizza    │
│                            │           │  sai para entrega.         │
│  ┌──────────────────────┐  │           │                            │
│  │ E-mail               │  │           │  ┌──────────────────────┐  │
│  └──────────────────────┘  │           │  │ Seu nome             │  │
│  [ Receber link ]          │           │  └──────────────────────┘  │
│                            │           │  ┌──────────────────────┐  │
│  ──────── ou ────────      │           │  │ (61) 9 ____-____     │  │
│                            │           │  └──────────────────────┘  │
│  [ G  Entrar com Google ]  │           │  ☐ Li e aceito os termos   │
│                            │           │  ☐ Quero receber novidades │
│  Ao entrar você concorda   │           │  [ Enviar código ]         │
│  com os termos.            │           │        ↓ (após envio)      │
└────────────────────────────┘           │  ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐        │
                                         │  └─┘└─┘└─┘└─┘└─┘└─┘        │
                                         │  Reenviar em 0:47          │
                                         │  [ Confirmar ]  Trocar nº  │
                                         └────────────────────────────┘
```

`/validar-telefone` é **uma tela em dois passos**, não duas telas: trocar de URL entre pedir e conferir o código quebraria o botão voltar e perderia o contador de reenvio.

### 4.3 Estados visuais

| Região | default | loading | error | success |
|---|---|---|---|---|
| Form de e-mail (`/entrar`) | campo vazio, botão ativo | botão "Enviando…" + desabilitado | erro embaixo do campo | card troca por _"Link enviado para **você@email.com**. Confira sua caixa de entrada."_ + opção de reenviar |
| Botão do Google | ícone + "Entrar com Google" | desabilitado com spinner | toast: _"Não foi possível entrar com o Google. Tente de novo."_ | redireciona |
| Passo 1 (nome + telefone) | campos vazios, aceite desmarcado, botão **desabilitado** até o aceite | "Enviando código…" | erro inline por campo | avança para o passo 2 |
| Passo 2 (código) | 6 casas vazias, foco na primeira, contador correndo | "Confirmando…" | casas em vermelho + _"Código incorreto. Restam N tentativas."_ | toast de sucesso + redireciona ao destino |
| Reenvio | link ativo | — | toast de teto: _"Limite de envios atingido. Tente de novo amanhã ou fale com a gente pelo WhatsApp da loja."_ | contador reinicia em 60s |

**Microcopy literal de recusa por unicidade** (RN11): _"Não foi possível validar este número nesta conta. Se ele já é seu em outro cadastro, entre por aquele ou fale com a gente."_ — mesma string usada para número de terceiro e para outras recusas não atribuíveis ao formato, de propósito.

### 4.4 Preview Visual Aprovado

#### 4.4.1 Arquivo de preview

- Caminho: [`./preview.html`](./preview.html)
- **Modelo:** Único — duas telas compartilham a mesma moldura (`<AuthCard>`), então os cinco estados vivem em seções ancoradas do mesmo arquivo.
- **Mecanismo:** HTML standalone + Tailwind v4 via CDN + `@theme` espelhando `packages/ui/src/tokens.css` (linha 1 da matriz — projeto React/Next + Tailwind). As classes migram praticamente 1:1 para o JSX.
- **Aprovado por:** Hudson em 2026-08-11.
- **Estados cobertos:** `/entrar` inicial · `/entrar` link enviado · `/validar-telefone` passo 1 · passo 2 · código incorreto · toast de teto diário.

> O arquivo contém um andaime de revisão (barra de navegação superior e molduras de 420px lado a lado) que **não faz parte do produto** — está marcado como tal no próprio HTML. No produto cada tela ocupa a página inteira, centralizada.

#### 4.4.2 Componentes do catálogo usados

| Elemento da tela | Componente | Origem | Decisão (§4.1) |
|---|---|---|---|
| Moldura das duas telas (marca + título + subtítulo + conteúdo) | `<AuthCard>` | pattern próprio em `packages/ui/src/patterns/` | ✨ CRIAR NOVO |
| Recipiente visual da moldura | `<Card>` | shadcn em `packages/ui/src/components/` | ✨ CRIAR NOVO (via shadcn) |
| "Receber link", "Confirmar", "Enviar código" | `<Button>` (primária, amarelo) | shadcn | ✨ CRIAR NOVO (via shadcn) |
| "Entrar com Google", "Reenviar em 0:52" | `<Button variant="outline">` | shadcn | ✨ CRIAR NOVO (via shadcn) |
| "Usar outro e-mail" | `<Button variant="ghost">` | shadcn | ✨ CRIAR NOVO (via shadcn) |
| "Trocar número", "Reenviar código" | `<Button variant="link">` | shadcn | ✨ CRIAR NOVO (via shadcn) |
| Campos de e-mail, nome e celular | `<Input>` | shadcn | ✨ CRIAR NOVO (via shadcn) |
| Rótulos dos campos | `<Label>` | shadcn | ✨ CRIAR NOVO (via shadcn) |
| Aceite dos termos e opt-in de marketing | `<Checkbox>` | shadcn | ✨ CRIAR NOVO (via shadcn) |
| As 6 casas do código | `<InputOTP>` + `<InputOTPGroup>` + `<InputOTPSlot>` | shadcn (`input-otp`) | ✨ CRIAR NOVO (via shadcn) |
| Toast de teto diário e de falha do Google | `<Toaster>` + `toast()` | shadcn (`sonner`) | ✨ CRIAR NOVO (via shadcn) |
| Ícones de envelope, alerta e erro | `MailCheck`, `TriangleAlert`, `CircleAlert` | `lucide-react` | ♻️ REUSAR |
| Logotipo do Google | SVG inline | marca de terceiro — não existe em `lucide` | ✨ CRIAR NOVO (asset) |
| Logotipo da Napo na moldura | `<Marca>` | `packages/ui/src/components/` | ✨ CRIAR NOVO — **acrescentado no Gate Visual B**, ver [`drift.md`](./drift.md) D1 |

#### 4.4.3 Componentes novos a criar (com justificativa)

| Componente novo | Caminho destino | Por que existentes não servem |
|---|---|---|
| `<AuthCard>` | `packages/ui/src/patterns/auth-card.tsx` | Composição repetida em duas telas e cinco estados: marca, título, subtítulo e slot centralizado. Deixar solto seria replicar a mesma composição em cada página — o "markup cru extenso" que a arquitetura §2.2.1 proíbe. Compõe `<Card>`; não reinventa nada. |
| `<Marca>` | `packages/ui/src/components/marca.tsx` | O logotipo aparece nas duas telas e vai aparecer em todas as do NAPO-003. Caminho de arquivo digitado à mão em cada uso torna a troca de arte uma caçada; o componente concentra a decisão de variante (fundo escuro/claro) num lugar só. Acrescentado no Gate Visual B — ver [`drift.md`](./drift.md) D1. |
| 7 primitivos shadcn | `packages/ui/src/components/` | O catálogo está vazio — esta é a spec que o inaugura, conforme decisão do PM na Fase 0.5. É instalação de biblioteca externa já adotada pela arquitetura §2.2, não componente autoral. |

#### 4.4.4 Markup cru aceito

- Centralização da página: `<div className="min-h-dvh grid place-items-center px-4">` — layout puro do nível mais externo.
- Empilhamento interno dos formulários: `space-y-*` entre primitivos.
- Divisor "ou" da tela `/entrar`: duas linhas com um rótulo entre elas — três elementos sem estado nem lógica.

Qualquer outro markup solto fora desta lista é violação no audit do `/implementar`.

#### 4.4.5 Critérios visuais de aceite

Ver a seção **"Critérios visuais de aceite"** em [`tests.md`](./tests.md) — verificados no Gate Visual B.

### 4.5 Decisões de UX não-óbvias

- **Aceite dos termos no passo 1, não no passo 2.** Consentir *antes* de receber a mensagem deixa o passo 2 com uma decisão só (digitar o código). Consentir depois transformaria o momento de maior ansiedade do fluxo — "meu código não chegou" — em formulário.
- **Botão desabilitado até o aceite, em vez de erro após o clique.** O aceite é binário e visível; deixar clicar para depois reclamar é fricção sem informação nova.
- **O contador de reenvio aparece sempre**, mesmo antes de esgotar. Sem ele a pessoa clica em reenviar três vezes em dez segundos, queima o teto diário e ainda acha que o site está quebrado.
- **"Trocar número" é um link discreto, não um botão.** É o caminho de exceção; competir visualmente com "Confirmar" faria gente sair do fluxo certo.
- **Tentativas restantes são ditas em voz alta.** Esconder quantas restam não protege nada (o atacante conta sozinho) e desorienta quem está errando de boa-fé.
- **Erro de envio não expõe o motivo técnico.** Número sem WhatsApp, template não aprovado e Meta fora do ar produzem a mesma frase, com o motivo real no log — e "número sem WhatsApp" é justamente o que não podemos confirmar sem virar oráculo.

### 4.6 Responsividade

| Breakpoint | Decisão |
|---|---|
| < 640px | Card ocupa a largura com margem de 16px e sem sombra — em tela pequena a sombra sugere modal e induz a procurar o "fechar". Teclado numérico no campo do código (`inputMode="numeric"`). |

---

## 5. Decisões Técnicas Gerais

- **Decisão: `/entrar` e `/validar-telefone` moram no grupo `(conta)`; o guarda vive no layout do segmento `conta/`, não no layout do grupo.**
  **Alternativa rejeitada:** criar um quinto grupo de rota `(auth)`.
  **Motivo:** a arquitetura §3.1 fixa quatro grupos, e grupo de rota não aparece na URL — inventar um quinto seria divergir da arquitetura por estética de pasta. Pendurar o guarda no segmento em vez do grupo resolve o conflito real (as telas de auth não podem exigir o que estão construindo).

- **Decisão: middleware verifica apenas sessão; papel e telefone são verificados no layout de servidor.**
  **Alternativa rejeitada:** injetar `role` e `telefone_validado_em` no JWT via *custom access token hook*.
  **Motivo:** claim no token fica velho até o refresh (1h). Alguém que acabou de validar o telefone continuaria barrado — o pior momento possível para o sistema mentir. O layout já consulta o banco e o Next deduplica a consulta dentro do mesmo render. Custo aceito: uma consulta por navegação protegida, não por navegação.

- **Decisão: código guardado como HMAC-SHA256 com pepper em variável de ambiente.**
  **Alternativa rejeitada:** bcrypt via `pgcrypto` (`crypt()` + `gen_salt('bf')`).
  **Motivo:** o espaço de busca é de 10⁶ — pequeno demais para uma KDF resolver. Contra um dump de banco, bcrypt(8) sobre um milhão de candidatos é força bruta viável; HMAC com segredo que **não está no banco** é inquebrável sem também comprometer o ambiente da aplicação. Trocamos custo de CPU por separação de segredo, que é o que de fato protege aqui.

- **Decisão: rate limit por consulta em `telefone_verificacoes`, sem Redis.**
  **Alternativa rejeitada:** Upstash ou similar.
  **Motivo:** a operação faz 303 pedidos/mês. Uma dependência externa paga, com chave para rotacionar e indisponibilidade própria, para contar cinco linhas — desproporcional. Gatilho para reabrir: se a contagem virar gargalo mensurável ou se o volume passar de ~10 mil envios/mês.

- **Decisão: envio do WhatsApp por trás de uma interface com seleção por variável de ambiente, com dois adaptadores no R1 (`fake` e `meta`) e um terceiro previsto mas não escrito (`bsp`).**
  **Alternativa rejeitada:** escrever o adaptador de BSP agora, em paralelo.
  **Motivo:** o PM priorizou fazer o canal oficial funcionar. Escrever um segundo adaptador contra um provedor ainda não contratado é código não exercitado — pior que ausência. O que a spec garante é que ele **caiba**: a interface é `enviarCodigo(telefone, codigo)` e nada acima dela sabe qual provedor respondeu.

- **Decisão: perfil criado no callback, com `upsert` idempotente.**
  **Alternativa rejeitada:** trigger `on auth.users` no banco.
  **Motivo:** ver §3.1. Some-se: o trigger tornaria a criação de perfil invisível para quem lê o código do fluxo de login.

- **Decisão: o override de admin e a promoção de papel são funções `SECURITY DEFINER` no banco; o script é um invólucro fino.**
  **Alternativa rejeitada:** lógica dentro do script Node com `service_role`.
  **Motivo:** foi o que prometemos ao PM — a tela do NAPO-008 chama a *mesma* função, não reimplementa a regra. A auditoria fica atômica com a alteração, dentro da transação. Ambas exigem `is_admin()` **ou** `service_role`, e `motivo` é obrigatório em qualquer caminho.

- **Decisão: `service_role` isolada em `src/lib/supabase/admin.ts` com `import 'server-only'` no topo.**
  **Motivo:** a arquitetura §5.1 proíbe a chave no browser, e a validação de ambiente já separa público de servidor. `server-only` transforma um import equivocado em **erro de build**, não em vazamento em produção. É a diferença entre uma regra escrita e uma regra que se defende sozinha.

- **Decisão: erro operacional vai para log estruturado no servidor.**
  **Motivo:** o Sentry está na arquitetura mas ainda não foi instalado. O ponto de captura fica centralizado numa função só, para que instalá-lo depois seja uma mudança de uma linha em um arquivo.

---

## 6. Dependências Novas

### 6.1 Bibliotecas

| Pacote | Onde | Por quê |
|---|---|---|
| `tailwindcss@^4` + `@tailwindcss/postcss` + `postcss` | `apps/web` | Engine de estilo declarada na arquitetura §2.2. |
| `@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-checkbox` | `packages/ui` | Primitivos que o shadcn/ui usa por baixo. |
| `class-variance-authority`, `clsx`, `tailwind-merge` | `packages/ui` | Exigidos pelo código do shadcn/ui. |
| `input-otp` | `packages/ui` | Base do `<InputOTP>`. |
| `sonner` | `packages/ui` | Base do `<Toaster>`. |
| `lucide-react` | `packages/ui` | Ícones — arquitetura §2.2. |

Nenhuma dependência nova de backend: `crypto` é nativo do Node e o envio ao WhatsApp usa `fetch`.

### 6.2 Variáveis de ambiente

| Variável | Escopo | Propósito |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | público | Base do link de retorno do Magic Link e do OAuth. |
| `OTP_PEPPER` | servidor | Segredo do HMAC do código. **Obrigatória.** Trocá-la invalida os desafios em voo — aceitável, eles duram 10 min. |
| `WHATSAPP_PROVIDER` | servidor | `fake` ou `meta`. Default `fake`; produção exige `meta` (RN16). |
| `WHATSAPP_PHONE_NUMBER_ID` | servidor | Só quando `meta`. |
| `WHATSAPP_ACCESS_TOKEN` | servidor | Só quando `meta`. |
| `WHATSAPP_TEMPLATE_NAME` | servidor | Nome do template aprovado. Só quando `meta`. |
| `WHATSAPP_TEMPLATE_LANG` | servidor | Ex.: `pt_BR`. Só quando `meta`. |
| `SUPABASE_AUTH_GOOGLE_CLIENT_ID` / `_SECRET` | servidor | Consumidas pelo `config.toml`. |

A validação em `env.ts` é **condicional**: com `WHATSAPP_PROVIDER=meta`, as quatro variáveis da Meta passam a ser obrigatórias e a aplicação não sobe sem elas. Provedor mal configurado precisa quebrar no boot, não na primeira pessoa que tentar se cadastrar.

### 6.3 Integrações externas

- **WhatsApp Cloud API (Meta)** — `POST /{phone-number-id}/messages`, template de categoria *authentication*, autenticação por token de acesso. **Cobrança por mensagem entregue**, sem faixa gratuita. Timeout de 8s e uma retentativa; falha vira `502` com mensagem genérica. **Risco de elegibilidade tratado em §8.**
- **Google OAuth** — via Supabase Auth. Não funciona no ambiente local sem credencial real (arquitetura §6.1); o teste de ponta a ponta do Google fica para staging, e o local exercita Magic Link pela caixa de entrada falsa.

---

## 7. Plano de Blocos

- [ ] **Bloco A — Núcleo puro:** `packages/core/src/telefone/*`, `packages/core/src/otp/*`, barrels · cobre **T9-T14** · sem dependência.
- [ ] **Bloco B — Banco:** migrations 0006 a 0009, testes pgTAP, `seed.sql`, `config.toml` · cobre **T26, T27, T29, T32-T35, T44** · paralelo a A (mapas disjuntos).
- [ ] **Bloco C — Base de UI:** Tailwind, `postcss.config.mjs`, `globals.css`, tokens, primitivos shadcn, `<AuthCard>`, `layout.tsx` · cobre **T39-T41 e os 7 critérios visuais** · paralelo a A e B.
- [ ] **Bloco D — Fluxo de login:** `middleware.ts`, callback, `sair`, `sessao.ts`, `destino.ts`, guardas de layout, `/entrar` · cobre **T1, T2, T4-T8, T21-T23, T25, T28, T31, T38** · depende de B e C.
- [ ] **Bloco E — Gate de telefone:** remetentes, `/api/otp/*`, `verificacao.ts`, `consentimento.ts`, `/validar-telefone` · cobre **T3, T15-T20, T24, T30, T36, T37, T42, T43, T45, T46** · depende de A, B, D.
- [ ] **Bloco F — Ferramentas de admin:** `scripts/admin.mjs`, `.env.example` · exercita as funções já provadas em T32-T35 pela linha de comando · depende de B.

```
A ─┐
B ─┼→ D → E
C ─┘   ↑   ↑
       └───┘
B ────────→ F
```

A, B e C são paralelizáveis entre si — mapas de impacto disjuntos.

---

## 8. Riscos Conhecidos

- **Risco: a Meta pode não liberar template de autenticação para a Napo** (elegibilidade por volume — `spec.md` §7).
  **Mitigação:** interface de envio trocável; override de admin cobre o caso individual; NAPO-017 sobe de prioridade para descobrir cedo.
  **Gatilho de revisão:** resposta da Meta. Se negativa, reabrir a decisão de canal antes do NAPO-006 — o checkout não sobe sem o gate.

- **Risco: custo por mensagem sem faixa gratuita** — abuso do endpoint de envio vira conta a pagar.
  **Mitigação:** tetos da RN7 aplicados **antes** do envio, por número e por IP.
  **Gatilho:** qualquer mês com mais de 3× o número de envios em relação a cadastros concluídos.

- **Risco: rate limit por IP pune usuário legítimo atrás de NAT** (rede de escritório, operadora móvel).
  **Mitigação:** o teto por IP (10) é o dobro do teto por número (5), e o override de admin existe.
  **Gatilho:** primeiro relato de bloqueio indevido.

- **Risco: a base de UI nasce aqui e vira dívida do NAPO-003 se for mal calibrada.**
  **Mitigação:** só entram os primitivos que estas duas telas usam, todos com código do shadcn/ui sem customização além dos tokens. Nenhum componente autoral além do `<AuthCard>`.
  **Gatilho:** revisão obrigatória no início do NAPO-003.

- **Risco: `SECURITY DEFINER` mal escrita vira escalada de privilégio.**
  **Mitigação:** `search_path` fixo nas duas funções (mesmo padrão do `is_admin()` do NAPO-001) e teste pgTAP provando que não-admin recebe recusa.
  **Gatilho:** qualquer função nova com `SECURITY DEFINER` no projeto.
