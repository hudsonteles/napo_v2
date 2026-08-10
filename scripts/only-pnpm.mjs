// Barra `npm install` / `yarn install` neste repositório — só pnpm.
//
// Substitui `npx -y only-allow pnpm`: o npx é um binário do npm e reescreve
// `npm_config_user_agent` para "npm/..." antes de executar o pacote, então o
// only-allow acusava npm mesmo quando quem rodava era o pnpm (reproduzido no
// Windows com npm 10+). Aqui o script é executado direto pelo gerenciador que
// está instalando, e o user agent que ele lê é o verdadeiro.
//
// Bônus: sem download em tempo de install — funciona offline e não depende da
// rede para uma verificação de duas linhas.
const ua = process.env.npm_config_user_agent ?? '';
const gerenciador = ua.split('/')[0];

if (gerenciador && gerenciador !== 'pnpm') {
  console.error(`
╔═════════════════════════════════════════════════════════════╗
║                                                             ║
║   Este projeto usa pnpm. Rode "pnpm install".               ║
║                                                             ║
║   Detectado: ${gerenciador.padEnd(47)}║
║   Sem pnpm? Instale com "npm i -g pnpm".                    ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}
