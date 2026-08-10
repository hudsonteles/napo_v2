import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Os pacotes internos do monorepo são TypeScript cru; o Next os transpila.
  transpilePackages: ['@napo/core', '@napo/db'],
  // O lint roda como passo próprio do CI (regra de fronteira RN7 incluída),
  // sobre todo o monorepo. Não duplicar aqui — evita o double-lint e o aviso
  // de plugin do Next, que não enxerga a config raiz.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
