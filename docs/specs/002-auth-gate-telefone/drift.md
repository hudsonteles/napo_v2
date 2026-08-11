# 🔀 Drift: NAPO-002

Divergências entre o que a spec aprovada dizia e o que a implementação entregou.

---

## D1 — A marca do preview era provisória; a identidade real entrou no Gate Visual B

**Data:** 2026-08-11 · **Origem:** Gate Visual B, pedido do PM.

**O que a spec dizia:** o `preview.html` aprovado no Gate Visual A desenhava a marca
como um quadrado amarelo com a letra `N` seguido da palavra "Napo" em texto — uma
marca tipográfica improvisada, porque na data do preview não havia arquivo de
logotipo no repositório. O `design.md` §4.4.2 registrava esse bloco apenas como
"slot de marca do `<AuthCard>`".

**O que a realidade mostrou:** a Napo tem identidade visual pronta — logotipo em duas
versões, ícone e conjunto completo de favicons — que o PM disponibilizou em
`docs/images/` durante o Gate Visual B. Manter o `N` improvisado significaria
publicar o produto com uma marca que não é a da empresa, e ainda espalhar esse
improviso pelas telas que o NAPO-003 vai herdar.

**Decisão do PM:** usar a identidade real desde estas primeiras telas.

**O que mudou no código:**

- Componente novo `<Marca>` em `packages/ui/src/components/marca.tsx`, acrescentado
  ao catálogo de UI. Serve o PNG de `/public` com `width`/`height` intrínsecos — sem
  `next/image`, porque `packages/ui` não depende do Next (`ARCHITECTURE` §3.2) e a
  cota de transformação de imagem da Vercel é custo real (§4.5).
- `<AuthCard>` passou a compor `<Marca>` no lugar do bloco `N` + "Napo".
- Favicons, `apple-touch-icon`, `site.webmanifest` e `themeColor` ligados no
  `app/layout.tsx`.

**O que mudou na documentação:**

- `ARCHITECTURE.md` §2.2.2 — seção nova declarando a marca como regra inviolável,
  com a tabela de arquivos, a fonte da verdade (`docs/images/`) e a proibição de
  inventar marca. Vale para todo o produto, não só para esta spec.
- `design.md` §4.4.2 e §4.4.3 — `<Marca>` registrado entre os componentes do
  catálogo.

**O que NÃO mudou:** nenhum critério visual de aceite foi afetado. O logotipo ocupa a
mesma posição, com a mesma altura (36 px) do bloco que substituiu, dentro da mesma
moldura — o critério 7 ("a moldura é a mesma nas duas telas") continua valendo, e o
`preview.html` segue fiel em tudo o mais. O preview não foi reescrito de propósito:
ele é o registro histórico do que foi aprovado no Gate Visual A.
