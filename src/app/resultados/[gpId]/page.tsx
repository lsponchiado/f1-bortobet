import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ResultadosClient } from './ResultadosClient';

export default async function ResultadosPage({ params }: { params: Promise<{ gpId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { gpId: gpIdStr } = await params;
  const gpId = parseInt(gpIdStr);
  if (isNaN(gpId)) redirect('/');

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) redirect('/');

  const gp = await prisma.grandPrix.findUnique({ where: { id: gpId } });
  if (!gp) redirect('/');

  // All GPs in the active season, ordered by earliest session date
  const allGpsRaw = await prisma.grandPrix.findMany({
    where: { sessions: { some: { seasonId: activeSeason.id } } },
    select: {
      id: true,
      name: true,
      country: true,
      sessions: {
        where: { seasonId: activeSeason.id },
        orderBy: { date: 'asc' },
        take: 1,
        select: { date: true },
      },
    },
  });
  allGpsRaw.sort((a, b) => (a.sessions[0]?.date.getTime() ?? 0) - (b.sessions[0]?.date.getTime() ?? 0));
  const allGps = allGpsRaw.map(g => ({ id: g.id, name: g.name, country: g.country }));

  const sessions = await prisma.session.findMany({
    where: { grandPrixId: gpId, seasonId: activeSeason.id },
    include: {
      entries: {
        include: {
          driver: { include: { team: true } },
        },
        orderBy: { finishPosition: 'asc' },
      },
    },
    orderBy: { date: 'asc' },
  });

  const serializedSessions = sessions.map(s => ({
    id: s.id,
    type: s.type as string,
    date: s.date.toISOString(),
    cancelled: s.cancelled,
    entries: s.entries.map(e => ({
      startPosition: e.startPosition,
      finishPosition: e.finishPosition,
      dns: e.dns,
      dnf: e.dnf,
      dsq: e.dsq,
      fastestLap: e.fastestLap,
      bestLapTime: e.bestLapTime,
      gapToLeader: e.gapToLeader,
      interval: e.interval,
      tireStints: e.tireStints,
      driver: {
        id: e.driver.id,
        lastName: e.driver.lastName,
        code: e.driver.code,
        number: e.driver.number,
        headshotUrl: e.driver.headshotUrl,
        team: {
          name: e.driver.team.name,
          color: e.driver.team.color,
          logoUrl: e.driver.team.logoUrl,
        },
      },
    })),
  }));

  const displayUsername = session.user.username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
      <main className="pt-2 px-6 pb-40 md:pb-6 lg:px-12 lg:pt-4 flex flex-col items-center">
        <div className="w-full max-w-400 space-y-8">
          <ResultadosClient
            sessions={serializedSessions}
            gpName={gp.name}
            currentGpId={gpId}
            allGps={allGps}
          />
        </div>
      </main>
    </div>
  );
}
