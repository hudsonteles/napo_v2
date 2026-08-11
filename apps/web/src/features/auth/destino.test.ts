import { describe, expect, it } from 'vitest';

import {
  caminhoInternoSeguro,
  decidirAcesso,
  destinoPorPapel,
  resolverDestino,
  rotaExigeSessao,
  type PerfilSessao,
} from './destino';

function perfil(parcial: Partial<PerfilSessao> = {}): PerfilSessao {
  return {
    id: '00000000-0000-0000-0000-0000000000aa',
    papel: 'cliente',
    telefoneValidado: false,
    ...parcial,
  };
}

describe('destinoPorPapel (T6 — cada papel tem seu destino)', () => {
  it('leva o cliente para a conta', () => {
    expect(destinoPorPapel('cliente')).toBe('/conta');
  });

  it('leva todo papel de equipe para o painel', () => {
    expect(destinoPorPapel('atendente')).toBe('/admin');
    expect(destinoPorPapel('cozinha')).toBe('/admin');
    expect(destinoPorPapel('gerente')).toBe('/admin');
    expect(destinoPorPapel('admin')).toBe('/admin');
  });
});

describe('caminhoInternoSeguro (T31 — destino externo é ignorado)', () => {
  it('aceita caminho relativo interno', () => {
    expect(caminhoInternoSeguro('/conta/pedidos')).toBe('/conta/pedidos');
    expect(caminhoInternoSeguro('/conta?aba=abertos')).toBe('/conta?aba=abertos');
  });

  it('recusa URL absoluta e caminho protocol-relative', () => {
    expect(caminhoInternoSeguro('https://site-falso.com')).toBeNull();
    expect(caminhoInternoSeguro('//site-falso.com')).toBeNull();
    expect(caminhoInternoSeguro('http://localhost/conta')).toBeNull();
  });

  it('recusa o que não começa com barra, incluindo vazio e ausente', () => {
    expect(caminhoInternoSeguro('conta')).toBeNull();
    expect(caminhoInternoSeguro('')).toBeNull();
    expect(caminhoInternoSeguro(null)).toBeNull();
    expect(caminhoInternoSeguro(undefined)).toBeNull();
  });

  it('recusa barra invertida, que alguns navegadores tratam como barra', () => {
    expect(caminhoInternoSeguro('/\\site-falso.com')).toBeNull();
    expect(caminhoInternoSeguro('\\\\site-falso.com')).toBeNull();
  });
});

describe('resolverDestino (T7 — destino pretendido é preservado)', () => {
  it('honra o destino pretendido quando é interno', () => {
    expect(resolverDestino({ papel: 'cliente', proximo: '/conta/pedidos' })).toBe('/conta/pedidos');
  });

  it('cai no destino do papel quando o pretendido é externo (T31)', () => {
    expect(resolverDestino({ papel: 'cliente', proximo: 'https://site-falso.com' })).toBe('/conta');
    expect(resolverDestino({ papel: 'gerente', proximo: '//site-falso.com' })).toBe('/admin');
  });

  it('cai no destino do papel quando não há pretendido', () => {
    expect(resolverDestino({ papel: 'admin', proximo: null })).toBe('/admin');
  });
});

describe('rotaExigeSessao (T21, T22)', () => {
  it('deixa a navegação pública livre', () => {
    expect(rotaExigeSessao('/')).toBe(false);
    expect(rotaExigeSessao('/sabores')).toBe(false);
    expect(rotaExigeSessao('/entrar')).toBe(false);
    expect(rotaExigeSessao('/termos')).toBe(false);
  });

  it('exige sessão na conta, no painel, no checkout e no gate de telefone', () => {
    expect(rotaExigeSessao('/conta')).toBe(true);
    expect(rotaExigeSessao('/conta/pedidos')).toBe(true);
    expect(rotaExigeSessao('/admin')).toBe(true);
    expect(rotaExigeSessao('/checkout')).toBe(true);
    expect(rotaExigeSessao('/validar-telefone')).toBe(true);
  });

  it('não confunde prefixo com segmento', () => {
    expect(rotaExigeSessao('/contato')).toBe(false);
    expect(rotaExigeSessao('/administrativo-publico')).toBe(false);
  });
});

describe('decidirAcesso', () => {
  it('recusa quem não tem sessão (T22)', () => {
    expect(decidirAcesso(null, 'conta')).toEqual({ permitido: false, motivo: 'sem-sessao' });
    expect(decidirAcesso(null, 'admin')).toEqual({ permitido: false, motivo: 'sem-sessao' });
  });

  it('prende o cliente sem telefone no gate (T23)', () => {
    expect(decidirAcesso(perfil(), 'conta')).toEqual({
      permitido: false,
      motivo: 'telefone-pendente',
    });
  });

  it('libera o cliente já validado (T4)', () => {
    expect(decidirAcesso(perfil({ telefoneValidado: true }), 'conta')).toEqual({ permitido: true });
  });

  it('não barra a equipe pelo gate de telefone (T5)', () => {
    for (const papel of ['atendente', 'cozinha', 'gerente', 'admin'] as const) {
      expect(decidirAcesso(perfil({ papel }), 'admin')).toEqual({ permitido: true });
    }
  });

  it('recusa o cliente no painel sem fingir que ele não tem sessão (T25)', () => {
    expect(decidirAcesso(perfil({ telefoneValidado: true }), 'admin')).toEqual({
      permitido: false,
      motivo: 'sem-permissao',
    });
  });

  it('exige telefone de qualquer papel no checkout (T24)', () => {
    expect(decidirAcesso(perfil({ papel: 'atendente' }), 'checkout')).toEqual({
      permitido: false,
      motivo: 'telefone-pendente',
    });
    expect(decidirAcesso(perfil({ papel: 'atendente', telefoneValidado: true }), 'checkout')).toEqual(
      { permitido: true },
    );
  });
});
