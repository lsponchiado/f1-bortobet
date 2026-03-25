import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ResultadosClient } from './ResultadosClient';
import { getAuthSession, getDisplayUsername } from '@/lib/auth-utils';
import { getActiveSeason, getGpsWithResults, getSessionsWithEntries } from '@/lib/cached-queries';

export default async function ResultadosPage({ params }: { params: Promise<{ gpId: string }> }) {
  const session = await getAuthSession();

  const { gpId: gpIdStr } = await params;
  const gpId = parseInt(gpIdStr);
  if (isNaN(gpId)) redirect('/');

  const [activeSeason, gp] = await Promise.all([
    getActiveSeason(),
    prisma.grandPrix.findUnique({ where: { id: gpId } }),
  ]);
  if (!activeSeason) redirect('/');
  if (!gp) redirect('/');

  const [allGps, serializedSessions] = await Promise.all([
    getGpsWithResults(activeSeason.id),
    getSessionsWithEntries(gpId, activeSeason.id),
  ]);

  const displayUsername = getDisplayUsername(session);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
      <main className="pt-2 px-6 pb-40 md:pb-6 lg:px-12 lg:pt-4 flex flex-col items-center">
        <div className="w-full max-w-400 space-y-8">
          <ResultadosClient
            sessions={serializedSessions}
            gpName={gp.name}
            currentGpId={gpId}
            allGps={allGps}
          />
        </div>
      </main>
    </div>
  );
}
