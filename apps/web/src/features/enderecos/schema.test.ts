import { describe, expect, it } from 'vitest';

import { esquemaEndereco, exigeComplemento } from './schema';

const BASE = {
  apelido: 'Casa',
  cep: '70862030',
  logradouro: 'SQN 210 Bloco C',
  numero: 's/n',
  cidade: 'Brasília',
  uf: 'DF',
};

describe('T11 — complemento obrigatório em endereço de quadra (RN3)', () => {
  it('reconhece as quadras do Plano Piloto e do entorno', () => {
    expect(exigeComplemento('SQN 210 Bloco C')).toBe(true);
    expect(exigeComplemento('SHIS QI 15 Conjunto 4')).toBe(true);
    expect(exigeComplemento('SCS Quadra 2 Bloco C')).toBe(true);
    expect(exigeComplemento('QE 38 Conjunto L')).toBe(true);
    expect(exigeComplemento('CLN 405')).toBe(true);
  });

  it('reconhece condomínio e edifício', () => {
    expect(exigeComplemento('Condomínio Vivendas Bela Vista')).toBe(true);
    expect(exigeComplemento('Edifício Central')).toBe(true);
  });

  it('não exige em rua e rodovia comuns', () => {
    expect(exigeComplemento('Rua das Palmeiras')).toBe(false);
    expect(exigeComplemento('Rodovia DF-250, Km 18')).toBe(false);
    expect(exigeComplemento('Avenida Brasil')).toBe(false);
  });

  it('compara palavra inteira — "Quadrado" não é quadra', () => {
    expect(exigeComplemento('Rua do Quadrado')).toBe(false);
  });

  it('ignora acento e caixa', () => {
    expect(exigeComplemento('condominio das flores')).toBe(true);
  });

  it('bloqueia o cadastro de quadra sem complemento, apontando o campo', () => {
    const resultado = esquemaEndereco.safeParse(BASE);

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const problema = resultado.error.issues.find((i) => i.path[0] === 'complemento');
      expect(problema?.message).toContain('bloco e apartamento');
    }
  });

  it('aceita a mesma quadra com complemento', () => {
    expect(esquemaEndereco.safeParse({ ...BASE, complemento: 'Apto 302' }).success).toBe(true);
  });

  it('complemento em branco não conta como preenchido', () => {
    expect(esquemaEndereco.safeParse({ ...BASE, complemento: '   ' }).success).toBe(false);
  });

  it('T10 — rua comum passa sem complemento e com número "s/n"', () => {
    const resultado = esquemaEndereco.safeParse({
      ...BASE,
      logradouro: 'Rodovia DF-250, Km 18',
      numero: 's/n',
    });

    expect(resultado.success).toBe(true);
  });
});

describe('T17 — o contrato de entrada não tem distância (RN5)', () => {
  it('descarta distância e área enviadas pelo cliente', () => {
    const resultado = esquemaEndereco.safeParse({
      ...BASE,
      complemento: 'Apto 302',
      distanciaKm: 0.5,
      atendido: true,
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).not.toHaveProperty('distanciaKm');
      expect(resultado.data).not.toHaveProperty('atendido');
    }
  });
});

describe('validação de formato', () => {
  it('recusa CEP com máscara — o contrato é oito dígitos', () => {
    expect(esquemaEndereco.safeParse({ ...BASE, cep: '70862-030' }).success).toBe(false);
  });

  it('recusa coordenada fora do planeta', () => {
    expect(
      esquemaEndereco.safeParse({ ...BASE, complemento: 'Apto 302', lat: 100, lng: 0 }).success,
    ).toBe(false);
  });
});
