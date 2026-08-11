/**
 * Superfície de servidor da feature de autenticação — o que rotas e layouts
 * consomem (ARCHITECTURE §3.2).
 *
 * O middleware e os componentes de cliente importam `./destino` diretamente, e
 * não por aqui, de propósito: este barrel arrasta os serviços de sessão, que
 * dependem de `next/headers` e não existem no edge nem no browser.
 */
export { destinoAposLogin, ROTA_ENTRAR, type PerfilSessao } from './destino';

export { carregarPerfilDaSessao, exigirAcesso, garantirPerfil } from './services/sessao';
