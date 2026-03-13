import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from '@/components/Navbar';
import BetRaceClient from './BetRaceClient';
import BetRaceResultClient from './BetRaceResultClient';
import type { ResultVariant } from '@/components/DriverCard';

const DEFAULT_PTS = {
  race:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 } as Record<number, number>,
  hailMary: 25, underdog: 10, freefall: 5, fastestLap: 10, safetyCar: 10, dnf: 10,
};

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

  const [raceSession, drivers, qualifyingSession, seasonData] = await Promise.all([
    prisma.session.findFirst({
      where: { type: 'RACE', seasonId, grandPrixId: gpId },
      include: { raceConfig: true, grandPrix: true },
    }),
    prisma.driver.findMany({
      where: { enabled: true },
      include: { team: true },
      orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }]
    }),
    prisma.session.findFirst({
      where: { type: 'QUALIFYING', seasonId, grandPrixId: gpId },
    }),
    prisma.season.findUnique({ where: { id: seasonId }, include: { config: true } }),
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
      where: { sessionId: raceSession.id, userId },
      include: { predictedGrid: { orderBy: { predictedPosition: 'asc' } } }
    }),
    prisma.betRace.count({
      where: { userId, sessionId: { not: raceSession.id }, session: { seasonId }, doublePoints: true },
    }),
  ]);

  const lockTime = new Date(raceSession.date.getTime() - 5 * 60 * 1000);
  const isLocked = new Date() >= lockTime;

  // Fetch actual results if session is locked
  let sessionEntries: { driverId: number; finishPosition: number; startPosition: number; dnf: boolean; fastestLap: boolean }[] = [];
  if (isLocked) {
    sessionEntries = await prisma.sessionEntry.findMany({
      where: { sessionId: raceSession.id },
      select: { driverId: true, finishPosition: true, startPosition: true, dnf: true, fastestLap: true },
    });
  }

  const hasResults = sessionEntries.length > 0;
  const displayUsername = (session.user as any).username || session.user.name || 'User';
  const rc = raceSession.raceConfig;

  // ── Result view ───────────────────────────────────────────────────────────
  if (isLocked && hasResults && existingBet) {
    // Build point config from season config or defaults
    const cfg = seasonData?.config;
    const pts = cfg ? {
      race: { 1: cfg.ptsP1, 2: cfg.ptsP2, 3: cfg.ptsP3, 4: cfg.ptsP4, 5: cfg.ptsP5, 6: cfg.ptsP6, 7: cfg.ptsP7, 8: cfg.ptsP8, 9: cfg.ptsP9, 10: cfg.ptsP10 } as Record<number, number>,
      hailMary: cfg.ptsHailMary, underdog: cfg.ptsUnderdog, freefall: cfg.ptsFreefall,
      fastestLap: cfg.ptsFastestLap, safetyCar: cfg.ptsSafetyCar, dnf: cfg.ptsDNF,
    } : DEFAULT_PTS;

    const entryMap = new Map(sessionEntries.map(e => [e.driverId, e]));
    const driverMap = new Map(drivers.map(d => [d.id, d]));

    let hailMaryUsed = 0;
    let underdogUsed = 0;

    const driverResults = existingBet.predictedGrid.map(item => {
      const entry = entryMap.get(item.driverId);
      const driver = driverMap.get(item.driverId) ?? null;
      let basePoints = 0;
      const mechanics: string[] = [];

      if (entry) {
        // Pontos de posição: apenas se acertou a posição exata
        if (entry.finishPosition === item.predictedPosition)
          basePoints = pts.race[item.predictedPosition] ?? 0;

        if (rc?.allowFastestLap !== false && item.fastestLap && entry.fastestLap)
          mechanics.push('Volta Rápida');

        if (rc?.allowHailMary !== false && hailMaryUsed < 1 && item.predictedPosition <= 5 && entry.startPosition >= 20 && entry.finishPosition <= 5) {
          mechanics.push('Hail Mary');
          hailMaryUsed++;
        }

        if (rc?.allowUnderdog !== false && underdogUsed < 3 && item.predictedPosition <= 3 && (entry.startPosition - entry.finishPosition) >= 10 && entry.finishPosition <= 3) {
          mechanics.push('Underdog');
          underdogUsed++;
        }

        if (rc?.allowFreefall !== false && (item.predictedPosition - entry.startPosition) >= 5 && (entry.finishPosition - entry.startPosition) >= 5)
          mechanics.push('Freefall');
      }

      const mechanicPtsMap: Record<string, number> = {
        'Volta Rápida': pts.fastestLap, 'Hail Mary': pts.hailMary,
        'Underdog': pts.underdog, 'Freefall': pts.freefall,
      };
      const mechanicTotal = mechanics.reduce((s, m) => s + (mechanicPtsMap[m] ?? 0), 0);
      const driverTotal = basePoints + mechanicTotal;

      const result: ResultVariant =
        entry && mechanics.includes('Volta Rápida') ? 'purple' :
        basePoints > 0 ? 'green' :
        entry ? 'red' : 'neutral';

      return { driver, driverId: item.driverId, predictedPosition: item.predictedPosition, actualFinishPosition: entry?.finishPosition ?? null, basePoints, mechanics, driverTotal, result };
    });

    // Grid points = sum of base position points
    const gridPoints = driverResults.reduce((s, r) => s + r.basePoints, 0);

    // Group mechanics
    const mechanicCounts = new Map<string, number>();
    driverResults.flatMap(r => r.mechanics).forEach(m => mechanicCounts.set(m, (mechanicCounts.get(m) ?? 0) + 1));
    const mechanicPtsMap: Record<string, number> = { 'Hail Mary': pts.hailMary, 'Underdog': pts.underdog, 'Freefall': pts.freefall, 'Volta Rápida': pts.fastestLap };

    const hasFLPrediction = existingBet.predictedGrid.some(item => item.fastestLap);

    const scoreLines: { label: string; points: number }[] = [
      { label: 'Pontos Grid', points: gridPoints },
      ...[...mechanicCounts.entries()].map(([name, count]) => ({
        label: count > 1 ? `${count}x ${name}` : name,
        points: count * (mechanicPtsMap[name] ?? 0),
      })),
      ...(rc?.allowFastestLap !== false && hasFLPrediction && !mechanicCounts.has('Volta Rápida')
        ? [{ label: 'Volta Rápida', points: 0 }]
        : []),
    ];

    // Safety Car  (predicted=3 significa "3 ou mais")
    const actualSC = raceSession.scCount + raceSession.vscCount;
    const scMatch = existingBet.predictedSC >= 3 ? actualSC >= 3 : existingBet.predictedSC === actualSC;
    const scPoints = rc?.allowSafetyCar !== false && scMatch ? pts.safetyCar : 0;
    if (rc?.allowSafetyCar !== false) scoreLines.push({ label: 'Safety Car', points: scPoints });

    // DNF  (predicted=3 significa "3 ou mais")
    const actualDNF = sessionEntries.filter(e => e.dnf).length;
    const dnfMatch = existingBet.predictedDNF >= 3 ? actualDNF >= 3 : existingBet.predictedDNF === actualDNF;
    const dnfPoints = rc?.allowDNF !== false && dnfMatch ? pts.dnf : 0;
    if (rc?.allowDNF !== false) scoreLines.push({ label: 'DNF', points: dnfPoints });

    // All-In
    let allInDriver = null;
    let allInPoints = 0;
    if (rc?.allowAllIn !== false && existingBet.driverId) {
      allInDriver = driverMap.get(existingBet.driverId) ?? null;
      const allInEntry = entryMap.get(existingBet.driverId);
      if (allInEntry) {
        if (allInEntry.dnf) allInPoints = -17;
        else if (allInEntry.finishPosition <= 10) allInPoints = pts.race[allInEntry.finishPosition] ?? 0;
        else allInPoints = -(allInEntry.finishPosition - 10);
      }
      scoreLines.push({ label: 'All-In', points: allInPoints });
    }

    const baseTotal = scoreLines.reduce((s, l) => s + l.points, 0);
    const grandTotal = rc?.allowDoublePoints !== false && existingBet.doublePoints ? baseTotal * 2 : baseTotal;

    const driverPoints: Record<number, number> = {};
    driverResults.forEach(r => { driverPoints[r.driverId] = r.driverTotal; });

    const betResults: Record<number, ResultVariant> = {};
    driverResults.forEach((r, idx) => { betResults[idx] = r.result; });

    const fastestLapDriverId = existingBet.predictedGrid.find(item => item.fastestLap)?.driverId ?? null;

    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
        <BetRaceResultClient
          driverResults={driverResults}
          betResults={betResults}
          driverPoints={driverPoints}
          fastestLapDriverId={fastestLapDriverId}
          allInDriver={allInDriver}
          allInPoints={allInPoints}
          allowAllIn={rc?.allowAllIn ?? true}
          predictedSC={existingBet.predictedSC}
          actualSC={actualSC}
          scPoints={scPoints}
          allowSafetyCar={rc?.allowSafetyCar ?? true}
          predictedDNF={existingBet.predictedDNF}
          actualDNF={actualDNF}
          dnfPoints={dnfPoints}
          allowDNF={rc?.allowDNF ?? true}
          doublePoints={existingBet.doublePoints ?? false}
          baseTotal={baseTotal}
          grandTotal={grandTotal}
          scoreLines={scoreLines}
          gridPositions={gridPositions}
          allowHailMary={rc?.allowHailMary ?? true}
          allowUnderdog={rc?.allowUnderdog ?? true}
          allowFreefall={rc?.allowFreefall ?? true}
        />
      </div>
    );
  }

  // ── Edit / preview mode ───────────────────────────────────────────────────
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
      <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <BetRaceClient
        drivers={drivers}
        sessionId={raceSession.id}
        initialBet={initialBet}
        doublePointsTokensUsed={doublePointsTokensUsed}
        allowDoublePoints={rc?.allowDoublePoints ?? true}
        allowHailMary={rc?.allowHailMary ?? true}
        allowUnderdog={rc?.allowUnderdog ?? true}
        allowFreefall={rc?.allowFreefall ?? true}
        gridPositions={gridPositions}
      />
    </div>
  );
}
