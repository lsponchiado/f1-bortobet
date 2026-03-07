import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BetPanel } from "@/components/BetPanel";
import Navbar from "@/components/Navbar";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const now = new Date();

  // 1. Busca o próximo evento no calendário
  const nextRace = await prisma.race.findFirst({
    where: { 
      date: { gte: now }, 
      cancelled: false 
    },
    orderBy: { date: 'asc' },
    include: { 
      grandPrix: true, 
      season: true,
      bets: { where: { userId } }
    },
  });

  if (!nextRace) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-zinc-500 font-black uppercase italic tracking-widest">Fim da Temporada 2026</p>
      </main>
    );
  }

  // 2. Busca dados de Quali e Sprint do round atual
  const [quali, sprint, userSprintBet] = await Promise.all([
    prisma.qualify.findFirst({ 
      where: { round: nextRace.round, seasonId: nextRace.seasonId } 
    }),
    prisma.sprint.findFirst({ 
      where: { round: nextRace.round, seasonId: nextRace.seasonId } 
    }),
    prisma.betSprint.findFirst({ 
      where: { userId } // Aqui você pode filtrar pelo ID da sprint se desejar
    })
  ]);

  // Define o username para a Navbar (prioriza username, fallback para name)
  const displayUsername = session.user.username || session.user.name || "User";

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Navbar fixa no topo */}
      <Navbar username={displayUsername} />

      {/* Conteúdo com padding superior para compensar a Navbar fixa */}
      <main className="pt-32 p-6 lg:p-12 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-12">
          
          {/* Título de Contexto */}
          <div className="px-2">
            <h2 className="text-white/20 text-4xl font-black italic uppercase tracking-tighter">
              Próxima Corrida
            </h2>
          </div>

          {/* Painel Centralizado */}
          <div className="flex justify-center">
            <BetPanel 
              eventName={nextRace.grandPrix.name}
              trackName={nextRace.grandPrix.trackName}
              country={nextRace.grandPrix.country} 
              trackMapUrl={nextRace.grandPrix.trackMapUrl || ""}
              schedule={{
                quali: quali?.date || nextRace.date,
                sprint: sprint?.date,
                race: nextRace.date,
              }}
              hasRaceBet={nextRace.bets.length > 0}
              hasSprintBet={!!userSprintBet}
              seasonId={nextRace.seasonId}
              gpId={nextRace.grandPrixId}
              hasSprint={!!sprint}
            />
          </div>

        </div>
      </main>
    </div>
  );
}