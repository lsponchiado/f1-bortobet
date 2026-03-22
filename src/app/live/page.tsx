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

  const wsUrl = process.env.NEXT_PUBLIC_LIVE_WS_URL || 'ws://localhost:8080';
  const displayUsername = session.user.username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
      <main className="pt-6 p-6 pb-40 md:pb-6 lg:p-12 flex flex-col items-center">
        <div className="w-full max-w-400 space-y-8">
          <LiveClient wsUrl={wsUrl} drivers={serializedDrivers} />
        </div>
      </main>
    </div>
  );
}
