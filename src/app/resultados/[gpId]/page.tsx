import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import ResultadosClient from './ResultadosClient';

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

  // All GPs that have sessions in the active season (for the GP selector)
  const allGps = await prisma.grandPrix.findMany({
    where: { sessions: { some: { seasonId: activeSeason.id } } },
    orderBy: { sessions: { _count: 'desc' } },
    select: { id: true, name: true, country: true },
  });

  // Order GPs by their earliest session date
  const gpsWithDate = await Promise.all(
    allGps.map(async (g) => {
      const firstSession = await prisma.session.findFirst({
        where: { grandPrixId: g.id, seasonId: activeSeason.id },
        orderBy: { date: 'asc' },
        select: { date: true },
      });
      return { ...g, firstDate: firstSession?.date ?? new Date() };
    })
  );
  gpsWithDate.sort((a, b) => a.firstDate.getTime() - b.firstDate.getTime());
  const serializedGps = gpsWithDate.map(g => ({ id: g.id, name: g.name, country: g.country }));

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

  const displayUsername = (session.user as any).username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <main className="pt-6 p-6 pb-40 md:pb-6 lg:p-12 flex flex-col items-center">
        <div className="w-full max-w-400 space-y-8">
          <ResultadosClient
            sessions={serializedSessions}
            gpName={gp.name}
            currentGpId={gpId}
            allGps={serializedGps}
          />
        </div>
      </main>
    </div>
  );
}
