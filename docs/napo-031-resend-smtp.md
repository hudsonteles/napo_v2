# NAPO-031 — Roteiro: e-mail próprio da Napo pelo Resend

> **Para quem:** Hudson (PM). É configuração em painel e DNS — não tem código.
> **Criado em:** 2026-09-06, na especificação do item.

---

## Por que isto existe

O SMTP embutido do Supabase entrega **2 a 4 e-mails por hora** e é explicitamente
proibido em produção. Sem servidor próprio, **o Magic Link não sai** — e o Magic Link
*é* o login. Não é melhoria de entrega: sem isso o NAPO-021 não sobe.

---

## O item tem duas metades, e só uma é de agora

| | O que é | Quando |
|---|---|---|
| **A — este roteiro** | conta no Resend, verificar o domínio, publicar o DNS | **agora** |
| **B** | colar as credenciais nos painéis de staging e produção | **dentro do NAPO-021**, quando os projetos existirem |

A metade A é a que tem espera: **propagação de DNS não é instantânea**. Fazer agora é o
que impede a surpresa no dia do deploy.

> O ambiente **local não muda**. Ele continua usando o inbox falso (Inbucket, em
> `http://localhost:54424`), que é melhor para desenvolver — nada de e-mail de verdade
> saindo de máquina de dev.

---

## Passo 1 — Conta no Resend

`resend.com` → criar conta.

**Plano gratuito basta e vai sobrar:** 3.000 e-mails/mês, 100/dia, 1 domínio, com DKIM.
A Napo faz 303 pedidos/mês — mesmo contando confirmação, lembrete e login, dá algo como
900/mês e ~10/dia.

> O teto que aperta primeiro é o de **100 por dia**, não o mensal. Só chegaria perto se
> o movimento diário triplicasse — e aí o problema seria bom.

---

## Passo 2 — Adicionar o domínio

**Domains → Add Domain** → `napobsb.com.br` → região **South America (sa-east-1)**.

O Resend devolve **três registros DNS**. Eles têm nomes parecidos e funções bem
diferentes:

| Tipo | Para que serve |
|---|---|
| **MX** | recebe os retornos (bounce) — sem ele você não descobre e-mail que não chegou |
| **TXT (DKIM)** | assina o e-mail com a chave do domínio — é o que prova que veio da Napo |
| **TXT (SPF)** | autoriza o Resend a enviar em nome de `napobsb.com.br` |

Deixe a tela aberta: você vai copiar os valores no passo seguinte.

---

## Passo 3 — Publicar o DNS no Registro.br

`registro.br` → entrar → **napobsb.com.br** → **Editar zona DNS**

Copie os três registros **exatamente** como o Resend mostrou.

**Dois cuidados que causam a maioria das falhas:**

- **Não acrescente o domínio ao nome do registro.** O Registro.br já completa. Se o
  Resend pede `resend._domainkey`, digite isso — não `resend._domainkey.napobsb.com.br`.
- **O valor do DKIM é longo e não pode ter espaço nem quebra de linha.** Copie e cole,
  não digite.

Salve a zona. A propagação leva de minutos a algumas horas.

---

## Passo 4 — Verificar

Volte ao Resend → **Domains** → botão **Verify**.

- ✅ **Verified** — pronto, siga para o passo 5.
- ⏳ **Pending** por mais de 2 horas — quase sempre é o nome do registro com o domínio
  duplicado (ver o cuidado do passo 3). Confira e verifique de novo.

---

## Passo 5 — Criar a API key

**API Keys → Create API Key** · permissão **Sending access** · domínio `napobsb.com.br`.

> ⚠️ **A chave aparece uma vez só.** Guarde no seu gerenciador de senhas. Se perder,
> não dá para recuperar — só criar outra.

**Não me mande a chave por aqui e não a coloque em nenhum arquivo do repositório.** Ela
só é usada no painel do Supabase, na parte B, e credencial não entra em git.

---

## O que a parte B vai precisar (guarde junto da chave)

Quando o NAPO-021 criar os projetos de staging e produção, o painel do Supabase
(*Project Settings → Authentication → SMTP Settings*) vai pedir exatamente isto:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Porta | `587` |
| Usuário | `resend` |
| Senha | a API key do passo 5 |
| Sender email | `pedido@napobsb.com.br` |
| Sender name | `Napo` |

O remetente `pedido@napobsb.com.br` é o que `ARCHITECTURE.md` §2.1 já define.

---

## Por que não usar a conta do Google

Avaliado e descartado duas vezes — em 2026-08-11 e 2026-09-06. A conta gratuita do Gmail
**reescreve o remetente para `@gmail.com`**: você perde o DKIM do `napobsb.com.br`
justamente no e-mail que menos pode cair em spam, que é o link de login. E o custo que a
alternativa evitaria não existe — o plano do Resend que a Napo precisa é gratuito.

---

## Quando terminar

Me avise que a verificação passou. Eu registro no ROADMAP e a parte B entra na spec do
NAPO-021 com este roteiro como referência.
