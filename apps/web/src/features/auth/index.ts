/**
 * Feature de autenticação — expõe só o que rotas, layouts e middleware
 * consomem; o resto é interno (ARCHITECTURE §3.2).
 */
export {
  areaDaRota,
  caminhoInternoSeguro,
  decidirAcesso,
  destinoAposLogin,
  destinoPorPapel,
  resolverDestino,
  rotaExigeSessao,
  ROTA_ENTRAR,
  ROTA_VALIDAR_TELEFONE,
  type Acesso,
  type AreaProtegida,
  type Papel,
  type PerfilSessao,
} from './destino';

export { carregarPerfilDaSessao, exigirAcesso, garantirPerfil } from './services/sessao';
