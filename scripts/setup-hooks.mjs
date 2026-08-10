// Aponta o Git para os hooks versionados em .githooks/ (git config
// core.hooksPath). Roda no `pnpm install` (script `prepare`), então cada máquina
// nova arma os hooks sozinha depois de `clone + pnpm install`.
//
// No-op silencioso fora de um repositório git (tarball, CI sem histórico, etc.)
// para nunca quebrar o install.
import { execSync } from 'node:child_process';

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
} catch {
  // Sem git disponível ou sem repositório — segue sem hooks, sem erro.
}
