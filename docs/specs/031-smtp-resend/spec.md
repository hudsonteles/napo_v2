# 📋 Spec (lite): SMTP próprio da Napo pelo Resend

**ID:** NAPO-031
**Status:** Aprovado
**Tipo:** `lite`
**Responsável:** Hudson (PM) · agente implementador
**Data:** 2026-09-06
**Item no Roadmap:** NAPO-031

> 📌 **Spec leve (1 arquivo)** — combina regras de negócio, design técnico e critérios de teste.
> **Modalidade decidida na Fase 0.5 (2026-09-06):** lite. Um domínio (configuração de
> runtime + contrato de env), sem schema, sem UI, sem alteração de regra de autenticação,
> reversão por variável de ambiente.

---

## 1. Visão Geral (User Story)

> **Como** dono do produto, **eu quero** que o e-mail que carrega o link de acesso à conta
> saia pelo servidor da própria Napo também no ambiente de desenvolvimento, **para que** a
> integração que eu levar para homologação seja a mesma que eu já vi funcionar na minha máquina.

O Magic Link **é** o login. Até aqui ele só existia dentro do inbox falso do ambiente local —
o que é ótimo para desenvolver e inútil para saber se o e-mail sai, chega e não cai em spam.
Este item constrói a ponte entre o GoTrue local e o Resend, sem tirar o inbox falso do caminho
de quem não quer enviar de verdade.

**O que mudou de premissa (2026-09-06):** a divisão original deste item concluiu que "não há
código a versionar", partindo de que o ambiente local continuaria no inbox falso. O PM inverteu
essa premissa. O item voltou a ter código, e é este spec.

---

## 2. Regras de Negócio + Cenários de Teste

- **RN1:** O ambiente local **nasce no inbox falso**. Quem clona o repositório e roda `pnpm db:start`
  sem nenhuma credencial de e-mail sobe o banco e recebe Magic Link no inbox falso, como hoje.

  ```gherkin
  Scenario: Clone novo sobe sem credencial de e-mail
    Given que não existe o arquivo "supabase/.env"
    When eu rodo "pnpm db:start"
    Then o stack sobe sem erro
    And o Magic Link solicitado na tela de entrar aparece no inbox falso
  ```

- **RN2:** O envio real liga **por variável de ambiente**, nunca por edição de arquivo versionado
  (`ARCHITECTURE.md` §6.1, Regra de Ouro).

  ```gherkin
  Scenario: Ligar o envio real sem tocar em código
    Given que "supabase/.env" declara as credenciais SMTP do Resend
    When eu rodo "pnpm db:start"
    Then o Magic Link é entregue pelo Resend na caixa real do endereço informado
    And nenhum arquivo versionado precisou ser editado para isso
  ```

- **RN3:** A senha SMTP **nunca entra no Git**. Ela chega ao processo da CLI pelo `supabase/.env`,
  pelo caminho que o NAPO-002 já construiu — host, porta e usuário não são segredo e ficam
  literais no arquivo versionado.

  ```gherkin
  Scenario: O segredo não é versionável
    Given que "supabase/.env" contém a API key do Resend
    When eu rodo "git status --short"
    Then "supabase/.env" não aparece como arquivo novo nem modificado
  ```

- **RN4:** Credencial ausente com o envio real ligado falha **barulhento no boot**, nunca em
  silêncio. Magic Link que não chega sem ninguém avisar é o pior desfecho possível: some sem
  erro e o diagnóstico começa pelo lado errado.

  ```gherkin
  Scenario: Envio real ligado pela metade
    Given que "supabase/.env" pede o Resend mas não traz a API key
    When eu rodo "pnpm db:start"
    Then a subida falha com mensagem dizendo qual variável falta
  ```

- **RN5:** O CI sobe o banco **sem credencial de SMTP e sem quebrar** — ele não exercita envio
  de e-mail e não pode deixar de rodar por causa de um canal que não usa.

  ```gherkin
  Scenario: CI sem segredo de e-mail
    Given que o runner do CI não tem "supabase/.env"
    When o job roda "pnpm db:start"
    Then o stack sobe e a suíte de testes executa normalmente
  ```

- **RN6:** O remetente do e-mail de acesso à conta é **`acesso@napobsb.com.br`**, distinto do
  `pedido@napobsb.com.br` usado para e-mail de pedido. Quem recebe um link para entrar na conta
  não pediu nada — remetente chamado "pedido" contradiz a mensagem.

  ```gherkin
  Scenario: Remetente do e-mail de acesso
    Given que o envio real está ligado
    When eu solicito um Magic Link
    Then o e-mail recebido tem remetente "acesso@napobsb.com.br"
  ```

---

## 3. Não-Objetivos (Fora do Escopo)

- **Não configura os painéis de staging e produção.** Staging é NAPO-034; produção é NAPO-021.
  Projeto remoto se configura por painel, e esses projetos ainda não existem.
- **Não escreve template, HTML nem copy de e-mail.** O Magic Link continua chegando com o texto
  padrão do GoTrue, em inglês. Quem resolve isso é o NAPO-033.
- **Não manda e-mail de boas-vindas nem de pedido.** Também NAPO-033 e a ideia "E-mail
  transacional de pedido".
- **Não trava destinatário em desenvolvimento.** Foi avaliado e **descartado pelo PM em
  2026-09-06**: com o envio real ligado, digitar o endereço de um cliente real na tela de entrar
  manda um link de acesso para essa pessoa — e Magic Link é credencial: quem recebe, entra. O PM
  assume o cuidado ao digitar. Registrado aqui para não voltar como scope creep, e para que o
  risco esteja no papel.
- **Não migra a CLI do Supabase para 2.x.** Existe ideia própria em 💡 para isso, e ela só entra
  aqui se o risco R1 abaixo se confirmar sem saída na 1.x.

---

## 4. Implementação

### 4.1 Mapa de Impacto (arquivos a tocar)

| Arquivo / Módulo | Ação | Risco | Justificativa |
|---|---|---|---|
| `supabase/config.toml` | Modificar | Médio | bloco `[auth.email.smtp]` e, se o caminho escolhido exigir, `smtp_port` do `[inbucket]` |
| `scripts/supabase.mjs` | Modificar | Baixo | as chaves novas entram no repasse para a CLI, com valor default apontando ao inbox falso |
| `supabase/.env.example` | Modificar | Baixo | documenta as variáveis novas e como obter a API key |
| `.env.example` | Modificar | Baixo | referência cruzada — quem procura variável de e-mail começa por aqui |
| `scripts/supabase.test.mjs` *(ou suíte equivalente)* | Criar | Baixo | RN1, RN4 e RN5 são comportamento do wrapper e precisam de teste executável |

> ⚠️ Antes de tocar **qualquer** arquivo fora desta tabela: PARE e consulte o humano
> (regra inegociável `AGENTS.md` §2.6).

**Fora do mapa, com aprovação prévia do PM (2026-09-06):** `ARCHITECTURE.md` §2.1 e §6.1 —
diffs apresentados e aprovados na FASE 5 deste fluxo, commitados junto.

### 4.2 Decisões técnicas

- **Decisão:** o interruptor mora nos **valores** vindos de `supabase/.env`, não na presença do
  bloco no `config.toml`. **Motivo:** bloco que aparece e some exigiria editar arquivo versionado
  para trocar de ambiente — proibido pela Regra de Ouro do §6.1. Com o interruptor nos valores,
  o `config.toml` é o mesmo em qualquer máquina.

- **Decisão:** `scripts/supabase.mjs` ganha **default por chave**, em vez do marcador único
  `ausente-neste-ambiente` que hoje serve ao Google. **Motivo:** o marcador atual existe para
  deixar o provedor subir inoperante, o que é aceitável para login social e inaceitável para
  e-mail — host inválido faria o Magic Link falhar num clone limpo, quebrando a RN1. O default
  das chaves de SMTP aponta para o inbox falso.

- **Decisão:** host, porta e usuário ficam **literais** no `config.toml`; só `pass` usa `env()`.
  **Motivo:** `smtp.resend.com`, `465` e `resend` não são segredo ([docs do Resend](https://resend.com/docs/send-with-smtp)),
  e o exemplo que a própria CLI traz comentado usa `env()` exatamente e apenas no campo da senha —
  é o campo com suporte comprovado.

- **Decisão:** o teste da RN1/RN4/RN5 exercita o **wrapper**, não a entrega de e-mail.
  **Motivo:** e-mail que sai de verdade não cabe em suíte automatizada (rede, cota, caixa real).
  O que é testável é o contrato do wrapper: quais variáveis ele repassa e o que faz quando faltam.
  A entrega real é verificada à mão, uma vez, e é o critério de aceite do item.

### 4.3 Dependências técnicas

- **Bibliotecas novas:** nenhuma.
- **Env vars novas:** `RESEND_SMTP_PASS` (a API key do Resend, em `supabase/.env`, servidor apenas).
  Demais parâmetros são literais no `config.toml`. Nomes finais confirmados no bloco 1.
- **Reuso de UI / componentes:** não se aplica — a spec não toca UI.
- **Integrações externas:** Resend (SMTP), domínio `napobsb.com.br` verificado com MX, DKIM e SPF
  publicados no Registro.br conforme [`docs/napo-031-resend-smtp.md`](../../napo-031-resend-smtp.md).

### 4.4 Preview Visual Aprovado

*Não se aplica — o Mapa §4.1 não contém arquivo de UI. Gate Visual A dispensado.*

### 4.5 Riscos conhecidos

- **R1 — `env()` pode não ser expandido em todos os campos do bloco.** O
  [issue #3255 da CLI](https://github.com/supabase/cli/issues/3255) relata `env()` chegando
  literal ao campo `host` (`dial tcp: lookup env(SUPABASE_SMTP_HOST): no such host`). A decisão
  de manter host/porta/usuário literais já contorna o caso relatado, mas **não está verificado
  na nossa versão (1.226.4)**. **Bloco 1 do `/implementar` resolve isso antes de qualquer outra
  coisa** (decisão do PM, 2026-09-06). Se nem o campo `pass` expandir, o item entra em
  `drift.md` com duas saídas para o PM: subir a CLI para 2.x (já existe ideia em 💡) ou aceitar
  o Resend como canal único do ambiente local.
  > Esse mesmo issue é a evidência que derruba a [discussão #27054](https://github.com/orgs/supabase/discussions/27054),
  > que afirma que a CLI ignora `[auth.email.smtp]` localmente: o log mostra o stack local
  > **discando** o SMTP. Não se disca um servidor que se ignora.

- **R2 — cota do plano gratuito.** 100 e-mails por dia. Iterar no login com o envio real ligado
  consome cota real. É por isso que a RN1 mantém o inbox falso como padrão: o envio real é para
  validar a integração, não para desenvolver.

- **R3 — o domínio precisa estar `Verified` no Resend antes do primeiro envio.** Enquanto não
  estiver, o Resend só aceita enviar para o endereço da própria conta. Propagação de DNS não é
  instantânea e é a única espera externa do item.

---

## 5. Dependências de Negócio

- NAPO-031 parte A — conta no Resend, domínio verificado e DNS publicado ⏳
  (PM confirmou em 2026-09-06 ter conta e acesso ao DNS; falta o domínio em `Verified`)

**Este item bloqueia:** NAPO-033, NAPO-032 (canal de reserva do OTP), NAPO-034.

---

## 6. Aprovação

- [x] **Spec lite revisado e aprovado por:** Hudson / 2026-09-06
- [ ] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP — feito pelo `/implementar`)
- [ ] **Implementado e concluído em:** [YYYY-MM-DD]
