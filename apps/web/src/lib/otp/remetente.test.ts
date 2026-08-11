import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RemetenteFake } from './remetente-fake';

describe('RemetenteFake (T46)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('escreve o código no log do servidor e não toca a rede', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const rede = vi.spyOn(globalThis, 'fetch');

    await new RemetenteFake().enviarCodigo('+5561991504477', '472913');

    expect(rede).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('472913');
  });
});
