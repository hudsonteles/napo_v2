import { describe, expect, it } from 'vitest';

import { rotuloAlergeno, temAlergenoCritico, textoContem } from './alergenos';

describe('alérgenos (RN3/RN4)', () => {
  it('grafia canônica com acento vem do rótulo, não do enum', () => {
    expect(rotuloAlergeno('avela')).toBe('avelã');
    expect(rotuloAlergeno('gluten')).toBe('glúten');
    expect(rotuloAlergeno('crustaceos')).toBe('crustáceos');
  });

  it('T12 — texto "Contém …" nomeia cada alérgeno em ordem', () => {
    expect(textoContem(['avela', 'gluten', 'leite', 'soja'])).toBe(
      'Contém avelã, glúten, leite, soja',
    );
    expect(textoContem([])).toBe('');
  });

  it('avelã/amendoim/castanhas elevam o aviso; glúten e leite não', () => {
    expect(temAlergenoCritico(['avela', 'gluten', 'leite'])).toBe(true);
    expect(temAlergenoCritico(['amendoim'])).toBe(true);
    expect(temAlergenoCritico(['gluten', 'leite', 'soja'])).toBe(false);
  });
});
