import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ApostasClient from './ApostasClient';
import { Navbar } from '@/components/Navbar';

export default async function ApostasPage({ params, searchParams }: { params: Promise<{ gpId: string }>; searchParams: Promise<{ asUser?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const loggedInUserId = parseInt(session.user.id, 10);
  const isAdmin = session.user.role === 'ADMIN';
  const displayUsername = session.user.username || session.user.name || 'User';

  const { gpId: gpIdStr } = await params;
  const gpId = parseInt(gpIdStr, 10);
  if (isNaN(gpId)) redirect('/');

  // Admin user bypass: load bets for another user
  const { asUser } = await searchParams;
  const targetUserId = isAdmin && asUser ? parseInt(asUser, 10) : loggedInUserId;
  const userId = isNaN(targetUserId) ? loggedInUserId : targetUserId;

  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
    include: { config: true },
  });
  if (!activeSeason) redirect('/');

  const gp = await prisma.grandPrix.findUnique({
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
  });
  if (!gp) redirect('/');

  // All GPs with sessions in active season, ordered by earliest session date
  const allGpsRaw = await prisma.grandPrix.findMany({
    where: { sessions: { some: { seasonId: activeSeason.id } } },
    select: { id: true, name: true, country: true },
  });
  const gpsWithDate = await Promise.all(
    allGpsRaw.map(async (g) => {
      const first = await prisma.session.findFirst({
        where: { grandPrixId: g.id, seasonId: activeSeason.id },
        orderBy: { date: 'asc' },
        select: { date: true },
      });
      return { ...g, firstDate: first?.date ?? new Date() };
    })
  );
  gpsWithDate.sort((a, b) => a.firstDate.getTime() - b.firstDate.getTime());
  const allGps = gpsWithDate.map(g => ({ id: g.id, name: g.name, country: g.country }));

  const allDrivers = await prisma.driver.findMany({
    where: { enabled: true },
    orderBy: { teamId: 'asc' },
    include: { team: true },
  });

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

  // Serialize sessions for the client
  const serializedSessions = gp.sessions.map(s => ({
    id: s.id,
    type: s.type as string,
    date: s.date.toISOString(),
    cancelled: s.cancelled,
    hasEntries: s.entries.length > 0,
    scCount: s.scCount,
    vscCount: (s as any).vscCount ?? 0,
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

  const serializedDrivers = allDrivers.map(d => ({
    id: d.id,
    lastName: d.lastName,
    code: d.code,
    number: d.number,
    headshotUrl: d.headshotUrl,
    team: { name: d.team.name, color: d.team.color, logoUrl: d.team.logoUrl },
  }));

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={isAdmin} />

      <main className="pt-6 p-6 pb-40 md:pb-6 lg:p-12 flex flex-col items-center">
        <ApostasClient
          sessions={serializedSessions}
          gpName={gp.name}
          currentGpId={gp.id}
          allGps={allGps}
          allDrivers={serializedDrivers}
          existingBets={{ race: existingRaceBet, sprint: existingSprintBet }}
          betResults={{ race: raceResult, sprint: sprintResult }}
          qualifyingResults={qualifyingResults}
          seasonConfig={activeSeason.config}
          isAdmin={isAdmin}
          currentUserId={userId}
          allUsers={[]}
        />
      </main>
    </div>
  );
}
