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

  // All GPs with results, ordered by earliest session date (single query)
  const serializedGps = await prisma.$queryRaw<{ id: number; name: string; country: string }[]>`
    SELECT gp.id, gp.name, gp.country
    FROM "GrandPrix" gp
    WHERE EXISTS (
      SELECT 1 FROM "Session" s
      JOIN "SessionEntry" se ON se."sessionId" = s.id
      WHERE s."grandPrixId" = gp.id AND s."seasonId" = ${activeSeason.id}
    )
    ORDER BY (
      SELECT MIN(s.date) FROM "Session" s
      WHERE s."grandPrixId" = gp.id AND s."seasonId" = ${activeSeason.id}
    ) ASC
  `;

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

  const displayUsername = session.user.username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
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
