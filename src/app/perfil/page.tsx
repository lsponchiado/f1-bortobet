import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ProfileClient } from './ProfileClient';
import { BackupBetPanel } from './BackupBetPanel';
import { NotificationPanel } from './NotificationPanel';
import { getAuthSession, getDisplayUsername } from '@/lib/auth-utils';
import { serializeDriver } from '@/lib/serialize';
import { getActiveDrivers } from '@/lib/cached-queries';

export default async function PerfilPage() {
  const session = await getAuthSession();
  const userId = parseInt(session.user.id, 10);
  const displayUsername = getDisplayUsername(session);

  const [user, allDrivers, backupRace, backupSprint] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, username: true },
    }),
    getActiveDrivers(),
    prisma.backupRaceBet.findUnique({ where: { userId } }),
    prisma.backupSprintBet.findUnique({ where: { userId } }),
  ]);

  if (!user) redirect('/login');

  const serializedDrivers = allDrivers.map(serializeDriver);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
      <main className="pt-2 px-6 pb-40 md:pb-12 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-8">

          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
              Perfil
            </h1>
            <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-2">
              Dados da Conta
            </p>
          </div>

          <ProfileClient name={user.name} email={user.email} username={user.username} />
          <NotificationPanel />
          <BackupBetPanel
            allDrivers={serializedDrivers}
            backupRace={backupRace ? {
              gridIds: backupRace.gridIds,
              fastestLapId: backupRace.fastestLapId,
              predictedSC: backupRace.predictedSC,
              predictedDNF: backupRace.predictedDNF,
            } : null}
            backupSprint={backupSprint ? {
              gridIds: backupSprint.gridIds,
            } : null}
          />
        </div>
      </main>
    </div>
  );
}
