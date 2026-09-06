# NAPO-017 — Roteiro: abrir o processo do WhatsApp Business na Meta

> **Para quem:** Hudson (PM). Nada aqui é código — é processo, e só você pode fazer.
> **Criado em:** 2026-09-06, no grooming, quando o item saiu de ⏸️ Bloqueados.

---

## A pergunta que este roteiro existe para responder

**A Napo consegue enviar um template de categoria `AUTHENTICATION` pelo WhatsApp?**

Tudo o mais é secundário. O gate de telefone do NAPO-002 manda um código de 6 dígitos
por WhatsApp; se esse tipo de mensagem não for liberado para a Napo, **o login não sobe
em produção** e a decisão de canal precisa ser reaberta.

Por que a dúvida existe: o acesso a templates de autenticação passa por um caminho de
escala da Meta que envolve limiar de volume — a ordem de grandeza citada publicamente é
de **milhares de conversas iniciadas pelo negócio por dia, por número**. A Napo faz 303
pizzas por mês. O risco não é "o envio pode falhar"; é **"o canal pode nunca ser
liberado"**.

---

## O atalho: responda a pergunta antes de esperar a verificação

Os passos 1 e 2 abaixo levam de dias a semanas. **O passo 3 leva uma tarde e já
responde a pergunta crítica** — o app de desenvolvimento vem com um número de teste que
envia para até 5 destinos sem verificação nenhuma.

Se você tiver pouco tempo hoje, **faça o passo 3 primeiro** e deixe 1 e 2 correndo em
paralelo.

---

## Passo 1 — Portfólio Empresarial

`business.facebook.com` → **Configurações do negócio**

Se ainda não existir um portfólio da Napo, crie. Vai pedir:

- Nome legal da empresa, exatamente como no CNPJ
- CNPJ
- Endereço da empresa
- Site: `https://napobsb.com.br`

> ⚠️ O nome legal precisa bater com o do cartão CNPJ. Divergência aqui é a causa mais
> comum de reprovação na verificação, e refazer custa outra rodada de dias.

---

## Passo 2 — Verificação da empresa

`business.facebook.com` → **Central de Segurança** → **Verificação da empresa**

Documentos que costumam ser aceitos:

- Cartão CNPJ ou contrato social
- Comprovante de endereço **no nome da empresa** (conta de luz, água, internet, contrato
  de locação)

**Prazo:** dias a semanas. É aqui que o item volta a ser genuinamente bloqueado —
avise-me quando submeter que eu devolvo o NAPO-017 para ⏸️ com a data.

---

## Passo 3 — O app e o número de teste ← **comece por aqui**

`developers.facebook.com` → **Meus apps** → **Criar app** → tipo **Negócios** →
adicionar o produto **WhatsApp**

Ao entrar em *WhatsApp → Configuração da API*, a Meta já oferece:

- um **número de teste** da própria Meta
- uma lista de até **5 números de destino** que você cadastra na hora
- um token temporário

**Cadastre o seu celular como destino e mande a mensagem de teste.** Se ela chegar, a
infraestrutura funciona.

---

## Passo 4 — Submeter um template `AUTHENTICATION` ← **é aqui que a resposta aparece**

*WhatsApp → Gerenciar templates* → **Criar template**

| Campo | O que usar |
|---|---|
| Categoria | **Autenticação** (é o ponto do teste — não escolha Utilidade) |
| Nome | `codigo_verificacao` |
| Idioma | Português (BR) |
| Corpo | o texto de código de verificação que a Meta oferece pronto |

**O que observar, e o que cada desfecho significa:**

- ✅ **Aprovado** — o canal existe para a Napo. O NAPO-002 sobe como está. Me avise e eu
  registro no ROADMAP.
- ❌ **Rejeitado, ou a categoria Autenticação nem aparece como opção** — é a resposta
  negativa que este roteiro caça. **Me avise imediatamente:** a decisão de canal do gate
  de telefone precisa ser reaberta, e quanto antes, mais barato.
- ⏳ **Pendente por mais de 48h** — não é resposta; me avise que a gente decide se espera
  ou se trata como negativa provisória.

---

## Passo 5 — Número de produção (só depois de 1, 2 e 4 resolvidos)

O número que a Napo vai usar **não pode estar ativo em nenhum WhatsApp comum** (nem
normal, nem Business). Se estiver, é preciso apagar a conta daquele número antes — e
isso apaga o histórico de conversas dele.

> 💡 Vale usar um número novo, dedicado, em vez do número que a loja já usa para falar
> com cliente. Migrar o número existente derruba o histórico e é irreversível.

---

## O que fazer com a resposta

| Desfecho | Consequência no projeto |
|---|---|
| Template aprovado | NAPO-017 fecha. O NAPO-002 sobe em produção como está. |
| Template negado | **Reabrir a decisão de canal do gate de telefone.** A porta `RemetenteDeCodigo` (NAPO-002) foi feita para isso: trocar de canal é escrever um adaptador, não reescrever o gate. Alternativas a avaliar: SMS por BSP, ou código por e-mail — que dependeria do NAPO-031. |
| Sem resposta em 48h | Tratar como negativa provisória e começar a avaliar alternativa em paralelo. |

**Independente do desfecho, me avise.** O NAPO-017 bloqueia o NAPO-021, e o NAPO-021 é o
último passo do R1 — a resposta muda o que vai para produção.
