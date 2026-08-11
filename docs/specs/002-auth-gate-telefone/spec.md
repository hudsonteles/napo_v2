# 📋 Spec: Autenticação, papéis e gate de telefone por WhatsApp

**ID:** NAPO-002
**Status:** Concluído
**Responsável:** Hudson
**Data:** 2026-08-11
**Item no Roadmap:** NAPO-002

> 📌 Este documento define o **O QUÊ** e o **POR QUÊ** (regras de negócio).
> Para detalhes técnicos veja `design.md`. Para validação veja `tests.md`.
> Dono primário: **PM / Product Owner**.

---

## 1. Visão Geral (User Stories)

> **Como** cliente, **eu quero** entrar com um clique no e-mail ou com minha conta Google, **para que** eu não precise inventar e lembrar mais uma senha para comprar pizza.

> **Como** dono do negócio, **eu quero** que todo cliente tenha um telefone comprovadamente dele antes de comprar, **para que** o entregador consiga chegar na porta certa e para que a base sirva de canal de venda depois — não uma lista de números digitados errado.

> **Como** funcionário, **eu quero** entrar com o mesmo login do cliente e cair direto na tela do meu trabalho, **para que** não exista um segundo sistema de acesso para manter.

> **Como** dono do negócio, **eu quero** que ninguém consiga se promover a gerente pelo próprio navegador, **para que** o painel com custo, margem e estoque continue sendo meu.

**O que esta spec realmente entrega não é a tela de login — é a fronteira do sistema.** Toda spec seguinte que tenha dado de cliente (NAPO-006 checkout, NAPO-007 conta, NAPO-008 admin) assume que existe um usuário identificado, com papel conhecido e telefone comprovado. Essa premissa nasce aqui.

---

## 2. Objetivos de Negócio (KPIs)

- [ ] **≥ 85% dos logins concluem a validação de telefone na mesma sessão.** Abaixo disso, o gate está custando mais conversão do que entrega em qualidade de base.
- [ ] **≤ 2% dos cadastros precisam de override manual do admin.** Acima disso, o canal de envio está falhando e a decisão de não ter fallback precisa ser reaberta.
- [ ] **Zero contas com papel elevado sem registro em auditoria.** Toda promoção a atendente, cozinha, gerente ou admin tem autor, data e valor anterior gravados.
- [ ] **Zero telefones duplicados entre contas validadas.** Duplicata é sintoma de que a unicidade vazou — e é o que quebra o marketing por WhatsApp depois.

---

## 3. Regras de Negócio Obrigatórias

### Acesso e sessão

- **RN1 — Navegação pública é livre.** Home, catálogo, preços e páginas legais não exigem sessão. Isso é exigência de SEO e de conversão: o Google não faz login, e o visitante que precisa se cadastrar para ver preço vai embora.
- **RN2 — Sessão é exigida em três lugares:** a área da conta, o painel administrativo e o início do checkout. Fora deles, ninguém é interrompido.
- **RN3 — Cliente sem telefone validado não passa das rotas protegidas.** Quem tem papel `cliente` e ainda não validou é levado para a tela de validação e fica lá até concluir — ou até sair.
- **RN4 — A equipe não é barrada pelo gate de telefone.** Papéis `atendente`, `cozinha`, `gerente` e `admin` acessam suas telas logo após o login. **Exceção:** o checkout exige telefone validado de qualquer pessoa, inclusive da equipe — ali o telefone não é controle de acesso, é o número que o entregador vai ligar.
- **RN5 — Cada papel tem um destino após o login.** `cliente` vai para a conta (ou para onde tentava ir), `cozinha` e `atendente` para a fila de produção, `gerente` e `admin` para o painel. O destino é decidido pelo servidor, nunca por parâmetro na URL.

### Validação de telefone

- **RN6 — O código tem 6 dígitos, é gravado apenas como hash, expira em 10 minutos e aceita no máximo 5 tentativas.** Esgotadas as tentativas, o código morre e é preciso pedir outro. O código nunca é gravado em texto puro, nunca aparece em log e nunca volta numa resposta de API.
- **RN7 — Reenvio só depois de 60 segundos.** Além disso, no máximo 5 envios por número e 10 por endereço de IP a cada 24 horas, em janela deslizante. Cada mensagem enviada é dinheiro pago à Meta — sem esse teto, um script transforma o cadastro em conta a pagar.
- **RN8 — O telefone é normalizado em E.164 e precisa ser um celular brasileiro válido:** DDD existente e nono dígito presente. Fixo, DDD inventado ou número curto são recusados antes de qualquer envio.
- **RN9 — Um telefone validado pertence a uma única conta.** Dois cadastros não terminam com o mesmo número validado.
- **RN10 — Trocar o telefone zera a validação.** Ao informar um número diferente, a conta volta ao estado não validado e o número anterior fica livre para outra conta usar. Não existe "dois números válidos ao mesmo tempo".
- **RN11 — Nenhuma mensagem revela que um telefone já pertence a outra conta.** A recusa é genérica e orienta a procurar a loja. Confirmar a existência de um cadastro permite descobrir, um número por vez, quem é cliente da casa.

### Papéis e privilégio

- **RN12 — Ninguém altera o próprio papel.** Regra herdada do NAPO-001 e reafirmada aqui: a proibição vive no banco, não na aplicação. Promoção só acontece por processo de servidor confiável.
- **RN13 — Todo cliente nasce como `cliente`.** Não existe caminho de auto-cadastro que produza outro papel.
- **RN14 — Admin pode marcar um telefone como validado manualmente, e todo override é auditado** com autor, alvo, número, motivo e data. É a única mitigação existente para a falha de envio, já que não há canal alternativo.

### Consentimento e canal

- **RN15 — O aceite dos termos e da política de privacidade é obrigatório para concluir o cadastro** e é registrado com a versão aceita, a data e o IP. O consentimento de marketing é separado, opcional e desmarcado por padrão — consentimento embutido em outro aceite não é consentimento livre.
- **RN16 — O canal de envio troca por variável de ambiente, nunca por alteração de código.** Em desenvolvimento e staging o código é entregue por um remetente falso; em produção, pela API oficial do WhatsApp.

---

## 4. Fluxos de Exceção (Tratamento de Erros)

| Cenário | Ação do usuário | Resposta do sistema |
|---|---|---|
| Telefone mal formado | Informa fixo, DDD inexistente ou número curto | Erro no próprio campo, antes de qualquer envio: _"Informe um celular com DDD, como (61) 99999-9999."_ |
| Código errado | Digita código incorreto | Campo destacado + contador honesto: _"Código incorreto. Restam 3 tentativas."_ |
| Tentativas esgotadas | Erra 5 vezes | Código invalidado. _"Muitas tentativas. Peça um novo código."_ O botão de reenvio fica disponível. |
| Código expirado | Digita depois de 10 min | _"Este código expirou. Peça um novo."_ |
| Reenvio cedo demais | Clica em reenviar antes de 60s | Botão desabilitado com contagem visível. Nenhuma chamada sai. |
| Teto diário estourado | Excede 5 envios no número ou 10 no IP | _"Limite de envios atingido. Tente de novo amanhã ou fale com a gente pelo WhatsApp da loja."_ |
| Telefone de outra conta | Informa número já validado por terceiro | Recusa genérica, **sem confirmar existência**: _"Não foi possível validar este número nesta conta. Se ele já é seu em outro cadastro, entre por aquele ou fale com a gente."_ Tentativa registrada. |
| Envio falha na origem | Meta fora do ar, número sem WhatsApp, template não aprovado | _"Não conseguimos enviar agora. Tente novamente em alguns minutos ou fale com a gente pelo WhatsApp da loja."_ Erro real no log do servidor, nunca na tela. |
| Link de e-mail expirado ou já usado | Clica num Magic Link velho | Volta para a tela de entrar com _"Este link expirou. Peça outro."_ |
| Google recusado | Cancela o consentimento no Google | Volta para a tela de entrar sem mensagem de erro — cancelar não é falha. |
| Sessão expirada no meio do fluxo | Fica parado e submete | Redireciona para entrar, preservando o destino pretendido. |
| Rota protegida sem sessão | Acessa `/conta` deslogado | Redireciona para entrar e, após o login, leva ao destino original — nunca joga na home. |
| Cliente validado tenta o admin | Acessa `/admin` com papel `cliente` | Tela de acesso negado. **Não** redireciona para o login: já está logado, e disfarçar de "não autenticado" confunde. |

---

## 5. Não-Objetivos (Fora do Escopo)

- **Senha.** Não existe cadastro nem login por senha, agora nem depois — Magic Link e Google cobrem os dois públicos, e o que não existe não vaza.
- **Login por telefone.** O telefone é validado, não autentica. Quem entra, entra por e-mail ou Google.
- **Fallback por SMS ou e-mail.** Decisão do R1 mantida: WhatsApp é o único canal de validação. Mitigação é o override do admin.
- **Segundo fator para a equipe.** O painel é protegido por papel e RLS, não por MFA. Reavaliar quando houver dado financeiro real no admin (NAPO-008).
- **Tela de administração de usuários.** Promoção de papel e override de telefone acontecem por script de servidor com auditoria. A tela nasce no NAPO-008, consumindo a mesma função.
- **Páginas legais.** Termos e política entram como versão zero, apenas para haver o que consentir. O texto publicado é NAPO-003.
- **Portal do titular LGPD** (exportar e apagar meus dados). Fica para spec própria, depois que houver dado de pedido para exportar.
- **Carrinho e checkout.** Esta spec entrega o guarda que o checkout vai consumir, não o checkout (NAPO-006).
- **Convite de funcionário por e-mail.** A equipe é pequena e conhecida; promover por script resolve até o NAPO-008.

---

## 6. Dependências de Negócio

- **NAPO-001 concluído** — `profiles`, `user_role`, `is_admin()` e o trigger de auto-promoção já existem e são reaproveitados, não recriados.
- **NAPO-017 (verificação da empresa na Meta)** — não bloqueia o desenvolvimento, **bloqueia o login em produção**. Ver §7.
- **Domínio `napobsb.com.br` com DNS ativo** — necessário para o remetente do Magic Link em produção. Em local, a caixa de entrada falsa do Supabase cobre.

---

## 7. Observações e Decisões de Negócio

- **A elegibilidade da Meta é um risco maior do que o R1 previa (descoberto no benchmarking, 2026-08-10).** A spec do R1 §15.4 tratava o risco como "o envio pode falhar". A pesquisa mostrou que o acesso a *authentication templates* do WhatsApp é restrito e passa por um caminho de escala da Meta que inclui limiar de volume — a ordem de grandeza citada publicamente é de milhares de conversas iniciadas pelo negócio por dia, por número. A Napo faz 303 pizzas por mês. **O risco real não é o envio falhar; é o canal nunca ser liberado.** Decisão do PM: manter o WhatsApp oficial como prioridade e caminho principal, e desenhar a camada de envio de modo que trocar de provedor (um BSP revendedor, por exemplo) seja configuração e não reescrita. NAPO-017 sobe de prioridade — descobrir a elegibilidade real é mais urgente do que parecia.
- **Custo por mensagem existe desde a primeira.** O tier gratuito da Meta acabou em 2026 e mensagens de autenticação são cobradas por entrega. Isso muda o rate limit de "boa prática" para "controle de custo": os tetos da RN7 protegem a conta a pagar, não só o cadastro.
- **A equipe não passa pelo gate — decisão do PM, contra a recomendação do agente.** A recomendação era regra única para todos, por reduzir superfície de erro. O PM optou por liberar a equipe, e a consequência foi tratada com a exceção da RN4: o checkout exige telefone validado de qualquer papel, porque ali o número é dado de entrega, não credencial. Sem essa exceção, um funcionário compraria sem telefone e o pedido chegaria sem contato.
- **O carrinho fica anônimo até o checkout.** O R1 dizia "carrinho exige logado". Exigir cadastro para pôr item no carrinho é o ponto de abandono mais conhecido em e-commerce, e o R1 já paga o preço de exigir cadastro no checkout — cobrar duas vezes pelo mesmo custo de conversão não se justifica. O gate morde onde o dado passa a ser necessário.
- **O consentimento é capturado agora com termos versão zero.** Consentimento não é preenchível retroativamente: qualquer conta criada antes da coleta ficaria com a lacuna aberta para sempre, e a única saída seria pedir re-aceite. Melhor um texto provisório versionado, substituído pela v1 no NAPO-003, do que um buraco impossível de fechar.
- **A base mínima do design system nasce aqui, não no NAPO-003.** Estas são as primeiras telas reais do projeto e o catálogo (`packages/ui`) hoje só tem tokens. Instalar Tailwind e os poucos primitivos que estas telas exigem custa menos do que escrever três telas cruas para reescrevê-las na spec seguinte — e o preview aprovado no Gate Visual A só é contrato se refletir a stack real.
- **O gate protege dado de negócio, não é a camada de segurança.** Middleware protege rota; RLS protege dado. Um cliente que burlasse o gate continuaria sem enxergar o pedido de outro — a garantia está no banco, e é assim que deve permanecer.

---

## 8. Aprovação

- [x] **Spec revisado e aprovado por:** Hudson / 2026-08-11
- [x] **Design técnico criado** (`design.md`)
- [x] **Critérios de teste criados** (`tests.md`)
- [x] **Gate Visual A aprovado** — [`preview.html`](./preview.html), Hudson / 2026-08-11
- [x] **Pronto para entrar em execução** (mover para 🟢 Em Andamento no ROADMAP)
