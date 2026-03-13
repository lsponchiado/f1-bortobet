import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from '@/components/Navbar';
import BetSprintClient from './BetSprintClient';
import BetSprintResultClient from './BetSprintResultClient';
import type { ResultVariant } from '@/components/DriverCard';

const DEFAULT_SPRINT_PTS: Record<number, number> = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

export default async function SprintBetPage({
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

  const [sprintSession, drivers, sprintQualifyingSession, seasonData] = await Promise.all([
    prisma.session.findFirst({
      where: { type: 'SPRINT', seasonId, grandPrixId: gpId },
    }),
    prisma.driver.findMany({
      where: { enabled: true },
      include: { team: true },
      orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }]
    }),
    prisma.session.findFirst({
      where: { type: 'SPRINT_QUALIFYING', seasonId, grandPrixId: gpId },
    }),
    prisma.season.findUnique({ where: { id: seasonId }, include: { config: true } }),
  ]);

  if (!sprintSession) redirect("/");

  const sprintQualifyingEntries = sprintQualifyingSession
    ? await prisma.sessionEntry.findMany({
        where: { sessionId: sprintQualifyingSession.id },
        select: { driverId: true, finishPosition: true },
      })
    : [];
  const gridPositions: Record<number, number> = Object.fromEntries(
    sprintQualifyingEntries.map((e) => [e.driverId, e.finishPosition])
  );

  const existingBet = await prisma.betSprint.findFirst({
    where: { sessionId: sprintSession.id, userId },
    include: { predictedGrid: { orderBy: { predictedPosition: 'asc' } } }
  });

  const lockTime = new Date(sprintSession.date.getTime() - 5 * 60 * 1000);
  const isLocked = new Date() >= lockTime;

  // Fetch actual results if session is locked
  let sessionEntries: { driverId: number; finishPosition: number }[] = [];
  if (isLocked) {
    sessionEntries = await prisma.sessionEntry.findMany({
      where: { sessionId: sprintSession.id },
      select: { driverId: true, finishPosition: true },
    });
  }

  const hasResults = sessionEntries.length > 0;
  const displayUsername = (session.user as any).username || session.user.name || 'User';

  // ── Result view ───────────────────────────────────────────────────────────
  if (isLocked && hasResults && existingBet) {
    const cfg = seasonData?.config;
    const sprintPts: Record<number, number> = cfg ? {
      1: cfg.sprintPtsP1, 2: cfg.sprintPtsP2, 3: cfg.sprintPtsP3, 4: cfg.sprintPtsP4,
      5: cfg.sprintPtsP5, 6: cfg.sprintPtsP6, 7: cfg.sprintPtsP7, 8: cfg.sprintPtsP8,
    } : DEFAULT_SPRINT_PTS;

    const entryMap = new Map(sessionEntries.map(e => [e.driverId, e]));
    const driverMap = new Map(drivers.map(d => [d.id, d]));

    const driverResults = existingBet.predictedGrid.map(item => {
      const entry = entryMap.get(item.driverId);
      const driver = driverMap.get(item.driverId) ?? null;
      let basePoints = 0;

      // Pontos de posição: apenas se acertou a posição exata
      if (entry && entry.finishPosition === item.predictedPosition) {
        basePoints = sprintPts[item.predictedPosition] ?? 0;
      }

      const result: ResultVariant =
        basePoints > 0 ? 'green' :
        entry ? 'red' : 'neutral';

      return {
        driver,
        driverId: item.driverId,
        predictedPosition: item.predictedPosition,
        actualFinishPosition: entry?.finishPosition ?? null,
        basePoints,
        driverTotal: basePoints,
        result,
      };
    });

    const gridPoints = driverResults.reduce((s, r) => s + r.basePoints, 0);
    const scoreLines = [{ label: 'Pontos Grid', points: gridPoints }];
    const grandTotal = gridPoints;

    const driverPoints: Record<number, number> = {};
    driverResults.forEach(r => { driverPoints[r.driverId] = r.driverTotal; });

    const betResults: Record<number, ResultVariant> = {};
    driverResults.forEach((r, idx) => { betResults[idx] = r.result; });

    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
        <BetSprintResultClient
          driverResults={driverResults}
          betResults={betResults}
          driverPoints={driverPoints}
          grandTotal={grandTotal}
          scoreLines={scoreLines}
          gridPositions={gridPositions}
        />
      </div>
    );
  }

  // ── Edit / preview mode ───────────────────────────────────────────────────
  const initialBet = existingBet ? {
    id: existingBet.id,
    gridIds: existingBet.predictedGrid.map(item => item.driverId),
  } : undefined;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden">
      <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <BetSprintClient
        drivers={drivers}
        sessionId={sprintSession.id}
        initialBet={initialBet}
        gridPositions={gridPositions}
      />
    </div>
  );
}
