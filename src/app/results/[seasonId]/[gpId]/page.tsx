import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import ResultsClient from './ResultsClient';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ seasonId: string; gpId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { seasonId: seasonIdRaw, gpId: gpIdRaw } = await params;
  const seasonId = parseInt(seasonIdRaw, 10);
  const gpId = parseInt(gpIdRaw, 10);

  const [grandPrix, gpSessions] = await Promise.all([
    prisma.grandPrix.findUnique({ where: { id: gpId } }),
    prisma.session.findMany({
      where: { seasonId, grandPrixId: gpId, cancelled: false },
      orderBy: { date: 'asc' },
    }),
  ]);

  if (!grandPrix) redirect('/');

  const now = new Date();
  const anySessionPast = gpSessions.some((s) => s.date < now);
  if (!anySessionPast) redirect('/');

  const sessionIds = gpSessions.map((s) => s.id);

  const sessionEntries = await prisma.sessionEntry.findMany({
    where: { sessionId: { in: sessionIds } },
    include: { driver: { include: { team: true } } },
    orderBy: { finishPosition: 'asc' },
  });

  type DriverSelection = {
    id: number;
    name: string;
    number: number;
    headshotUrl: string | null;
    country: string;
    fastestLap?: boolean;
    startPosition?: number;
    dnf?: boolean;
    team: { name: string; logoUrl: string | null; color: string };
  };

  const toDriverSelection = (e: (typeof sessionEntries)[0]): DriverSelection => ({
    id: e.driver.id,
    name: e.driver.name,
    number: e.driver.number,
    headshotUrl: e.driver.headshotUrl,
    country: e.driver.country,
    fastestLap: e.fastestLap,
    startPosition: e.startPosition,
    dnf: e.dnf,
    team: { name: e.driver.team.name, logoUrl: e.driver.team.logoUrl, color: e.driver.team.color },
  });

  // Fallback: when no entries at all, show all drivers ordered by number
  let fallbackDrivers: DriverSelection[] = [];
  if (sessionEntries.length === 0) {
    const raw = await prisma.driver.findMany({
      where: { enabled: true },
      include: { team: true },
      orderBy: { number: 'asc' },
    });
    fallbackDrivers = raw.map((d) => ({
      id: d.id,
      name: d.name,
      number: d.number,
      headshotUrl: d.headshotUrl,
      country: d.country,
      team: { name: d.team.name, logoUrl: d.team.logoUrl, color: d.team.color },
    }));
  }

  const sessionInfos = gpSessions.map((s) => ({
    id: s.id,
    type: s.type,
    date: s.date,
    scCount: s.scCount,
    vscCount: s.vscCount,
    results: sessionEntries
      .filter((e) => e.sessionId === s.id)
      .map((e) => toDriverSelection(e)),
  }));

  const displayUsername = (session.user as any).username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <ResultsClient sessions={sessionInfos} fallbackDrivers={fallbackDrivers} gpName={grandPrix.name} />
    </div>
  );
}
