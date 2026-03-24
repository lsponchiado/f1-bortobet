import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ProfileClient } from './ProfileClient';
import { BackupBetPanel } from './BackupBetPanel';

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = parseInt(session.user.id, 10);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, username: true },
  });

  if (!user) redirect('/login');

  const displayUsername = session.user.username || session.user.name || 'User';

  const allDrivers = await prisma.driver.findMany({
    where: { enabled: true },
    orderBy: { teamId: 'asc' },
    include: { team: true },
  });

  const serializedDrivers = allDrivers.map(d => ({
    id: d.id,
    lastName: d.lastName,
    code: d.code,
    number: d.number,
    headshotUrl: d.headshotUrl,
    team: { name: d.team.name, color: d.team.color, logoUrl: d.team.logoUrl },
  }));

  const backupRace = await prisma.backupRaceBet.findUnique({ where: { userId } });
  const backupSprint = await prisma.backupSprintBet.findUnique({ where: { userId } });

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
