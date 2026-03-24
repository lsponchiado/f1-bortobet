import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { LiveClient } from './LiveClient';

export default async function LivePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) redirect('/');

  const drivers = await prisma.driver.findMany({
    where: { enabled: true },
    include: { team: true },
  });

  const serializedDrivers = drivers.map(d => ({
    id: d.id,
    lastName: d.lastName,
    code: d.code,
    number: d.number,
    headshotUrl: d.headshotUrl,
    team: {
      name: d.team.name,
      color: d.team.color,
      logoUrl: d.team.logoUrl,
    },
  }));

  // Busca posições de largada da sessão Race ou Sprint mais próxima (hoje ou futura)
  const now = new Date();
  const raceOrSprint = await prisma.session.findFirst({
    where: {
      seasonId: activeSeason.id,
      type: { in: ['RACE', 'SPRINT'] },
      date: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) }, // até 6h atrás
      cancelled: false,
    },
    orderBy: { date: 'asc' },
    include: {
      entries: { select: { driverId: true, startPosition: true } },
    },
  });

  // Map driverId -> startPosition
  const startingGrid: Record<number, number> = {};
  if (raceOrSprint) {
    for (const e of raceOrSprint.entries) {
      if (e.startPosition && e.startPosition < 99) {
        startingGrid[e.driverId] = e.startPosition;
      }
    }
  }

  const wsUrl = process.env.NEXT_PUBLIC_LIVE_WS_URL || 'ws://localhost:8080';
  const displayUsername = session.user.username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
      <main className="pt-2 px-6 pb-40 md:pb-6 lg:px-12 lg:pt-4 flex flex-col items-center">
        <div className="w-full max-w-400 space-y-8">
          <LiveClient wsUrl={wsUrl} drivers={serializedDrivers} startingGrid={startingGrid} />
        </div>
      </main>
    </div>
  );
}
