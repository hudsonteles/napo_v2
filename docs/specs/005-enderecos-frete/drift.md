# 🔀 Drift: o mapa vira etapa própria

**ID:** NAPO-005
**Registrado em:** 2026-08-18
**Detectado por:** PM, no Gate Visual B
**Status:** decidido — implementar

---

## A divergência

O `design.md` §4.4 e o `preview-formulario.html` aprovados no Gate Visual A colocam
o mapa como **um elemento entre outros nove**, numa página única, com o rótulo
"arraste o pin se precisar".

O PM tem observação de campo de uma versão anterior do produto: **apresentado como
recurso opcional, o mapa não é usado**. A pessoa preenche o texto, ignora o mapa e
salva. A consequência não é cosmética — é o pin no meio da quadra, e a entrega que
não chega no bloco certo.

## Por que a spec não pegou isso

A spec previu o problema e escolheu a mitigação errada. §4.5 diz:

> "O pin nasce onde o geocoding colocou, com instrução explícita. Mapa sem instrução
> é decoração: ninguém arrasta."

A conclusão está certa; o remédio (instrução) é fraco. Instrução não compete com
hierarquia: numa tela com nove campos e um botão de salvar, a atenção vai para o
botão. O que faz alguém conferir a posição é a conferência **ser a tarefa**, não
ter um rótulo melhor.

## Benchmark (2026-08-18)

| Produto | Padrão |
|---|---|
| iFood, Rappi | Texto → **tela dedicada** de confirmação, mapa cheio, uma ação primária |
| Uber, 99 | Mapa primeiro, texto derivado do pin (origem é "onde estou", não "onde moro") |
| Amazon | Só texto — entrega por transportadora, errar a porta custa pouco |

Dois achados que valem mais que a contagem de etapas:

- **Pin arrastável é o padrão errado em celular.** O alvo é pequeno e o dedo cobre
  o que a pessoa precisa ver. iFood, Uber e Google Maps usam **pin fixo no centro
  com o mapa se movendo embaixo**. O preview aprovado herdou o arraste sem exame.
- **Uma tela com uma única ação primária converte.** Não é preferência estética: é
  a ausência de concorrência por atenção.

## Opções apresentadas ao PM

| | Proposta | Veredito |
|---|---|---|
| **A** | Duas etapas: texto → mapa cheio com pin central e "Confirmar localização" | **Escolhida** |
| **B** | Uma tela, salvar travado até marcar "confirmei a posição" | Rejeitada — é "li e aceito os termos": a pessoa marca sem olhar, e o sistema passa a registrar como conferido o que ninguém viu. Pior que a omissão silenciosa |
| **C** | Uma tela, só trocar arraste por pin central | Rejeitada como solução isolada; o pin central foi **absorvido** pela opção A |

## Decisão

**Opção A, com o pin central da C.** Decidida pelo PM em 2026-08-18, dentro do
NAPO-005 — o endereço só vai a produção no NAPO-021, então não há dado real para
migrar e o custo de mudar agora é o menor que vai existir.

**Justificativa:** o custo do erro é assimétrico. Pin errado em quadra do Plano
Piloto não gera reclamação — gera **viagem perdida numa rota de dez paradas**, e o
custo de referência da própria spec é R$ 9,60 por entrega. Um clique a mais para o
cliente é barato; entrega que não chega custa margem e confiança.

## O que muda

| Documento | Mudança |
|---|---|
| `design.md` §4.4 | Preview do formulário deixa de ser contrato para a posição; entra `preview-etapa-mapa.html` |
| `design.md` §4.5 | A instrução deixa de ser a mitigação; a etapa própria passa a ser |
| `design.md` §3.2 | Endpoint novo de geocodificação, consumido pela etapa 2 |
| `tests.md` | T24 (pin além do limite) passa a exercitar a etapa 2; critérios visuais 4 e 5 são reescritos |

**Efeito colateral bom:** o §4.5 pedia que "o frete aparecesse no cadastro, não só
no checkout", e a página única não conseguia entregar isso — a medição é do
servidor e só existia ao salvar. Com a etapa 2, a distância e a faixa aparecem
antes da decisão, que era a intenção original.

## Custo

Geocodificação passa a acontecer na etapa 2 **e** ao salvar (o servidor não pode
confiar na coordenada que o cliente devolve — é a RN6 inteira). Vai de ~300 para
~600 chamadas/mês de Geocoding (franquia 10.000) e ~600 de Routes (franquia 5.000).
Custo permanece zero.

## Restrição que não pode ser perdida

`design.md` §4.7: **o mapa não pode ser o único caminho**. Arrastar mapa não é
operável por teclado, e cadastro que exige mouse exclui. Na etapa 2, confirmar
precisa ser possível sem tocar no mapa, e quem não consegue ajustar salva assim
mesmo — com o endereço marcado para conferência, que é o mesmo tratamento da
geocodificação sem resultado (RN11).
