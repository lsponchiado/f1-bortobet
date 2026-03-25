import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ApostasClient } from './ApostasClient';
import { Navbar } from '@/components/Navbar';
import { getAuthSession, getDisplayUsername } from '@/lib/auth-utils';
import { serializeDriver } from '@/lib/serialize';
import { getActiveSeasonWithConfig, getGpsForSeason, getActiveDrivers } from '@/lib/cached-queries';

export default async function ApostasPage({ params, searchParams }: { params: Promise<{ gpId: string }>; searchParams: Promise<{ asUser?: string }> }) {
  const session = await getAuthSession();

  const loggedInUserId = parseInt(session.user.id, 10);
  const isAdmin = session.user.role === 'ADMIN';
  const displayUsername = getDisplayUsername(session);

  const { gpId: gpIdStr } = await params;
  const gpId = parseInt(gpIdStr, 10);
  if (isNaN(gpId)) redirect('/');

  // Admin user bypass: load bets for another user
  const { asUser } = await searchParams;
  const targetUserId = isAdmin && asUser ? parseInt(asUser, 10) : loggedInUserId;
  const userId = isNaN(targetUserId) ? loggedInUserId : targetUserId;

  const activeSeason = await getActiveSeasonWithConfig();
  if (!activeSeason) redirect('/');

  const [gp, allGps, allDrivers] = await Promise.all([
    prisma.grandPrix.findUnique({
      where: { id: gpId },
      include: {
        sessions: {
          where: { seasonId: activeSeason.id },
          include: {
            entries: { include: { driver: { include: { team: true } } } },
            raceConfig: true,
          },
        },
      },
    }),
    getGpsForSeason(activeSeason.id),
    getActiveDrivers(),
  ]);
  if (!gp) redirect('/');

  // Load existing bets for each bettable session type
  const raceSessions = gp.sessions.filter(s => s.type === 'RACE');
  const sprintSessions = gp.sessions.filter(s => s.type === 'SPRINT');

  let existingRaceBet = null;
  let raceResult = null;
  if (raceSessions.length > 0) {
    const bet = await prisma.betRace.findFirst({
      where: { userId, sessionId: { in: raceSessions.map(s => s.id) } },
      include: {
        predictedGrid: { include: { driver: { include: { team: true } } }, orderBy: { predictedPosition: 'asc' } },
        result: true,
      },
    });
    if (bet) {
      existingRaceBet = {
        grid: bet.predictedGrid.map(g => ({
          position: g.predictedPosition,
          driverId: g.driver.id,
          lastName: g.driver.lastName,
          code: g.driver.code,
          number: g.driver.number,
          headshotUrl: g.driver.headshotUrl,
          team: { name: g.driver.team.name, color: g.driver.team.color, logoUrl: g.driver.team.logoUrl },
          fastestLap: g.fastestLap,
        })),
        predictedSC: bet.predictedSC,
        predictedDNF: bet.predictedDNF,
        doublePoints: bet.doublePoints,
      };
      if (bet.result) {
        raceResult = {
          somaPos: bet.result.somaPos,
          hailMary: bet.result.hailMary,
          underdog: bet.result.underdog,
          freefall: bet.result.freefall,
          fastestLap: bet.result.fastestLap,
          safetyCar: bet.result.safetyCar,
          abandonos: bet.result.abandonos,
          somaTotal: bet.result.somaTotal,
        };
      }
    }
  }

  let existingSprintBet = null;
  let sprintResult = null;
  if (sprintSessions.length > 0) {
    const bet = await prisma.betSprint.findFirst({
      where: { userId, sessionId: { in: sprintSessions.map(s => s.id) } },
      include: {
        predictedGrid: { include: { driver: { include: { team: true } } }, orderBy: { predictedPosition: 'asc' } },
        result: true,
      },
    });
    if (bet) {
      existingSprintBet = {
        grid: bet.predictedGrid.map(g => ({
          position: g.predictedPosition,
          driverId: g.driver.id,
          lastName: g.driver.lastName,
          code: g.driver.code,
          number: g.driver.number,
          headshotUrl: g.driver.headshotUrl,
          team: { name: g.driver.team.name, color: g.driver.team.color, logoUrl: g.driver.team.logoUrl },
          fastestLap: false,
        })),
      };
      if (bet.result) {
        sprintResult = {
          somaPos: bet.result.somaPos,
          somaTotal: bet.result.somaTotal,
        };
      }
    }
  }

  // Qualifying results for delta calculation
  const qualifyingResults: { RACE: Record<number, number>; SPRINT: Record<number, number> } = { RACE: {}, SPRINT: {} };
  const qualiSession = gp.sessions.find(s => s.type === 'QUALIFYING' && !s.cancelled);
  if (qualiSession) {
    for (const e of qualiSession.entries) {
      qualifyingResults.RACE[e.driverId] = e.finishPosition;
    }
  }
  const sprintQualiSession = gp.sessions.find(s => s.type === 'SPRINT_QUALIFYING' && !s.cancelled);
  if (sprintQualiSession) {
    for (const e of sprintQualiSession.entries) {
      qualifyingResults.SPRINT[e.driverId] = e.finishPosition;
    }
  }

  // Count double points tokens used this season
  const doublePointsUsed = await prisma.betRace.count({
    where: {
      userId,
      doublePoints: true,
      session: { seasonId: activeSeason.id },
    },
  });
  const doublePointsTotal = activeSeason.config?.doublePointsTokens ?? 3;
  const doublePointsRemaining = doublePointsTotal - doublePointsUsed;

  // Serialize sessions for the client
  const serializedSessions = gp.sessions.map(s => ({
    id: s.id,
    type: s.type,
    date: s.date.toISOString(),
    cancelled: s.cancelled,
    hasEntries: s.entries.length > 0,
    scCount: s.scCount,
    vscCount: s.vscCount,
    raceConfig: s.raceConfig,
    entries: s.entries.map(e => ({
      driverId: e.driverId,
      startPosition: e.startPosition,
      finishPosition: e.finishPosition,
      fastestLap: e.fastestLap,
      dnf: e.dnf,
      dns: e.dns,
      dsq: e.dsq,
    })),
  }));

  const serializedDrivers = allDrivers.map(serializeDriver);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={isAdmin} />

      <main className="pt-2 px-6 pb-40 md:pb-6 lg:px-12 lg:pt-4 flex flex-col items-center">
        <ApostasClient
          sessions={serializedSessions}
          gpName={gp.name}
          currentGpId={gp.id}
          allGps={allGps}
          allDrivers={serializedDrivers}
          existingBets={{ race: existingRaceBet, sprint: existingSprintBet }}
          betResults={{ race: raceResult, sprint: sprintResult }}
          qualifyingResults={qualifyingResults}
          isAdmin={isAdmin}
          currentUserId={userId}
          doublePointsRemaining={doublePointsRemaining}
        />
      </main>
    </div>
  );
}
