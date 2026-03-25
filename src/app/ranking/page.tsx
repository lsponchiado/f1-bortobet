import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { RankingClient } from './RankingClient';
import { getAuthSession, getDisplayUsername } from '@/lib/auth-utils';
import { getActiveSeason, getRankingScores, getRankingEarnings, getRankingGpOptions } from '@/lib/cached-queries';

export default async function RankingPage() {
  const session = await getAuthSession();

  const activeSeason = await getActiveSeason();
  if (!activeSeason) redirect('/');

  const [serializedScores, earnings, gpOptions] = await Promise.all([
    getRankingScores(activeSeason.id),
    getRankingEarnings(activeSeason.id),
    getRankingGpOptions(activeSeason.id),
  ]);

  const displayUsername = getDisplayUsername(session);
  const isAdmin = session.user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={isAdmin} />
      <main className="pt-2 px-6 pb-40 md:pb-12 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-xl space-y-8">

          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
              Ranking
            </h1>
            <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-2">
              Classificação da Temporada
            </p>
          </div>

          <RankingClient scores={serializedScores} gpOptions={gpOptions} earnings={earnings} />
        </div>
      </main>
    </div>
  );
}
