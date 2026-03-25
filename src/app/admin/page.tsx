import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AdminClient } from './AdminClient';
import { getConfigData, getResyncSessions } from '@/lib/admin-actions';
import { getAuthSession, getDisplayUsername } from '@/lib/auth-utils';

export default async function AdminPage() {
  const session = await getAuthSession();
  if (session.user.role !== 'ADMIN') redirect('/');

  const currentUsername = getDisplayUsername(session);
  const configData = await getConfigData();
  const seasonId = configData.season?.id;

  const [allUsers, strollCount, totalGps, cancelledGps, resyncSessions] = await Promise.all([
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
    getResyncSessions(),
  ]);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={currentUsername} isAdmin />
      <main className="pt-2 px-6 pb-40 md:pb-12 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-5xl space-y-8">

          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
              Configuração
            </h1>
            <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-2">
              Painel Administrativo
            </p>
          </div>

          <AdminClient configData={configData} allUsers={allUsers} strollCount={strollCount} totalGps={totalGps} cancelledGps={cancelledGps} resyncSessions={resyncSessions} />
        </div>
      </main>
    </div>
  );
}
