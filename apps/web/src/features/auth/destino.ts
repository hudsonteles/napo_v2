import type { Database } from '@napo/db';

export type Papel = Database['public']['Enums']['user_role'];

export interface PerfilSessao {
  id: string;
  papel: Papel;
  telefoneValidado: boolean;
}

export type AreaProtegida = 'conta' | 'admin' | 'checkout';

export type Acesso =
  | { permitido: true }
  | { permitido: false; motivo: 'sem-sessao' | 'telefone-pendente' | 'sem-permissao' };

export const ROTA_ENTRAR = '/entrar';
export const ROTA_VALIDAR_TELEFONE = '/validar-telefone';

/**
 * RN5. Atendente e cozinha deveriam cair na fila de produção, que só nasce no
 * NAPO-012 (KDS); até lá o painel é a única tela de equipe que existe.
 */
const DESTINO_POR_PAPEL: Record<Papel, string> = {
  cliente: '/conta',
  atendente: '/admin',
  cozinha: '/admin',
  gerente: '/admin',
  admin: '/admin',
};

/** Segmento raiz → área protegida. RN1: o que não está aqui é público. */
const AREA_POR_SEGMENTO: Record<string, AreaProtegida> = {
  conta: 'conta',
  admin: 'admin',
  checkout: 'checkout',
};

const PAPEIS_DE_EQUIPE: readonly Papel[] = ['atendente', 'cozinha', 'gerente', 'admin'];

export function destinoPorPapel(papel: Papel): string {
  return DESTINO_POR_PAPEL[papel];
}

/**
 * Destino pretendido só é aceito como **caminho relativo interno** (RN5, T31).
 * Parâmetro de destino é o vetor clássico de open redirect: sem esta guarda,
 * `?proximo=https://site-falso` transforma o domínio da Napo em trampolim de
 * phishing. A barra invertida entra na recusa porque parte dos navegadores a
 * normaliza para barra antes de resolver a URL.
 */
export function caminhoInternoSeguro(proximo: string | null | undefined): string | null {
  if (!proximo) return null;
  if (!proximo.startsWith('/')) return null;
  if (proximo.startsWith('//')) return null;
  if (proximo.includes('\\')) return null;
  return proximo;
}

export function resolverDestino({
  papel,
  proximo,
}: {
  papel: Papel;
  proximo: string | null | undefined;
}): string {
  return caminhoInternoSeguro(proximo) ?? destinoPorPapel(papel);
}

/** Área protegida do caminho, ou `null` quando a rota é pública (RN1). */
export function areaDaRota(pathname: string): AreaProtegida | null {
  const segmento = pathname.split('/')[1] ?? '';
  return AREA_POR_SEGMENTO[segmento] ?? null;
}

/**
 * RN2. O gate de telefone também exige sessão — sem ela não há perfil a validar,
 * e a tela existe justamente para quem já entrou.
 */
export function rotaExigeSessao(pathname: string): boolean {
  if (pathname === ROTA_VALIDAR_TELEFONE || pathname.startsWith(`${ROTA_VALIDAR_TELEFONE}/`)) {
    return true;
  }
  return areaDaRota(pathname) !== null;
}

/**
 * RN2, RN3, RN4. O papel decide o acesso; o telefone decide a conclusão. Equipe
 * não é barrada pelo gate — exceto no checkout, onde o número não é credencial
 * e sim o contato que o entregador vai ligar.
 */
export function decidirAcesso(perfil: PerfilSessao | null, area: AreaProtegida): Acesso {
  if (!perfil) return { permitido: false, motivo: 'sem-sessao' };

  const ehEquipe = PAPEIS_DE_EQUIPE.includes(perfil.papel);

  if (area === 'admin' && !ehEquipe) {
    return { permitido: false, motivo: 'sem-permissao' };
  }

  const exigeTelefone = area === 'checkout' || !ehEquipe;
  if (exigeTelefone && !perfil.telefoneValidado) {
    return { permitido: false, motivo: 'telefone-pendente' };
  }

  return { permitido: true };
}

/**
 * Para onde a pessoa vai assim que a sessão existe. Cliente sem telefone é
 * levado ao gate carregando o destino pretendido, para retomá-lo ao concluir.
 */
export function destinoAposLogin(perfil: PerfilSessao, proximo: string | null | undefined): string {
  const destino = resolverDestino({ papel: perfil.papel, proximo });
  const area = areaDaRota(destino) ?? (perfil.papel === 'cliente' ? 'conta' : 'admin');
  const acesso = decidirAcesso(perfil, area);

  if (!acesso.permitido && acesso.motivo === 'telefone-pendente') {
    return `${ROTA_VALIDAR_TELEFONE}?proximo=${encodeURIComponent(destino)}`;
  }

  return destino;
}
