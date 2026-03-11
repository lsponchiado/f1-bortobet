import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from '@/components/Navbar';
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

  const [raceSession, drivers, qualifyingSession] = await Promise.all([
    prisma.session.findFirst({
      where: { type: 'RACE', seasonId, grandPrixId: gpId },
      include: { raceConfig: true },
    }),
    prisma.driver.findMany({
      where: { enabled: true },
      include: { team: true },
      orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }]
    }),
    prisma.session.findFirst({
      where: { type: 'QUALIFYING', seasonId, grandPrixId: gpId },
    }),
  ]);

  if (!raceSession) redirect("/");

  const qualifyingEntries = qualifyingSession
    ? await prisma.sessionEntry.findMany({
        where: { sessionId: qualifyingSession.id },
        select: { driverId: true, finishPosition: true },
      })
    : [];
  const gridPositions: Record<number, number> = Object.fromEntries(
    qualifyingEntries.map((e) => [e.driverId, e.finishPosition])
  );

  const [existingBet, doublePointsTokensUsed] = await Promise.all([
    prisma.betRace.findFirst({
      where: {
        sessionId: raceSession.id,
        userId,
      },
      include: {
        predictedGrid: {
          orderBy: { predictedPosition: 'asc' }
        }
      }
    }),
    prisma.betRace.count({
      where: {
        userId,
        sessionId: { not: raceSession.id },
        session: { seasonId },
        doublePoints: true,
      }
    }),
  ]);

  const initialBet = existingBet ? {
    id: existingBet.id,
    gridIds: existingBet.predictedGrid.map(item => item.driverId),
    fastestLapId: existingBet.predictedGrid.find(item => item.fastestLap)?.driverId || null,
    allInDriverId: existingBet.driverId ?? null,
    doublePoints: existingBet.doublePoints ?? false,
    predictedSC: existingBet.predictedSC,
    predictedDNF: existingBet.predictedDNF,
  } : undefined;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden">
      <Navbar username={(session.user as any).username || session.user.name || 'User'} />
      <BetRaceClient
        drivers={drivers}
        sessionId={raceSession.id}
        initialBet={initialBet}
        doublePointsTokensUsed={doublePointsTokensUsed}
        allowDoublePoints={raceSession.raceConfig?.allowDoublePoints ?? true}
        allowHailMary={raceSession.raceConfig?.allowHailMary ?? true}
        allowUnderdog={raceSession.raceConfig?.allowUnderdog ?? true}
        allowFreefall={raceSession.raceConfig?.allowFreefall ?? true}
        gridPositions={gridPositions}
      />
    </div>
  );
}
