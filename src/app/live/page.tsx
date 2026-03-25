import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { LiveClient } from './LiveClient';
import { getAuthSession, getDisplayUsername } from '@/lib/auth-utils';
import { serializeDriver } from '@/lib/serialize';
import { getActiveSeason, getActiveDrivers } from '@/lib/cached-queries';

export default async function LivePage() {
  const session = await getAuthSession();

  const activeSeason = await getActiveSeason();
  if (!activeSeason) redirect('/');

  const now = new Date();
  const [drivers, raceOrSprint] = await Promise.all([
    getActiveDrivers(),
    prisma.session.findFirst({
      where: {
        seasonId: activeSeason.id,
        type: { in: ['RACE', 'SPRINT'] },
        date: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
        cancelled: false,
      },
      orderBy: { date: 'asc' },
      include: {
        entries: { select: { driverId: true, startPosition: true } },
      },
    }),
  ]);

  const serializedDrivers = drivers.map(serializeDriver);

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
  const displayUsername = getDisplayUsername(session);

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
