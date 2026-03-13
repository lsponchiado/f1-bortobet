import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { GpPanel } from '@/components/GpPanel';
import { Navbar } from '@/components/Navbar';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = parseInt(session.user.id, 10);
  const now = new Date();
  const { round: roundParam } = await searchParams;

  // Encontra o round a exibir: param da URL ou próxima corrida
  const nextRace = await prisma.session.findFirst({
    where: { type: 'RACE', date: { gte: now }, cancelled: false },
    orderBy: { date: 'asc' },
    include: { grandPrix: true, season: true, betRaces: { where: { userId } } },
  });

  const seasonId = nextRace?.seasonId ?? (await prisma.season.findFirst({ where: { isActive: true } }))?.id;
  if (!seasonId) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-zinc-500 font-black uppercase italic tracking-widest">Sem temporada ativa</p>
      </main>
    );
  }

  // Busca todos os rounds disponíveis da temporada
  const allRounds = await prisma.session.findMany({
    where: { type: 'RACE', seasonId },
    orderBy: { round: 'asc' },
    select: { round: true, grandPrix: { select: { name: true } } },
  });

  const defaultRound = nextRace?.round ?? allRounds[allRounds.length - 1]?.round ?? 1;
  const currentRound = roundParam ? parseInt(roundParam, 10) : defaultRound;

  const raceSession = await prisma.session.findFirst({
    where: { type: 'RACE', round: currentRound, seasonId },
    include: { grandPrix: true, season: true, betRaces: { where: { userId } } },
  });

  if (!raceSession) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-zinc-500 font-black uppercase italic tracking-widest">Fim da Temporada 2026</p>
      </main>
    );
  }

  const roundSessions = await prisma.session.findMany({
    where: { round: currentRound, seasonId },
    orderBy: { date: 'asc' },
  });

  const sprintSession = roundSessions.find((s) => s.type === 'SPRINT');
  const userSprintBet = sprintSession
    ? await prisma.betSprint.findFirst({ where: { userId, sessionId: sprintSession.id } })
    : null;

  const displayUsername = (session.user as any).username || session.user.name || 'User';

  const minRound = allRounds[0]?.round ?? 1;
  const maxRound = allRounds[allRounds.length - 1]?.round ?? 1;
  const prevRound = currentRound > minRound ? currentRound - 1 : null;
  const nextRound = currentRound < maxRound ? currentRound + 1 : null;

  const isNextRace = currentRound === defaultRound;
  const heading = isNextRace ? 'Próxima Corrida' : `Round ${currentRound}`;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <main className="pt-6 p-6 pb-40 md:pb-6 lg:p-12 flex flex-col items-center">
        <div className="w-full max-w-5xl space-y-12">
          <div className="px-2 flex items-center justify-between">
            <h2 className="text-white/20 text-4xl font-black italic uppercase tracking-tighter">
              {heading}
            </h2>
            <div className="flex gap-2 shrink-0">
              <Link
                href={prevRound ? `/?round=${prevRound}` : '#'}
                aria-disabled={!prevRound}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border transition-all ${
                  prevRound
                    ? 'border-white/20 text-white hover:border-white/60 hover:bg-white/10 active:scale-95'
                    : 'border-white/5 text-white/20 pointer-events-none'
                }`}
              >
                <ChevronLeft size={24} />
              </Link>
              <Link
                href={nextRound ? `/?round=${nextRound}` : '#'}
                aria-disabled={!nextRound}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border transition-all ${
                  nextRound
                    ? 'border-white/20 text-white hover:border-white/60 hover:bg-white/10 active:scale-95'
                    : 'border-white/5 text-white/20 pointer-events-none'
                }`}
              >
                <ChevronRight size={24} />
              </Link>
            </div>
          </div>

          <div>
            <GpPanel
                eventName={raceSession.grandPrix.name}
                trackName={raceSession.grandPrix.trackName}
                country={raceSession.grandPrix.country}
                trackMapUrl={raceSession.grandPrix.trackMapUrl || ''}
                sessions={roundSessions.map((s) => ({
                  type: s.type,
                  date: s.date,
                  cancelled: s.cancelled,
                }))}
                hasRaceBet={raceSession.betRaces.length > 0}
                hasSprintBet={!!userSprintBet}
                seasonId={seasonId}
                gpId={raceSession.grandPrixId}
              />
            </div>
        </div>
      </main>
    </div>
  );
}
