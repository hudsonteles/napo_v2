# 🗺️ ROADMAP (Backlog) do Projeto: Napo

> 📋 **Convenções**
>
> - **Prefixo de ID deste projeto:** `NAPO`.
> - **Specs:** cada item aprovado vira pasta em `docs/specs/[ID]-[slug]/`. **Completo** (3 arquivos: `spec.md`, `design.md`, `tests.md`) por default; **lite** (1 arquivo `spec.md` com `Tipo: lite`) permitido para itens em 1 domínio não-sensíveis conforme `AGENTS.md` §3.1 (resumo: Esforço=Baixo qualquer MoSCoW, OU Esforço=Médio com MoSCoW≠Must, OU Esforço=Médio+Must em 1 domínio). Mudanças triviais (≤1 arquivo, sem RN nova, ≤30min) podem ir direto como **tweak** sem spec (ver `AGENTS.md` §3.0).
> - **IDs imutáveis:** o número não muda ao reordenar. A ordem é dada pela **posição na seção**, não pelo número.
> - **Como o agente atualiza este arquivo:** veja `AGENTS.md` §4 (movimentação entre seções, novos itens, dependências).
> - **Evoluir este backlog** (capturar ideias durante dev, promover, grooming): comandos `/ideia`, `/promover`, `/grooming`. Ver Fluxo 6 do guia em `oria-orquestrador-ia/ReadMe_GuiaOrquestracaoAgentes.md` e `AGENTS.md` §4.3.

> 📚 **Fontes de verdade deste backlog**
>
> - **Spec do R1:** [`docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`](docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md) — vence em qualquer conflito.
> - **Decisões por fase (R2+):** [`docs/roadmap-napo-decisoes.md`](docs/roadmap-napo-decisoes.md) — registro histórico, não é fila de trabalho.

---

## 🎯 Objetivo do MVP

_Descreva o menor produto que já resolve o problema central do usuário._

Vender pizza congelada premium por canal próprio, com disponibilidade honesta e frete
que não mata a venda. O gargalo é o **forno**, não o mercado: a cozinha opera a 47% da
capacidade (303 de 650 pizzas/mês) e a ociosidade vale R$ 7.700/mês de margem — por
isso o canal de venda vem antes de qualquer módulo de operação.

Fecha o MVP (R1): site com catálogo e SEO, checkout com Mercado Pago, motor de
disponibilidade (cutoff derivado + dois tetos), frete por faixa, área do cliente,
admin de pedidos/estoque/custos, LGPD e auditoria.

---

## 🟢 Em Andamento (máx 2-3 itens simultâneos)

_Itens sendo trabalhados agora. O agente move de "Próximos" ao iniciar._

_Fila vazia — o NAPO-025 fechou em 2026-09-06. O próximo a entrar é o topo de 🟡 Próximos: **NAPO-007**._

---

## 🟡 Próximos (Ordem importa — pegar de cima pra baixo)

_Próximos na fila, ordem definida. O agente promove o primeiro item para "Em Andamento" ao iniciar._

_Ordem definida pelo PM em 2026-09-04: validar telas, fluxos e pagamento **no ambiente de desenvolvimento** antes de provisionar qualquer ambiente. Por isso o NAPO-021 (deploy) foi para o fim do Backlog._

_**Reescopado em 2026-09-05** conforme [`docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md`](docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md) §9. O NAPO-023 foi absorvido pelo NAPO-025 e cinco itens novos (025–029) entraram: a venda deixa de existir só no site e passa a nascer também no balcão, na rua e no WhatsApp, com cobrança na maquininha. O NAPO-022 saiu de Próximos para o Backlog._

- [ ] **NAPO-007** Área do cliente: meu perfil, endereços e meus pedidos
  - **Dependências:** NAPO-006
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** três áreas numa spec só (decisão do PM, 2026-09-04), nesta ordem: **1. Meu Perfil · 2. Endereços · 3. Meus Pedidos**. Compartilham casca, navegação e RLS por dono — separar em três itens reescreveria a mesma casca três vezes. Padrão de listagem do projeto: cards + busca + combobox de filtro + combobox de ordenação, com persistência ao navegar entre card e lista. **Absorve a ideia "porta de entrada para a conta no site público"** (registrada em 2026-08-18, saiu de 💡 nesta data): cabeçalho anônimo → "Entrar"; autenticado → nome ou "Minha conta". Isso arrasta leitura de sessão para uma superfície hoje 100% estática — o SSG do `(site)` é decisão de custo declarada em `ARCHITECTURE.md` §4.5, então a spec precisa dizer **como** o cabeçalho lê sessão sem derrubar o SSG.

- [ ] **NAPO-026** Registrar venda no admin: quem vende, o que sai, para quem
  - **Dependências:** NAPO-025
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** a fatia mínima desmembrada do NAPO-008 ([`docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md`](docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md) §9). Sem um lugar onde a venda é registrada, a cobrança na maquininha não tem pedido a que se ligar — e esse lugar estava enterrado no item mais caro do backlog, junto de BOM, estoque, custos e painel. Aqui entram as origens `balcao`, `whatsapp` e `carga`, e os momentos `no_ato`, `na_entrega` e `a_combinar`. Venda de congelada do catálogo passa pelo motor de disponibilidade (NAPO-004) como qualquer outra: balcão que vende vaga de forno sem avisar o site faz o site mentir.

- [ ] **NAPO-027** Cobrança na maquininha: Point, frota e vínculo com o operador
  - **Dependências:** NAPO-026
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** o item que resolve a dor central — hoje ninguém dá baixa e um sócio reconstrói a verdade depois pelo WhatsApp. O valor vai do sistema para a maquininha, o cliente escolhe débito/crédito/Pix **no aparelho**, e o webhook confirma sozinho: a baixa vira subproduto do ato de cobrar. **Cobrança aprovada no `point` é prova de entrega** — o aparelho estava na porta do cliente; isso **não vale para `link`**, que só prova que alguém pagou. Inclui **cadastro de frota** ([`docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md`](docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md) §8): maquininha nunca é excluída, só muda de situação; `device_id` (envia a cobrança) e `POI_ID` (volta no relatório) são guardados como par; o vínculo aparelho↔operador é **datado**, porque conciliar venda de três semanas atrás exige saber quem estava com o aparelho naquele dia. Tópico de webhook é `point_integration_wh` (ou `orders`), **não** `payment`.

---

## 🔵 Backlog (Priorizado mas flexível)

_Itens conhecidos sem ordem fixa. Reordenar conforme aprendizado e novas informações._

### Fecham o R1

_O escopo do R1 cresceu em 2026-09-05: vender deixou de ser só o site. Ver [`docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md`](docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md)._

- [ ] **NAPO-030** Tela de carrinho vazio à altura da marca
  - **Dependências:** —
  - **Valor:** Médio · **Esforço:** Baixo · **MoSCoW:** Could
  - **Promovida em:** 2026-09-06 (de 💡, no grooming)
  - **Notas:** a tela atual é funcional e genérica demais para o perfil premium do cliente. Aparece cedo na jornada, muitas vezes antes de a pessoa ter visto qualquer produto, e hoje só informa uma ausência — não vende nem conta nada. **Cabe como spec lite** (uma tela, sem RN nova), mas o **Gate Visual A precisa trazer mais de uma direção**: o valor está na escolha entre caminhos (convite à vitrine? sabor em destaque? a fornada da semana?), não num mockup único. **Origem:** PM durante a validação do NAPO-025.

- [ ] **NAPO-017** Verificação da empresa na Meta (WhatsApp Business API)
  - **Dependências:** — · **Bloqueia:** NAPO-015 e NAPO-016 (bot e marketing na API oficial)
  - **Valor:** Médio · **Esforço:** Baixo (é processo, não código) · **MoSCoW:** Should
  - **⬇️ Reescopado em 2026-09-06 por [ADR-0002](docs/adr/0002-otp-whatsgw.md):** **deixou de bloquear o login e o NAPO-021.** O OTP passou para o WhatsGW, que não exige verificação de empresa. Este item continua valendo só para o bot e o marketing, que seguem na API oficial — e passa de Must para Should, de Alto para Médio.
  - **Roteiro:** [`docs/napo-017-meta-whatsapp.md`](docs/napo-017-meta-whatsapp.md) — passo a passo do processo. O **passo 3** (app + número de teste) responde a pergunta crítica numa tarde, sem esperar a verificação.
  - **⬆️ Saiu de ⏸️ Bloqueados em 2026-09-06 (grooming):** ele não esperava a Meta — esperava alguém abrir o processo. Ficar em Bloqueados o tornava invisível no planejamento por 26 dias, enquanto a anotação de 11/08 dizia que descobrir a elegibilidade era caminho crítico. Volta a ⏸️ **depois** de submetido, quando a bola estiver mesmo com eles.
  - **⚠️ Prioridade elevada (2026-08-11, benchmarking do NAPO-002):** verificação da empresa pode **não bastar**. O acesso a _authentication templates_ passa por um caminho de escala da Meta que inclui limiar de volume (ordem de grandeza citada publicamente: milhares de conversas iniciadas pelo negócio por dia, por número). A Napo faz 303 pizzas/mês. O risco deixou de ser "o envio pode falhar" e passou a ser "o canal pode nunca ser liberado". **Descobrir a elegibilidade real é agora caminho crítico** — se negativa, a decisão de canal precisa ser reaberta antes do NAPO-006.

- [ ] **NAPO-008** Admin: insumos/BOM, estoque, entregadores, custos e painel econômico
  - **Dependências:** NAPO-002, NAPO-004, NAPO-028
  - **✂️ Quebrado em 2026-09-05:** "registrar venda" saiu para o **NAPO-026** (a maquininha precisava de um pedido a que se ligar, e isso estava enterrado no item mais caro do backlog) e a **taxa por transação passa a vir pronta do NAPO-028** — não é mais preciso modelar tabela de taxa por bandeira e parcelamento.
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Must
  - **Notas:** provavelmente vira mais de uma spec. Inclui BOM de dois níveis (sub-receita de massa), ajuste de estoque **com motivo + auditoria** (sem isso o saldo projetado descola do real em semanas e o checkout passa a mentir), imposto e taxa de cartão na margem, fechamento de comissão por entregador, ponto de equilíbrio × ocupação de capacidade lado a lado, simulador de viabilidade de frete e segregação de receita por atividade fiscal. Spec §4, §12.

- [ ] **NAPO-009** LGPD e log de auditoria
  - **Dependências:** NAPO-001
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** termos, política de privacidade, banner, consentimento **versionado** (quando e qual versão foi aceita). Utilidade (OTP, aviso de entrega) é separada de marketing — validar o número não autoriza propaganda. Spec §8.

- [ ] **NAPO-031** SMTP customizado no Supabase Auth via Resend
  - **Spec:** *(a criar)*
  - **Dependências:** — (o domínio `napobsb.com.br` já existe no Registro.br)
  - **Bloqueia:** NAPO-021 · e a ideia "E-mail transacional de pedido"
  - **Valor:** Alto · **Esforço:** Baixo · **MoSCoW:** Must
  - **Notas:** o SMTP embutido do Supabase entrega 2–4 e-mails por hora e é explicitamente proibido em produção — sem SMTP próprio **o login não sobe**, porque o Magic Link não sai fora do ambiente local. Decisão de 2026-08-11: Resend, como `ARCHITECTURE.md` §2.1 já define, com `From: pedido@napobsb.com.br` e DKIM no domínio. **Gmail avaliado a pedido do PM e descartado duas vezes** (2026-08-11 e 2026-09-06): conta gratuita reescreve o remetente para `@gmail.com`, sem DKIM do domínio próprio, no e-mail que menos pode cair em spam. O argumento de custo não se sustenta — o plano gratuito do Resend dá 3.000 e-mails/mês e 100/dia com domínio próprio, contra a necessidade da Napo de ~900/mês e ~10/dia. **Fazer antes de o NAPO-021 começar:** verificação de domínio depende de propagação de DNS, que não é instantânea.
  - **Roteiro (parte A):** [`docs/napo-031-resend-smtp.md`](docs/napo-031-resend-smtp.md) — conta, verificação de domínio e DNS. É a metade com latência e pode ser feita hoje.
  - **✂️ Partido em dois (2026-09-06, na especificação):** **A** — conta no Resend, domínio verificado e DNS publicado, **agora**; **B** — colar as credenciais nos painéis de staging e produção, **dentro do NAPO-021**, porque esses projetos só nascem lá. Descoberta ao especificar: o ambiente local continua no inbox falso, e SMTP de projeto remoto é painel, não `config.toml` — **não há código a versionar**, por isso o item não virou spec.
  - **Promovida de 💡 em:** 2026-09-06

- [ ] **NAPO-032** Canal do OTP pelo WhatsGW
  - **Spec:** *(a criar)*
  - **Dependências:** NAPO-002 (concluído — a porta `RemetenteDeCodigo` já existe)
  - **Bloqueia:** NAPO-021 (o login não sobe sem um canal real de OTP)
  - **ADR pré-requisito:** [ADR-0002-otp-whatsgw](docs/adr/0002-otp-whatsgw.md) (Status: Aceito)
  - **Valor:** Alto · **Esforço:** Baixo · **MoSCoW:** Must
  - **Notas:** adaptador `RemetenteWhatsGW` atrás da porta que o NAPO-002 criou, e `WHATSAPP_PROVIDER` ganha o valor `whatsgw`. Envio é um POST com `apikey`, número remetente, destinatário e texto — sem template. **Número dedicado**, separado do WhatsApp da loja: se a Meta banir por automação, o estrago fica no envio de código e não leva o atendimento junto. **A spec precisa resolver duas coisas que o ADR deixou em aberto:** como o sistema percebe que a **sessão caiu** (ela cai sozinha, sem deploy) e qual é o **canal de reserva** — candidato natural é OTP por e-mail, o que amarra este item ao NAPO-031. O contrato de negócio do NAPO-002 segue intacto: HMAC com pepper, tempo constante, tetos por número e IP, recusa cega para número de outra conta.
  - **Criada em:** 2026-09-06 (a partir do ADR-0002)

- [ ] **NAPO-021** Provisionar homologação e produção + primeiro deploy
  - **Dependências:** NAPO-001, NAPO-032 (canal real de OTP) · **NAPO-031 parte A** (domínio verificado no Resend) — a parte B do 031, que é configurar o SMTP nos painéis, **acontece dentro desta spec**: os projetos de staging e produção nascem aqui
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **⚠️ Conferir antes de publicar (do NAPO-003, 2026-08-17):** (a) a separação real de bancada entre doce e salgado, que sustenta o precaucional de avelã estar só nos doces; (b) a Banana declara leite em "contém" e a Massa Doce, que é a base dela, declara só glúten — uma das duas está errada.
  - **⬇️ Movido para o fim da fila (2026-09-04):** decisão do PM — validar telas, fluxos e o pagamento real no ambiente de desenvolvimento antes de provisionar homologação e produção. Continua sendo o último passo do R1, não um item opcional.
  - **Notas:** desmembrado do NAPO-001 em 2026-08-10 por decisão de focar em desenvolvimento primeiro. Cria os dois projetos Supabase online (staging e prod — **2 ativos cabem no free tier**), conecta a Vercel, aponta o DNS de `napobsb.com.br` no Registro.br e roda o primeiro `db:push` de verdade. Dois pontos de atenção conhecidos: projeto free **pausa após ~7 dias sem atividade** (o CI tocando o banco a cada PR resolve), e produção no free não tem PITR — vira Pro (~US$ 25/mês) antes de faturar. **Quanto mais specs acumularem antes deste item, maior a superfície de surpresa de ambiente** (`docs/specs/001-fundacao/design.md` §8).

- [ ] **NAPO-022** Meus chamados: abertura, anexos e acompanhamento pelo cliente
  - **Dependências:** NAPO-007
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Should
  - **⬇️ Movido de 🟡 Próximos para 🔵 Backlog (2026-09-05):** a fila de Próximos passou a ser a espinha de cobrança. Suporte ao cliente continua Should e volta assim que a espinha fechar.
  - **Notas:** canal do cliente para abrir uma demanda (a partir de um pedido ou avulsa), **acompanhar** o andamento e **cancelar** o próprio chamado. Anexo é **manual** — o cliente sobe imagem ou PDF pequeno (decisão do PM, 2026-09-04); captura automática da tela foi descartada por exigir permissão do navegador, quebrar com imagem de outro domínio e poder capturar dado pessoal sem o cliente perceber. Primeiro uso de **Supabase Storage** no projeto (já previsto em `ARCHITECTURE.md` §2.1, não exige ADR): pede política de bucket por dono, teto de tamanho e de quantidade, validação de tipo real (não por extensão) e atenção à cota do free tier (§4.5). Aviso de resposta fica **só na tela** (badge de não-lido) — e-mail dependeria do SMTP que ainda não existe. O ciclo de vida do chamado nasce aqui e é consumido pelo NAPO-024.

- [ ] **NAPO-024** Mesa de atendimento: tratativa de chamados no admin
  - **Dependências:** NAPO-022
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Should
  - **⬇️ Movido de 🟡 Próximos para 🔵 Backlog (2026-09-05):** decisão do PM. Depende do NAPO-022, que segue em Próximos — o lado do admin só faz sentido depois que o cliente tiver como abrir chamado.
  - **Notas:** o outro lado do NAPO-022 — a casa vê a fila, assume o chamado, conversa com o cliente, anexa resposta e **fecha com uma solução**. Item próprio e fora do NAPO-008 (decisão do PM, 2026-09-04): o admin é economia e operação, suporte é outro domínio, e o NAPO-008 já é o item mais caro do backlog. A spec precisa definir estados, quem pode assumir, o que conta como "resolvido" e se o cliente confirma o fechamento. Como o NAPO-021 é o último item da fila, nenhum chamado fica órfão em produção nesse intervalo.
- [ ] **NAPO-028** Conciliação por relatório: o dinheiro que não passou pelo sistema
  - **Dependências:** NAPO-025
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Must
  - **Notas:** o **anel 2** de [`docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md`](docs/superpowers/specs/2026-09-05-espinha-cobranca-design.md) §6. Não dá para forçar o fluxo — regra que atrapalha na porta do cliente é regra que o entregador burla, e aí se perde o dado *e* a venda. Mas todo pagamento que escapa do sistema **passa pelo Mercado Pago**, e isso é legível. Spike de 2026-09-05 sobre o relatório real da conta (45 linhas) provou: venda avulsa na maquininha aparece com `POI_ID` e `POS_ID` em **12/12** das linhas; Pix direto na chave aparece (só valor e horário, o casamento mais fraco); e o `APPLICATION_ID` separa o que passou pelo sistema do que não passou por **comparação de string, não heurística**. **A taxa vem pronta** — `FEE_AMOUNT` por transação, com bandeira, parcelas e modo de entrada. **Latência é de relatório, não de webhook:** venda avulsa não notifica. Entrega a caixa de entrada de **dinheiro sem venda registrada**, que hoje evapora. Absorve a ideia "Conciliação de pagamentos" (💡 desde 2026-08-10).

- [ ] **NAPO-029** Carga de rua: consignação com o vendedor
  - **Dependências:** NAPO-026
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Should
  - **Notas:** hoje o vendedor sai com ~30 pizzas e o sistema registra só "saíram 30"; o que não vende volta ao estoque, sem saber quem comprou o quê. A carga sai como movimento de estoque, cada venda debita **da carga** (não do estoque principal) e o retorno reentra. **Separado da espinha de propósito:** carga é problema de *estoque* ("essa pizza saiu de onde?"), a espinha é de *pagamento* ("esse dinheiro entrou?"). A tela do vendedor é uma só e usa as duas — a separação é sobre quem é dono de qual regra. O vendedor pode cobrar antes deste item existir: a venda dele debita do estoque principal, o que já é melhor que hoje.

### R2 — Eventos

- [ ] **NAPO-010** Módulo de eventos (preparação)
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Should
  - **Notas:** o sistema **prepara** o evento, não o opera ao vivo — cada evento é um dossiê. Cálculo automático de insumos via proporção pessoa/pizza sobre o BOM, checklist de equipamentos, semáforo de prontidão, pipeline Orçamento→Confirmado→Em preparação→Pronto→Realizado→Pós-evento, precificação assistida, rentabilidade real vs. planejada, ordem de serviço exportável (BEO). Colisão evento × congelada resolve por _allocated ATP_: evento confirmado reserva, sistema sinaliza, humano libera manualmente. Ver `docs/roadmap-napo-decisoes.md` (Fase 4).

### R3 — Fiscal e cozinha

- [ ] **NAPO-011** Emissão fiscal de venda (NFC-e) via emissor de mercado
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Should
  - **Notas:** **comprar, não construir.** A costura já fica pronta no R1. Bloqueado externamente por NAPO-018 e NAPO-019.

- [ ] **NAPO-012** KDS (tela de cozinha)
  - **Dependências:** NAPO-008
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Should
  - **Notas:** fluxo principal da cozinha; papel só para via de expedição. Falta definir estratégia de degradação/offline.

- [ ] **NAPO-013** PDV local (venda de fresca)
  - **Dependências:** NAPO-012
  - **Valor:** Médio · **Esforço:** Alto · **MoSCoW:** Could
  - **Notas:** canal dentro do sistema unificado de pedidos, não app separado. PWA em tablet com fila offline-first — resolve também o "aguentar o rojão".

### R4 — Canais e automação

- [ ] **NAPO-014** Ingestão de pedidos iFood/99food via hub homologado
  - **Dependências:** NAPO-012
  - **Valor:** Alto · **Esforço:** Médio · **MoSCoW:** Could
  - **Notas:** **comprar hub**, não virar integradora homologada. Sistema consome via API/webhook → cai no KDS e baixa estoque.

- [ ] **NAPO-015** Bot de comércio conversacional no WhatsApp
  - **Dependências:** NAPO-006, NAPO-010, NAPO-012
  - **Valor:** Alto · **Esforço:** Alto · **MoSCoW:** Could
  - **Notas:** nova porta de entrada para o que já existe, não sistema novo. Modelo híbrido: **IA interpreta, SISTEMA decide** — todo número (estoque, preço, frete, prazo) vem do sistema, zero alucinação. Congelada fecha autônomo; evento vira lead no pipeline (precificação premium é curadoria humana); reclamação vai direto para humano. Reserva temporária de estoque durante a conversa (padrão 10 min). **Pagamento na entrega liberado só neste canal.**

- [ ] **NAPO-016** Comunicação em massa no WhatsApp (marketing)
  - **Dependências:** NAPO-009
  - **Valor:** Médio · **Esforço:** Médio · **MoSCoW:** Could
  - **Notas:** exige **opt-in explícito e separado** do consentimento de utilidade — categoria e custo próprios na API da Meta.

---

## 💡 Ideias (Sem priorização)

_Capturadas mas não avaliadas. Promover para Backlog após análise de valor/esforço._

Adiadas no R1 **com o dado já capturado** (ligam depois sem migração):

- [ ] **Etiqueta de lote/validade para impressão** — rotulagem; o dado de lote já é gravado no R1. Registrado em 2026-08-10.
- [ ] **Contagem cíclica de inventário e registro de perdas** — ajuste manual com motivo cobre o R1. Registrado em 2026-08-10. **Subiu de importância em 2026-09-05:** deixou de ser higiene e virou metade do sistema de controle — dinheiro vivo não deixa rastro no Mercado Pago, então divergência de estoque é a única rede que pega pizza que saiu sem venda registrada (ver design da espinha de cobrança §6.2).
- [ ] **Capacidade por etapa-gargalo (modelo completo)** — Theory of Constraints por etapa (massa/fermentação, montagem, forno, congelamento); além de limitar venda, **diagnostica onde investir**. Adiado por falta de números medidos; a tabela de etapas já nasce no schema. Gatilho: quando houver medição real ou quando o segundo forno entrar em discussão. Registrado em 2026-08-10.
- [ ] **Roteirização automática do dia de entrega** — ~10 entregas/dia se organizam à mão. Gatilho: passar de ~25 entregas/dia. Registrado em 2026-08-10.

Ainda abertas, para as fases seguintes:

- [ ] **Orçamento de eventos online (simulador + captação de lead)** — página pública onde o cliente informa o número de pessoas e monta o pacote: louças e talheres, bebidas (refrigerante e água) e garçons a **R$ 250 cada**. O **forno de pedra no local e a pizza assada na hora são obrigatórios** — fazem parte do serviço e nunca aparecem como item opcional no simulador. Preço por pessoa **decrescente por volume**: R$ 99,00/pessoa a partir de 10 pessoas até R$ 64,90/pessoa em 100 pessoas. **Todos os valores editáveis no admin** — é essa exigência que torna o item dependente do NAPO-008 e o tira do NAPO-003. Resolve a ideia "como um lead de evento entra no pipeline antes do bot existir" e antecipa parte da precificação assistida do NAPO-010. Precisa de: faixas de preço por volume, catálogo de itens opcionais, calculadora em `packages/core`, formulário de lead com consentimento LGPD e telas de admin. **Depende de NAPO-008.** Registrado em 2026-08-13. **Origem:** Gate Visual A do NAPO-003, quando o PM notou que o site não tinha porta de entrada para eventos. O NAPO-003 entrega a porta (página `/eventos` + CTA de WhatsApp); o simulador é este item.
- [ ] **Cartão salvo para compra em um toque** — o Payment Brick exibe cartões salvos vinculados a um `customer_id` da nossa conta (só os dentro da validade), atrelados à conta Napo que o cliente já tem desde o NAPO-002 — **sem exigir que ele tenha conta no Mercado Pago**. Pizza congelada é compra recorrente: o ganho está do segundo pedido em diante. Guardamos só os identificadores do MP, nunca o cartão. **Depende do NAPO-009**: guardar cartão exige consentimento explícito e versionado. Fora do NAPO-025 de propósito — a espinha já é Esforço Alto e isso não bloqueia nada. Registrado em 2026-09-05, a partir do ADR-0001.

- [ ] **Promoções, cupons e descontos** — não existe nada disso no R1: a única regra promocional é frete grátis acima de R$ 150 (NAPO-005). A definir o que "promoção" significa para a Napo — cupom de desconto, desconto por quantidade, combo, ou **preço menor em fornada distante para encher o forno ocioso** (a que mais conversa com o gargalo do negócio). Mexe em preço, checkout, margem e painel econômico ao mesmo tempo. Registrado em 2026-08-13. **Origem:** Gate Visual A do NAPO-003.

- [ ] **Migração dos dados atuais** (clientes, receitas, estoque) — precisa acontecer antes do go-live do R1. Registrado em 2026-08-10.
- [ ] **Sinal/depósito e política de cancelamento de eventos** — o registro de decisões trata pagamento só no contexto de delivery. Registrado em 2026-08-10.
- [ ] **Conflito de agenda em eventos:** equipe e **equipamento** duplo-alocados. Registrado em 2026-08-10.
- [ ] **Cadastro de custo de equipe e deslocamento** — pré-requisito da precificação assistida de eventos (NAPO-010). Registrado em 2026-08-10.
- [ ] **Histórico de calote/no-show por cliente** — paraquedas para revisitar caso a caso a regra de pagamento na entrega do bot (NAPO-015). Registrado em 2026-08-10. **Reposicionado em 2026-09-05:** pagamento na entrega é o canal dominante e ~99% pagam, então **não haverá trava** (design da espinha §4.1). A espinha grava a evidência (quem escolheu, quem honrou, quem sumiu) — esta ideia deixa de ser feature e vira a decisão de política que se toma depois, com número real na mão.
- [ ] **Resiliência offline e degradação do KDS** — o PDV resolve por fila offline-first, o KDS ainda não tem estratégia. Registrado em 2026-08-10.
- [ ] **Migrar o Supabase CLI para 2.x e o Postgres local para 17** — o repositório fixa CLI 1.x e `major_version = 15`, que já não são o padrão de projetos novos do Supabase. A troca é barata enquanto não existe produção e cara depois que houver dado real. Gatilho observado: um volume Docker criado por uma CLI 2.x recusou subir na 1.x (`database files are incompatible with server`) e derrubou o ambiente local inteiro — enquanto as máquinas de dev tiverem CLIs diferentes, quem clonar perde o stack. Registrado em 2026-08-10. **Origem:** conserto do merge travado de NAPO-001, com duas máquinas em CLIs divergentes. **Exige revisão de spec NAPO-001 antes de promover** — mexe em `supabase/config.toml`, no `package.json` e no CI.

- [ ] **Templates de e-mail do Supabase Auth em português com a identidade da Napo** — o Magic Link chega hoje com o texto padrão do GoTrue, em inglês e sem marca: é o primeiro e-mail que o cliente recebe da casa e o que carrega o link de acesso à conta. Configurável por `[auth.email.template.*]` no `config.toml` (local) e pelo painel (staging/prod). Envolve copy, não só HTML. Registrado em 2026-08-11. **Origem:** Gate Visual B do NAPO-002.

---

- [ ] **Copy do site derivada de configuração, não cravada no código** — o site do NAPO-003 escreve à mão o que hoje é premissa de dado único: o **dia de entrega** ("Brasília, às sextas", rótulo "esta sexta" no seletor de fornada), as **faixas de frete** (R$6/R$10/R$14, grátis >R$150) e os **valores de evento** (R$99→R$64,90/pessoa, garçom R$250). O motor de entrega já é config-driven (`dias_semana_entrega`, NAPO-004), mas os textos não derivam dela. Quando o frete (NAPO-005) e a gestão no admin (NAPO-008) existirem, essas superfícies do site devem **ler** a config em vez de repetir números — senão ligar um segundo dia de entrega ou reajustar frete exige editar copy. Registrado em 2026-08-17. **Origem:** Gate Visual B do NAPO-003 (PM perguntou como escalar dias de entrega e tornar frete/evento gerenciáveis).
- [ ] **Indicador de precificação de frete no admin** (combustível + parâmetros) — um assistente que sugere o frete por faixa a partir de custo real: preço do combustível ÷ consumo + desgaste por km, distância **rodoviária** ×2, dividido pela **densidade da rota** (entregas por viagem — referência NAPO-005: R$ 9,60/entrega em rota de 10), mais parcela do entregador e margem alvo; com **alerta quando a faixa cobra abaixo do custo** (o mesmo erro que a fórmula `km×2÷qtd` rejeitada cometia). Encaixa no **"simulador de viabilidade de frete"** já previsto nas notas do NAPO-008. Registrado em 2026-08-17. **Origem:** Gate Visual B do NAPO-003.

- [ ] **Ranking das "mais pedidas" derivado de venda real** — hoje `ranking_mais_pedidas` é preenchido à mão na migration de catálogo (1 Calabresa · 2 Peito de Peru com Gorgonzola · 3 Frango c/ Catupiry). O PM pediu que a home ordenasse pelo que mais vende, mas não existe pedido no banco até o NAPO-006 — e um ranking cravado envelhece calado: quando a preferência mudar, a home continua afirmando um fato que deixou de ser verdade. Quando houver histórico de venda, derivar de uma janela móvel (ex.: 90 dias) com o valor manual como override do admin (NAPO-008). Registrado em 2026-08-17. **Origem:** bloco C do NAPO-003. **Depende de NAPO-006.**

- [ ] **Recusa de telefone duplicado dizer o motivo em desenvolvimento** — a RN do NAPO-002 recusa **cegamente** quando o número pertence a outra conta, para o endpoint não virar oráculo de enumeração de clientes. Em produção isso está certo; em desenvolvimento custa caro — o PM perdeu tempo achando que o código `123456` estava quebrado quando o que barrava era o telefone já pertencer a outro perfil. A ideia é a mensagem dizer o motivo **só** quando `WHATSAPP_PROVIDER=fake`, na mesma chave que já decide canal e código fixo — sem criar um segundo interruptor que alguém possa ligar em produção por engano. Registrado em 2026-09-06. **Origem:** validação do Gate Visual B do NAPO-025, quando o PM tentou criar uma segunda conta com o próprio telefone. **Exige revisão de spec NAPO-002 antes de promover** — mexe numa regra cuja motivação é de segurança.

---


---

- [ ] **E-mail transacional de pedido: confirmação e lembrete de Pix** — hoje **nenhum e-mail é enviado**. O cliente paga e a única confirmação que ele tem é a tela; fechou a aba, não sobra nada. Duas mensagens distintas: **confirmação** quando a cobrança aprova (com dia de entrega, itens e endereço) e **lembrete** enquanto um Pix segue pendente dentro dos 30 minutos — sem lembrete, o cliente que fecha a aba perde a vaga sem saber. **Depende do SMTP customizado via Resend**, que já está em 💡 e bloqueia o NAPO-021. Quando o WhatsApp existir (NAPO-015), a mesma decisão de "o que avisar e quando" deve valer para os dois canais — escrever a regra duas vezes é como as mensagens divergem. Registrado em 2026-09-06. **Origem:** PM ao ver o fluxo de pagamento completo no NAPO-025.

- [ ] **Impressora térmica na loja: todo pedido novo sai em papel** — a cozinha precisa do pedido impresso para preparar e separar, e o gatilho tem que ser **todo pedido, de qualquer origem**: site, balcão, WhatsApp, iFood e 99food. É isso que torna a ideia dependente da espinha de cobrança e do registro de venda (NAPO-026) — sem um lugar único onde a venda nasce, seriam cinco integrações de impressão. A decisão técnica principal é **como a impressora é alcançada**: rede (IP fixo, o servidor imprime sozinho) × USB/Bluetooth (exige uma máquina de pé na loja com o sistema aberto). Registrado em 2026-09-06. **Origem:** PM durante a validação do NAPO-025.

- [ ] **Alerta sonoro de pedido novo no admin** — com o sistema aberto numa aba, a chegada de um pedido toca um aviso, para a loja não depender de alguém olhar a tela. Vale para todo pedido, como a impressão. Dois pontos que decidem se funciona: navegador **bloqueia áudio sem interação prévia** do usuário (precisa de um gesto para "armar" o som), e aba em segundo plano recebe menos ciclos — o aviso precisa sobreviver a isso. Anda junto da impressão: as duas são reações ao mesmo evento "pedido novo", e faz sentido nascerem da mesma fonte. Registrado em 2026-09-06. **Origem:** PM durante a validação do NAPO-025.

---

## ⏸️ Bloqueados (Aguardando externo)

_Itens com bloqueio externo (espera de terceiro, decisão, dependência fora do controle)._

- [ ] **NAPO-018** Contador: anexo do Simples e atividade mista
  - **Bloqueado por:** definição do contador (congelado industrializado vs. fresca no balcão — o Simples exige a segregação na declaração mensal)
  - **Desde:** 2026-08-10

- [ ] **NAPO-019** Certificado digital A1
  - **Bloqueado por:** emissão junto à certificadora; pré-requisito da emissão fiscal (NAPO-011)
  - **Desde:** 2026-08-10

- [ ] **NAPO-020** Ensaio de fotografia dos produtos
  - **Bloqueado por:** agendamento com fotógrafo — **restam 3 produtos**: Lombo Canadense, Massa doce e Massa salgada
  - **Desde:** 2026-08-10
  - **⬇️ Deixou de bloquear o NAPO-003 (2026-08-13):** o PM indicou `docs/images/ensaio/` com fotos utilizáveis de 9 dos 12 produtos, mais forno e produção. As 9 já entraram no contrato visual, cortadas em quadrado e comprimidas. Os 3 restantes nascem com placeholder na mesma proporção. **Briefing das que faltam:** top-down, pizza centralizada, fundo indiferente (o recorte circular apara o entorno).

---

## ✅ Concluídos

_Histórico — adicionar mais recentes NO TOPO._

- [x] **NAPO-025** Espinha de cobrança: cobrança como entidade e pagamento no site sem sair dele · concluído 2026-09-06 · [`docs/specs/025-espinha-cobranca/`](docs/specs/025-espinha-cobranca/)
  - **Cobrança virou entidade de primeira classe.** Um pedido tem 0..n cobranças, e `situacao_pagamento` é **derivada** — não existe no sistema um caminho que marque um pedido como pago. Campo mantido por trigger foi descartado de propósito: é o mesmo esquecimento com outro culpado.
  - **O eixo do dinheiro saiu do eixo da entrega (RN3).** `status` passou a descrever só o ciclo do que foi vendido, e `vagas_ocupadas` deixou de conhecer o vocabulário de pagamento: ocupa quem não foi encerrado. É isso que torna expressável o pedido de balcão pago na entrega — o NAPO-026 não teria como existir sem essa separação.
  - **A armadilha do bloco era a contagem dupla.** Com pagamento fora do status, "todo pedido vivo + toda reserva viva" cobraria a mesma vaga duas vezes. O desempate virou o vínculo `reservas.pedido_id`; `snapshot.ts` mudou junto, porque divergir dele faz a vitrine oferecer a vaga que o checkout recusa.
  - **Checkout Bricks no nosso domínio (ADR-0001):** o cliente não sai do site. `POST /api/pedidos` parou de tocar o gateway — reserva e grava; quem recebe o token do Brick é a rota nova `POST /api/pagamentos`. Aprovar não é confirmar: quem confirma continua sendo o webhook (RN6).
  - **O defeito que originou a spec foi corrigido e provado no gateway real:** notificação de pagamento desconhecido devolve 502 **com** a linha em `pagamento_eventos`, onde antes era 500 sem rastro nenhum.
  - **Quatro defeitos só apareceram porque o gateway foi exercitado de verdade**, e nenhum seria pego por mock: o formato de data do Postgres que derrubava **todo** pagamento, o `catch` cego que escondia a causa, a mensagem que culpava o cartão por falha nossa, e o Brick azul em vez de amarelo.
  - **`binary_mode` em cartão** (decisão do PM): uma análise que resolve em horas não cabe numa reserva de 30 minutos. O cliente leva um não imediato e ainda dá tempo de tentar outro cartão ou Pix dentro do prazo.
  - 434 testes Vitest + 145 pgTAP. **RN20 fechou com 3 de 6 caminhos** no Mercado Pago real (recusa, Pix pendente, assinatura inválida); os três de aprovação viraram dívida — a conta de teste manda todo cartão para análise antifraude, e não há combinação que contorne. Estreiam no NAPO-021.
  - **Efeito colateral do caminho:** corrigido o "Sair" do menu, que não deslogava desde o NAPO-002 — o `<form>` vivia dentro do item do Radix e era desmontado antes de a submissão terminar.

- [x] **NAPO-006** Carrinho e checkout com Mercado Pago · concluído 2026-09-04 · [`docs/specs/006-checkout/`](docs/specs/006-checkout/)
  - Carrinho **anônimo** no navegador (RN1): adicionar não pede login e não reserva vaga — quem reserva é o clique em pagar, por 30 minutos. Seis sacolas abandonadas não podem esgotar a fornada de quem ia pagar.
  - **A ordem do checkout é a decisão:** revalida → reserva → grava pedido → cria cobrança. A reserva vem antes da cobrança porque vaga vendida duas vezes é pior que cobrança não criada; a preferência vem por último porque é o único passo irreversível fora do nosso banco. Gateway fora do ar libera a reserva e expira o pedido **na mesma requisição** — indisponibilidade de terceiro não prende o gargalo do negócio por meia hora.
  - **O webhook não confia em nada do corpo além do id.** Confere a assinatura (HMAC do manifesto, comparação em tempo constante), busca o pagamento na API do Mercado Pago e compara o valor com o total do pedido. Idempotência é do banco, por índice único parcial em `mp_payment_id`: duas notificações simultâneas viram violação de constraint, não dois consumos de capacidade.
  - **Dinheiro que entrou não é recusado (RN11):** dia inviável nasce `pago` com veredito gravado e alerta, para a casa resolver com uma ligação. A viabilidade é avaliada **abatendo a reserva do próprio pedido** — sem isso o cliente disputaria a vaga contra si mesmo.
  - `vagas_ocupadas` reescrita para somar reserva viva **e** pedido ativo (RN12): é a função que a vitrine lê, então errar aqui quebraria o site inteiro, não só o checkout — coberta por pgTAP antes de qualquer código de aplicação.
  - Gateway atrás de `PortaPagamento` (três métodos): `PAGAMENTO_PROVIDER=fake` fecha o fluxo inteiro sem túnel, e trocar de gateway vira escrever um adaptador. Ambiente troca por variável, nunca por edição de código.
  - **Ficha da fornada** como topo do resumo (direção A do Gate Visual A): o que o cliente compra é uma vaga numa fornada de um dia, não "3 pizzas" — é a leitura literal do gargalo declarado na arquitetura.
  - 400 testes Vitest + 120 pgTAP. Migration `0015` acrescentou auditoria à confirmação (RN21), aprovada fora do Mapa no checkpoint pós-H.
  - **Achados do Gate Visual B corrigiram NAPO-002 e NAPO-003 também:** checkout abria sem telefone validado, o retorno se perdia nos desvios (validar telefone, cadastrar endereço), telas sem saída, `ring-offset` desenhando risco escuro na borda de todo botão amarelo, e `cursor: default` do reset do Tailwind v4. Regra nova em `ARCHITECTURE.md` §2.2.3: nenhuma tela exibe erro padrão de HTML ou de terceiro. Tabela completa em `plan.md`.
  - **Não foi exercitado com o Mercado Pago real** — exige túnel público e credenciais de teste (`ARCHITECTURE.md` §6.1). Virou o **NAPO-023** em 2026-09-04 (antes era tratado como pré-requisito do NAPO-021).

- [x] **NAPO-005** Endereços e frete por faixa de distância · concluído 2026-08-18 · [`docs/specs/005-enderecos-frete/`](docs/specs/005-enderecos-frete/)
  - Cadastro de endereço em **duas etapas**: texto primeiro, confirmação da posição depois, com pin fixo no centro e o mapa se movendo embaixo. A página única aprovada no Gate Visual A foi superada em execução (`drift.md`): apresentado como elemento opcional entre nove campos, o mapa não é usado — e pin no meio da quadra não gera reclamação, gera **viagem perdida numa rota de dez paradas**.
  - **A régua de distância fica colada à confirmação e recalcula ao vivo:** mover o mapa move o dinheiro, e é isso que dá motivo para olhar. `POST /api/enderecos/medida` mede sem geocodificar de novo — uma chamada por ajuste, com espera de 600 ms e piso de 30 m.
  - Frete é decisão pura em `packages/core` (RN16), chamada igual pelo card da lista, pela etapa de confirmação e pelo futuro checkout. A última faixa fecha à direita porque 12,00 km é atendido e precisava de preço; fora de área devolve `null`, nunca R$ 0,00 — frete zero silencioso é o prejuízo que não aparece no painel.
  - **RLS por dono com políticas separadas por comando:** equipe lê para suporte e separação de entrega, só o dono escreve. Privilégios de `DELETE` e de anônimo **revogados**, não apenas deixados sem política — a RN15 vira erro de privilégio, e um `for all` acrescentado por descuido amanhã não reabre o caminho.
  - Distância é rodoviária, medida no servidor e gravada uma vez (RN12); rota indisponível cai para linha reta × fator **sempre marcada** (RN11). O corpo da requisição não tem campo de distância — o cliente não tem como escolher a própria faixa.
  - `POST /api/frete` já está no ar como o contrato que o NAPO-006 consome. 290 testes Vitest + 70 pgTAP. T18 verificado no bundle real: chave de servidor e `service_role` ausentes, chave de navegador presente.
  - **Pendência conhecida:** a `GOOGLE_MAPS_SERVER_KEY` do PM está com restrição por referrer e o Google recusa — a geocodificação cai no caminho degradado até a chave ser recriada sem restrição de aplicativo.

- [x] **NAPO-003** Site público, catálogo e SEO · concluído 2026-08-17 · [`docs/specs/003-site-catalogo/`](docs/specs/003-site-catalogo/)
  - Vitrine `/sabores`, 12 páginas de produto em SSG (`dynamicParams=false` — slug desconhecido ou inativo cai em 404 sem tocar o banco), home com storytelling sobre o eixo "Longa fermentação. Assada na pedra. Em casa, só aquecer.", `/como-aquecer`, `/eventos` e as páginas legais provisórias.
  - **Catálogo é schema, não conteúdo solto:** preço mora na faixa (reajustar é um UPDATE, não doze), alérgeno é enum (grafia divergente é alérgeno invisível), e a RN2 virou `CHECK` no banco — publicar produto sem rotulagem completa é impossível, não improvável, e a regra já vale para o admin do NAPO-008 e para a NFC-e do NAPO-011.
  - Primeira superfície do banco exposta a **anônimo**: leitura pública só de categorias, faixas e produtos ativos; produto inativo é invisível (URL indexada de descontinuada não vende o que não existe). Leitura de SSG usa client anônimo sem cookies — `cookies()` tornaria a página dinâmica e mataria o SSG.
  - Disponibilidade ao vivo do NAPO-004 entra como **ilha cliente** sobre página estática, com uma única busca compartilhada por contexto e estado da fornada na querystring via `history.replaceState`. JSON-LD `Product`+`Offer` usa snapshot de build (o buscador lê o marcado, não o vivo) e `Restaurant` no layout.
  - Seed de produção com a rotulagem real dos 12 produtos (550 g, 90 dias, alérgenos e precaucional por bancada), ids cravados para o produto ser a mesma linha nos três ambientes. 152 testes Vitest + 55 pgTAP.
  - **Não vai ao ar aqui** — publicação é NAPO-021. Pendências conhecidas: fotos de 3 produtos (NAPO-020) e duas conferências de rotulagem anotadas nas notas do NAPO-021.

- [x] **NAPO-002** Autenticação, papéis e gate de telefone por WhatsApp · concluído 2026-08-11 · [`docs/specs/002-auth-gate-telefone/`](docs/specs/002-auth-gate-telefone/)
  - Magic Link e Google pelo Supabase Auth, perfil criado no callback (nasce sempre `cliente`), destino decidido no servidor por papel, e guarda de rota em duas camadas: middleware confere sessão, layout de servidor confere papel e telefone **contra o banco** — claim em JWT ficaria velha e barraria quem acabou de validar.
  - Gate de telefone por OTP no WhatsApp: código de 6 dígitos guardado como HMAC com pepper fora do banco, comparação em tempo constante, tetos por número e por IP aplicados **antes** do envio (cada mensagem é dinheiro pago à Meta) e recusa cega quando o número é de outra conta, para o endpoint não virar oráculo de enumeração de clientes.
  - Consentimento versionado com IP, gravado antes da conclusão do cadastro; override de admin e promoção de papel como funções `SECURITY DEFINER` com auditoria atômica, exercitadas por `scripts/admin.mjs`.
  - **Inaugura a base de UI do projeto:** Tailwind v4, tokens completos, 7 primitivos shadcn, o pattern `<AuthCard>` e o componente `<Marca>` — herdados pelo NAPO-003.
  - 119 testes Vitest + 43 pgTAP. Divergência do preview aprovado registrada em `drift.md` (identidade visual real substituiu a marca provisória); regra permanente de marca em `ARCHITECTURE.md` §2.2.2.
  - **Não sobe em produção sem NAPO-017** (elegibilidade do template de autenticação na Meta) **nem sem o SMTP customizado** capturado em 💡 Ideias — sem ele o Magic Link não sai fora do ambiente local.

- [x] **NAPO-004** Motor de disponibilidade (calendário, cutoff, dois tetos) · concluído 2026-08-10 · [`docs/specs/004-motor-disponibilidade/`](docs/specs/004-motor-disponibilidade/)
  - Cutoff derivado com recuo por dia sem produção, horizonte deslizante com buffer, CTP/ATP, dois tetos (forno e freezer) e sub-teto de massa — tudo em `packages/core`, 30 testes determinísticos. Calendário e tetos configuráveis (`config_operacao`, entrega sexta, produção seg–sex). Reserva de 15 min atômica por advisory lock, sem `pg_cron`. `GET /api/disponibilidade` e `POST /api/disponibilidade/reserva`.
  - **RN12/RN13 entregues como decisão pura** (`avaliarViabilidade`, `devolucaoPorCancelamento`): a tabela `pedidos` é de NAPO-006, que vai plugá-las no webhook. Ver `drift.md`.
- [x] **Tooling: sincronia de banco entre máquinas** · concluído 2026-08-10 — git hooks versionados (`.githooks/post-merge` + `post-rewrite`) armados no `pnpm install`; todo `git pull` com migration nova roda `migration up` + regenera tipos no Supabase local. Degrada com aviso se o stack estiver desligado ou se uma migration foi reescrita (sugere `db:reset`). DevX, sem spec.
- [x] **NAPO-001** Fundação: monorepo, Next.js 15, Supabase local e CI · concluído 2026-08-10 · [`docs/specs/001-fundacao/`](docs/specs/001-fundacao/)
  - Monorepo pnpm (`apps/web` + `packages/core|db|ui`), `packages/core` puro garantido por lint. Migrations `0001/0002` com RLS deny-by-default, enum de role e trigger anti-auto-promoção (validado por pgTAP). `env.ts` (Zod) mantendo `service_role` fora do browser, helper `tempo.ts` fixado em `America/Sao_Paulo`, CI em dois jobs. Publicação (staging/prod) permanece em NAPO-021.
- [x] **Setup do kit ORIA no projeto** · concluído 2026-08-10
- [x] **Spec do R1 (e-commerce) escrita e revisada** · concluído 2026-08-10 · `docs/superpowers/specs/2026-08-10-napo-r1-ecommerce-design.md`

---

## ❌ Cancelados

_Itens descartados. IDs permanecem reservados (não reciclar)._

- [x] **Como um lead de evento entra no pipeline antes do bot existir** · **cancelado 2026-09-06** · motivo: absorvida pela ideia "Orçamento de eventos online (simulador + captação de lead)", que resolve a porta de entrada e diz isso no próprio texto. Manter as duas faria o backlog prometer duas coisas onde há uma. Nunca teve ID.

- [x] **NAPO-023** Pagamento fim a fim com Mercado Pago real (ambiente de desenvolvimento) · **absorvido pelo NAPO-025** em 2026-09-05
  - Nasceu em 2026-09-04 para exercitar o caminho real do Mercado Pago, que o NAPO-006 fechou com `PAGAMENTO_PROVIDER=fake`. Ao especificá-lo, o PM levantou que o cliente **não deve sair do site para pagar** — e o Checkout Pro só existe em redirect desde que o modal foi descontinuado ([ADR-0001](docs/adr/0001-checkout-bricks.md)). Exercitar o Checkout Pro para trocá-lo em seguida seria pagar a integração duas vezes, então o escopo inteiro passou para o NAPO-025, agora sobre Checkout Bricks. **ID reservado, não reciclar.**

_(Nenhum outro item cancelado. Duas propostas foram rejeitadas antes de virar item de backlog e estão documentadas em `docs/roadmap-napo-decisoes.md`: a fórmula de frete `km × 2 ÷ qtd` — cobrava R$ 38,40 numa pizza a 12 km — e virar integradora homologada de iFood/99food.)_

---

## 📊 Legenda de Seções

| Seção           | Significado                       | Quem move                                        |
| --------------- | --------------------------------- | ------------------------------------------------ |
| 🟢 Em Andamento | Trabalho ativo agora (máx 2-3)    | Agente ao iniciar                                |
| 🟡 Próximos     | Ordem definida, próximos na fila  | Humano prioriza                                  |
| 🔵 Backlog      | Conhecidos, prioridade flexível   | Humano ou agente                                 |
| 💡 Ideias       | Brutas, não avaliadas             | Qualquer um adiciona                             |
| ⏸️ Bloqueados   | Esperando externo                 | Agente move quando bloqueio externo é confirmado |
| ✅ Concluídos   | Histórico (mais recentes no topo) | Agente ao concluir spec                          |
| ❌ Cancelados   | Descartados                       | Humano decide                                    |
