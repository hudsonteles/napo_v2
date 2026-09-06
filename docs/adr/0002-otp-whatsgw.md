# 0002. O código de verificação vai pelo WhatsGW, não pela API oficial da Meta

---

**Status:** Aceito
**Data:** 2026-09-06
**Decisor(es):** Hudson (PM)
**Disparado por:** o CNPJ e o contrato social da Napo estão em revisão com o novo contador, e a verificação da empresa na Meta depende deles. O PM já opera o WhatsGW no sistema atual e pediu que ele passe a ser o canal do WhatsApp no sistema novo.

---

## Contexto

O gate de telefone do NAPO-002 manda um código de 6 dígitos por WhatsApp. A
implementação nasceu mirando a **API oficial da Meta** — `RemetenteMeta`, com
`WHATSAPP_PROVIDER=fake|meta` — e o NAPO-017 existe para conseguir a verificação da
empresa que ela exige.

Dois fatos travam esse caminho, e o segundo é mais grave que o primeiro:

1. **A verificação depende de documentos que estão em revisão.** Cartão CNPJ e contrato
   social passam pelo novo contador; não há data.
2. **A verificação pode não bastar.** O benchmarking do NAPO-002 (2026-08-11) registrou
   que o acesso a *authentication templates* passa por um caminho de escala da Meta com
   limiar de volume — a ordem de grandeza publicamente citada é de **milhares de
   conversas iniciadas por dia, por número**. A Napo faz **303 pizzas por mês**. O risco
   deixou de ser "o envio pode falhar" e virou **"o canal pode nunca ser liberado"**.

O segundo ponto é o que torna esta decisão estratégica em vez de contorno temporário: no
volume da Napo, o caminho oficial pode ser inalcançável por construção.

**Referências:**

- Seções afetadas: `ARCHITECTURE.md` §2.1 (Autenticação) e §6.1 (tabela do que não roda local)
- Itens do ROADMAP afetados: NAPO-017 (reescopado), NAPO-015 e NAPO-016 (inalterados)
- Spec afetada: `docs/specs/002-auth-gate-telefone/` — concluída; o contrato de negócio segue válido, o canal muda

---

## Decisão

**O código de verificação do gate de telefone passa a ser entregue pelo WhatsGW.** Entra
um adaptador `RemetenteWhatsGW` atrás da porta `RemetenteDeCodigo` que o NAPO-002 já
criou, e `WHATSAPP_PROVIDER` ganha o valor `whatsgw`.

A porta foi desenhada exatamente para isto. Nada acima dela sabe qual provedor respondeu
— trocar de canal é escrever um adaptador, não reescrever o gate.

**A decisão cobre apenas o OTP.** O bot de comércio conversacional (NAPO-015) e a
comunicação em massa (NAPO-016) continuam mirando a API oficial: disparo em volume por
gateway não-oficial é o caminho mais curto para o banimento, e é justamente volume que
esses dois itens produzem.

**O sistema envia por um número dedicado**, separado do WhatsApp que a loja usa para
falar com cliente.

---

## Alternativas consideradas

- **A — Esperar a verificação da Meta.** Manter o `RemetenteMeta` e aguardar. ·
  **Descartada porque:** trava o login em produção por prazo indeterminado, e o NAPO-021
  não sobe sem login. Pior: pode travar para sempre, se o limiar de volume não for
  alcançável — estaríamos esperando por algo que talvez não chegue.

- **B — WhatsGW para tudo, abandonando a Meta.** Um provedor só, sem verificação nunca. ·
  **Descartada porque:** colocaria marketing e bot no mesmo número e na mesma sessão
  não-oficial. Volume de marketing é o gatilho clássico de banimento, e derrubaria junto
  o login, que é o que menos pode cair.

- **C — Trocar o canal do OTP por SMS ou e-mail.** Sair do WhatsApp. · **Descartada
  porque:** SMS tem custo por mensagem e pior entrega no Brasil; e-mail como canal
  primário de OTP enfraquece o gate, já que o login já é por e-mail — o segundo fator
  deixaria de ser um segundo canal. **Mas o e-mail volta como reserva** (ver
  Consequências).

---

## Consequências

### Positivas

- **O login destrava.** Deixa de depender da verificação da empresa e do limiar de
  volume da Meta — os dois riscos que podiam adiar o NAPO-021 indefinidamente.
- **Sem template para aprovar.** O WhatsGW envia texto livre; some a categoria
  `AUTHENTICATION` e a fila de aprovação que vinha com ela.
- **Evidência operacional, não promessa.** O PM já opera o WhatsGW no sistema atual.
- **A porta `RemetenteDeCodigo` prova seu valor** pela segunda vez, como a
  `PortaPagamento` provou no ADR-0001.

### Negativas / trade-offs aceitos

- **Risco de banimento do número.** A Meta bane números que automatizam fora da API
  oficial, e OTP é a categoria mais fiscalizada. Se o número cair, **o login para — sem
  deploy nenhum**. Mitigado, não eliminado, pelo número dedicado: o estrago fica contido
  no envio de código e não leva junto o atendimento da loja.
- **A sessão é viva e pode cair.** O WhatsGW valida a chave por QR code e depende de uma
  sessão de WhatsApp Web: celular sem bateria, atualização do app ou sessão expirada
  derrubam o envio sem ninguém ter mexido em código. **Exige monitoramento**, e é a
  primeira dependência do projeto que quebra sozinha.
- **O código passa por terceiro.** O OTP trafega pela infraestrutura do WhatsGW — é
  relação de operador de dados e precisa ser declarada no NAPO-009 (LGPD).
- **Sem SLA contratual de entrega**, ao contrário de um BSP homologado.
- **Dois provedores de WhatsApp no projeto** a partir do NAPO-015: WhatsGW no OTP,
  Meta no bot e no marketing. É complexidade aceita conscientemente.

### Canal de reserva (consequência de desenho, a resolver na implementação)

Os dois primeiros riscos têm o mesmo desfecho — o gate de telefone fora do ar — e um
sistema cujo login depende de uma sessão de WhatsApp Web precisa de saída. A alternativa
natural é **OTP por e-mail como reserva**, o que dá ao NAPO-031 um segundo motivo para
existir. **Não faz parte desta decisão**; fica registrado como consequência a tratar na
spec de implementação.

### Impacto em `ARCHITECTURE.md`

- **§2.1 passa a dizer:** gate de telefone por OTP no WhatsApp **via WhatsGW**; a API
  oficial da Meta segue prevista para o bot (NAPO-015) e o marketing (NAPO-016).
- **§6.1**, na tabela do que não roda local: a linha "OTP WhatsApp (Meta)" passa a
  "OTP WhatsApp (WhatsGW)". O mock local continua obrigatório e o código fixo `123456`
  em `WHATSAPP_PROVIDER=fake` não muda.
- **Sem impacto** em §2.2 (UI), §3 (Arquitetura de Código) ou §4.5 (custo).

### Impacto em itens do ROADMAP

- **NAPO-017 — reescopado, não cancelado.** Deixa de bloquear o login e o NAPO-021.
  Continua valendo para o NAPO-015 e o NAPO-016, que seguem na API oficial. O roteiro em
  `docs/napo-017-meta-whatsapp.md` continua válido, com prioridade menor.
- **NAPO-002 — concluído, código alterado.** O contrato de negócio segue válido palavra
  por palavra: HMAC com pepper, comparação em tempo constante, tetos por número e por IP,
  recusa cega para número de outra conta. O que muda é o adaptador. Registrar na spec,
  não reabri-la — mesmo tratamento que o ADR-0001 deu ao NAPO-006.
- **NAPO-009 (LGPD)** ganha um operador de dados a declarar.
- **Item novo** para implementar o adaptador, a ser criado quando este ADR for aceito.

### Riscos a monitorar pós-decisão

- **Banimento do número.** · **Gatilho de revisão:** primeiro bloqueio ou queda
  inexplicada de entrega → reabrir a alternativa C (e-mail como primário) imediatamente.
- **Queda de sessão.** · **Gatilho:** segunda queda em 30 dias → o canal de reserva deixa
  de ser desejável e vira obrigatório.
- **Mudança de política da Meta contra gateways não-oficiais.** · **Gatilho:** qualquer
  anúncio nesse sentido → reavaliar com o NAPO-017 já resolvido como plano B.

---

## Aprovação

- [x] Revisado por: Hudson · em 2026-09-06
