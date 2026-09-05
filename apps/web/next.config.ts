import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Os pacotes internos do monorepo são TypeScript cru; o Next os transpila.
  transpilePackages: ['@napo/core', '@napo/db', '@napo/ui'],
  // O lint roda como passo próprio do CI (regra de fronteira RN7 incluída),
  // sobre todo o monorepo. Não duplicar aqui — evita o double-lint e o aviso
  // de plugin do Next, que não enxerga a config raiz.
  eslint: { ignoreDuringBuilds: true },
  // O webhook do Mercado Pago não alcança `localhost`, então em dev o app é
  // servido por um túnel. Sem liberar esse host, o Next 15 recusa as
  // requisições de desenvolvimento por virem de outra origem. O endereço vem
  // de env var, nunca cravado aqui: o túnel muda de dono e de máquina.
  allowedDevOrigins: process.env.DEV_TUNNEL_HOST ? [process.env.DEV_TUNNEL_HOST] : [],
};

export default nextConfig;
