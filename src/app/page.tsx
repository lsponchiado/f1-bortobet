import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { GpPanel } from './GpPanel';
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
    where: { type: 'RACE', date: { gte: now }, cancelled: false, grandPrix: { cancelled: false } },
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
    where: { type: 'RACE', seasonId, cancelled: false, grandPrix: { cancelled: false } },
    orderBy: { round: 'asc' },
    select: { round: true, grandPrix: { select: { name: true } } },
  });

  const defaultRound = nextRace?.round ?? allRounds[allRounds.length - 1]?.round ?? 1;
  const currentRound = roundParam ? parseInt(roundParam, 10) : defaultRound;

  const raceSession = await prisma.session.findFirst({
    where: { type: 'RACE', round: currentRound, seasonId, cancelled: false, grandPrix: { cancelled: false } },
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
    where: { round: currentRound, seasonId, cancelled: false, grandPrix: { cancelled: false } },
    orderBy: { date: 'asc' },
  });

  const sprintSession = roundSessions.find((s) => s.type === 'SPRINT');
  const userSprintBet = sprintSession
    ? await prisma.betSprint.findFirst({ where: { userId, sessionId: sprintSession.id } })
    : null;

  const cancelledGps = await prisma.grandPrix.findMany({
    where: { cancelled: true, sessions: { some: { seasonId } } },
    orderBy: { name: 'asc' },
    select: { name: true, country: true },
  });

  const displayUsername = session.user.username || session.user.name || 'User';

  const validRounds = allRounds.map((r) => r.round);
  const currentIndex = validRounds.indexOf(currentRound);
  const prevRound = currentIndex > 0 ? validRounds[currentIndex - 1] : null;
  const nextRound = currentIndex < validRounds.length - 1 ? validRounds[currentIndex + 1] : null;

  const isNextRace = currentRound === defaultRound;
  const displayRound = currentIndex + 1;
  const heading = isNextRace ? 'Próxima Corrida' : `Round ${displayRound}`;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
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
                gpId={raceSession.grandPrixId}
              />
            </div>

          {cancelledGps.length > 0 && (
            <div className="w-full bg-[#1f1f27] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
              <div className="h-1 w-full bg-gray-600" />
              <div className="p-8 space-y-4">
                <h3 className="text-white/20 text-2xl font-black italic uppercase tracking-tighter">
                  GPs Cancelados
                </h3>
                <div className="flex flex-col gap-3">
                  {cancelledGps.map((gp) => (
                    <div key={gp.name} className="flex items-center gap-4">
                      <img
                        src={`https://flagcdn.com/w40/${gp.country.toLowerCase()}.png`}
                        alt={gp.country}
                        className="h-6 w-auto rounded-sm border border-white/10 object-contain flex-shrink-0"
                      />
                      <span className="text-gray-500 text-lg font-black italic uppercase tracking-tight line-through">
                        {gp.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
