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

  const now = new Date();
  const { round: roundParam } = await searchParams;

  // Busca próxima corrida (só precisa de round e seasonId)
  const nextRace = await prisma.session.findFirst({
    where: { type: 'RACE', date: { gte: now }, cancelled: false, grandPrix: { cancelled: false } },
    orderBy: { date: 'asc' },
    select: { round: true, seasonId: true },
  });

  const seasonId = nextRace?.seasonId ?? (await prisma.season.findFirst({ where: { isActive: true } }))?.id;
  if (!seasonId) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-zinc-500 font-black uppercase italic tracking-widest">Sem temporada ativa</p>
      </main>
    );
  }

  // allRounds + cancelledGps podem rodar em paralelo
  const [allRounds, cancelledGps] = await Promise.all([
    prisma.session.findMany({
      where: { type: 'RACE', seasonId, cancelled: false, grandPrix: { cancelled: false } },
      orderBy: { round: 'asc' },
      select: { round: true },
    }),
    prisma.grandPrix.findMany({
      where: { cancelled: true, sessions: { some: { seasonId } } },
      orderBy: { name: 'asc' },
      select: { name: true, country: true },
    }),
  ]);

  const defaultRound = nextRace?.round ?? allRounds[allRounds.length - 1]?.round ?? 1;
  const currentRound = roundParam ? parseInt(roundParam, 10) : defaultRound;

  // raceSession + roundSessions podem rodar em paralelo (mesmo filtro base)
  const [raceSession, roundSessions] = await Promise.all([
    prisma.session.findFirst({
      where: { type: 'RACE', round: currentRound, seasonId, cancelled: false, grandPrix: { cancelled: false } },
      include: { grandPrix: true },
    }),
    prisma.session.findMany({
      where: { round: currentRound, seasonId, cancelled: false, grandPrix: { cancelled: false } },
      orderBy: { date: 'asc' },
    }),
  ]);

  if (!raceSession) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-zinc-500 font-black uppercase italic tracking-widest">Fim da Temporada 2026</p>
      </main>
    );
  }

  const displayUsername = session.user.username || session.user.name || 'User';

  const validRounds = allRounds.map((r) => r.round);
  const currentIndex = validRounds.indexOf(currentRound);
  const prevRound = currentIndex > 0 ? validRounds[currentIndex - 1] : null;
  const nextRound = currentIndex < validRounds.length - 1 ? validRounds[currentIndex + 1] : null;

  const isNextRace = currentRound === defaultRound;
  const displayRound = currentIndex + 1;
  const heading = isNextRace ? 'Próxima Corrida' : `Round ${displayRound}`;
  const prevLabel = prevRound ? `Round ${currentIndex}` : null;
  const nextLabel = nextRound ? `Round ${currentIndex + 2}` : null;

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={session.user.role === 'ADMIN'} />
      <main className="pt-2 px-6 pb-40 md:pb-6 lg:px-12 lg:pt-4 flex flex-col items-center">
        <div className="w-full max-w-5xl space-y-8">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
              Home
            </h1>
            <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest mt-2">
              Temporada 2026
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              {prevRound ? (
                <Link
                  href={`/?round=${prevRound}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-all active:scale-95"
                >
                  <ChevronLeft size={20} />
                  <span className="text-xs font-black uppercase italic tracking-wider">{prevLabel}</span>
                </Link>
              ) : <div />}
              {nextRound ? (
                <Link
                  href={`/?round=${nextRound}`}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-all active:scale-95"
                >
                  <span className="text-xs font-black uppercase italic tracking-wider">{nextLabel}</span>
                  <ChevronRight size={20} />
                </Link>
              ) : <div />}
            </div>
            <GpPanel
                heading={heading}
                eventName={raceSession.grandPrix.name}
                trackName={raceSession.grandPrix.trackName}
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
