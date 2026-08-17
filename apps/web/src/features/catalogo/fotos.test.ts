import { describe, expect, it } from 'vitest';

import { fotoDoProduto } from './fotos';

describe('fotoDoProduto (RN11)', () => {
  it('produto fotografado aponta para /produtos/{slug}.jpeg', () => {
    expect(fotoDoProduto('margherita')).toBe('/produtos/margherita.jpeg');
    expect(fotoDoProduto('nutella-com-avela')).toBe('/produtos/nutella-com-avela.jpeg');
  });

  it('T24 — sabor ainda sem ensaio devolve null (vira placeholder)', () => {
    expect(fotoDoProduto('lombo-canadense')).toBeNull();
    expect(fotoDoProduto('massa-salgada')).toBeNull();
    expect(fotoDoProduto('massa-doce')).toBeNull();
  });
});
