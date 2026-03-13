import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { calculateScores } from '@/lib/scoring';
import { RankingClient } from './RankingClient';

export default async function RankingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const currentUsername = (session.user as any).username || session.user.name || 'User';

  const allSeasons = await prisma.season.findMany({ orderBy: { year: 'desc' } });

  if (allSeasons.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Navbar username={currentUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
        <main className="pt-6 pb-40 md:pb-12 px-6 flex flex-col items-center">
          <p className="text-gray-600 font-black uppercase italic tracking-widest mt-20">Sem temporada ativa</p>
        </main>
      </div>
    );
  }

  const seasonsData = await Promise.all(
    allSeasons.map(async (s) => {
      const { scores } = await calculateScores({ seasonId: s.id });

      // Extract unique GPs from scores data (preserves order by first occurrence)
      const gpMap = new Map<number, string>();
      for (const score of scores) {
        for (const g of score.byGp) {
          if (!gpMap.has(g.gpId)) gpMap.set(g.gpId, g.gpName);
        }
      }

      return {
        seasonId: s.id,
        year: s.year,
        scores,
        gps: [...gpMap.entries()].map(([gpId, gpName]) => ({ gpId, gpName })),
      };
    })
  );

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={currentUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <main className="pt-6 pb-40 md:pb-12 px-6 lg:px-12 flex flex-col items-center">
        <RankingClient seasons={seasonsData} currentUsername={currentUsername} />
      </main>
    </div>
  );
}
