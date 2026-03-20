import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AdminClient } from './AdminClient';
import { getConfigData } from '@/lib/admin-actions';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const currentUsername = session.user.username || session.user.name || 'User';
  const configData = await getConfigData();
  const seasonId = configData.season?.id;

  const [allUsers, strollCount, totalGps, cancelledGps] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, username: true, name: true },
      orderBy: { username: 'asc' },
    }),
    prisma.user.count({ where: { category: 'STROLL' } }),
    prisma.session.findMany({
      where: { seasonId, type: 'RACE' },
      select: { grandPrixId: true },
      distinct: ['grandPrixId'],
    }).then(r => r.length),
    prisma.grandPrix.count({
      where: {
        cancelled: true,
        sessions: { some: { seasonId, type: 'RACE' } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={currentUsername} isAdmin />
      <main className="pt-6 pb-40 md:pb-12 px-6 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-5xl">
          <AdminClient configData={configData} allUsers={allUsers} strollCount={strollCount} totalGps={totalGps} cancelledGps={cancelledGps} />
        </div>
      </main>
    </div>
  );
}
