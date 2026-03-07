import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import BetRaceClient from './BetRaceClient';

export default async function RaceBetPage({ 
  params 
}: { 
  params: Promise<{ seasonId: string; gpId: string }> 
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const resolvedParams = await params;
  const seasonId = parseInt(resolvedParams.seasonId, 10);
  const gpId = parseInt(resolvedParams.gpId, 10);

  // 1. Busca a corrida e os pilotos habilitados
  const [race, drivers] = await Promise.all([
    prisma.race.findFirst({
      where: { seasonId, grandPrixId: gpId }
    }),
    prisma.driver.findMany({
      where: { enabled: true },
      include: { team: true },
      orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }]
    })
  ]);

  if (!race) redirect("/");

  // 2. Busca a aposta existente usando o nome de relação 'predictedGrid'
  const existingBet = await prisma.betRace.findFirst({
    where: { 
      raceId: race.id,
      userId: userId 
    },
    include: {
      predictedGrid: {
        orderBy: { predictedPosition: 'asc' }
      }
    }
  });

  // 3. Formata os dados para o BetRaceClient
  // Extraímos os IDs de Volta Rápida e Favorito percorrendo os itens do grid
  const initialBet = existingBet ? {
    id: existingBet.id,
    gridIds: existingBet.predictedGrid.map(item => item.driverId),
    fastestLapId: existingBet.predictedGrid.find(item => item.fastestLap)?.driverId || null,
    favoriteId: existingBet.predictedGrid.find(item => item.favorite)?.driverId || null,
    predictedSC: existingBet.predictedSC,
    predictedDNF: existingBet.predictedDNF,
  } : undefined;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden">
      <Navbar username={session.user.username || session.user.name || "User"} />
      <BetRaceClient 
        drivers={drivers} 
        raceId={race.id} 
        initialBet={initialBet} 
      />
    </div>
  );
}