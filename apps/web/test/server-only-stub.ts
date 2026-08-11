/**
 * Substituto do pacote `server-only` nos testes. Ele lança por padrão fora do
 * bundler do Next; a proteção real continua no build, que resolve a condição
 * `react-server`. Ver o alias em `vitest.config.ts`.
 */
export {};
