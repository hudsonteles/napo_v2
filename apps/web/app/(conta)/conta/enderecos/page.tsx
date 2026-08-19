import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';

import { descreverDiasDeEntrega, descreverRaio, type DiaSemana } from '@napo/core';
import { Button } from '@napo/ui/components/button';
import { Card } from '@napo/ui/components/card';

import { CardEndereco } from '@/features/enderecos/components/card-endereco';
import { carregarConfigDeArea, listarEnderecos, MAX_ENDERECOS_ATIVOS } from '@/features/enderecos';

export const metadata: Metadata = {
  title: 'Meus endereços — Napo',
  // Área logada não entra em buscador: é dado de cliente.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EnderecosPage() {
  const [enderecos, config] = await Promise.all([listarEnderecos(), carregarConfigDeArea()]);

  // RN17: a frase de cobertura é derivada do banco. Ligar o sábado ou esticar o
  // raio é UPDATE — nenhuma das duas informações está escrita neste arquivo.
  const quando = descreverDiasDeEntrega(config.diasDeEntrega as DiaSemana[]);
  const noLimite = enderecos.length >= MAX_ENDERECOS_ATIVOS;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Meus endereços</h1>
          {quando && (
            <p className="mt-2 text-sm text-texto-suave">
              Entregamos <span className="text-branco">{quando}</span> em Brasília, num raio de{' '}
              <span className="text-branco">{descreverRaio(config.raioKm)}</span> da cozinha.
            </p>
          )}
        </div>

        {enderecos.length > 0 && (
          <Button asChild={!noLimite} size="sm" largura="natural" disabled={noLimite}>
            {noLimite ? (
              <>
                <Plus className="h-4 w-4" /> Novo endereço
              </>
            ) : (
              <Link href="/conta/enderecos/novo">
                <Plus className="h-4 w-4" /> Novo endereço
              </Link>
            )}
          </Button>
        )}
      </div>

      {noLimite && (
        <Card className="mb-6 p-6 sm:shadow-none">
          <p className="font-semibold">Limite de {MAX_ENDERECOS_ATIVOS} endereços</p>
          <p className="mt-1 text-sm text-texto-suave">
            Você chegou ao limite. Desative um endereço que não usa mais para cadastrar outro.
          </p>
        </Card>
      )}

      {enderecos.length === 0 ? (
        <Card className="border-dashed border-borda-forte bg-transparent p-8 text-center sm:shadow-none">
          <MapPin className="mx-auto h-8 w-8 text-borda-forte" />
          <p className="mt-3 font-semibold">Nenhum endereço ainda</p>
          <p className="mt-1 text-sm text-texto-suave">
            Cadastre onde a pizza deve chegar e a gente já mostra o frete.
          </p>
          <div className="mt-4 flex justify-center">
            <Button asChild size="sm" largura="natural">
              <Link href="/conta/enderecos/novo">Cadastrar endereço</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {enderecos.map((endereco) => (
            <CardEndereco
              key={endereco.id}
              endereco={endereco}
              raioKm={config.raioKm}
              faixas={config.faixas}
              freteGratisCentavos={config.freteGratisCentavos}
            />
          ))}
        </div>
      )}
    </main>
  );
}
