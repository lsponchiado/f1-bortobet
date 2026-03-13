interface RankingEntry {
  username: string;
  totalPoints: number;
}

interface RankingPanelProps {
  entries: RankingEntry[];
  currentUsername: string;
}

export function RankingPanel({ entries, currentUsername }: RankingPanelProps) {
  const sorted = [...entries]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 15);

  const leader = sorted[0]?.totalPoints ?? 0;

  return (
    <div className="w-full bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 md:p-8">
        <h2 className="text-xl font-black italic uppercase tracking-tight text-white mb-6">
          Classificação
        </h2>

        <div className="flex flex-col gap-0">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_auto_auto] gap-4 items-center px-3 pb-3 border-b border-white/10">
            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest text-center">#</span>
            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Jogador</span>
            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest text-right w-20">Pontos</span>
            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest text-right w-16">Dif.</span>
          </div>

          {sorted.length === 0 ? (
            <div className="py-12 text-center text-gray-600 font-bold uppercase text-sm tracking-widest">
              Sem dados disponíveis
            </div>
          ) : (
            sorted.map((entry, idx) => {
              const rank = idx + 1;
              const delta = entry.totalPoints - leader;
              const isCurrentUser = entry.username === currentUsername;
              const isLeader = rank === 1;

              return (
                <div
                  key={entry.username}
                  className={`grid grid-cols-[2rem_1fr_auto_auto] gap-4 items-center px-3 py-3 border-b border-white/5 last:border-0 transition-colors ${
                    isCurrentUser ? 'bg-white/5 rounded-xl' : ''
                  }`}
                >
                  {/* Rank */}
                  <span className={`text-center font-black italic text-lg tracking-tighter ${
                    isLeader ? 'text-[#e10600]' : 'text-white/30'
                  }`}>
                    {rank}
                  </span>

                  {/* Username */}
                  <span className={`font-bold uppercase tracking-wide truncate ${
                    isCurrentUser ? 'text-white' : 'text-white/70'
                  }`}>
                    {entry.username}
                    {isCurrentUser && (
                      <span className="ml-2 text-[9px] font-black text-[#e10600] uppercase tracking-widest">você</span>
                    )}
                  </span>

                  {/* Points */}
                  <span className={`font-black tabular-nums text-right w-20 ${
                    isLeader ? 'text-white text-lg' : 'text-white/80'
                  }`}>
                    {entry.totalPoints.toFixed(1)}
                  </span>

                  {/* Delta */}
                  <span className={`font-bold tabular-nums text-right w-16 text-sm ${
                    delta === 0 ? 'text-white/20' : 'text-red-400'
                  }`}>
                    {delta === 0 ? '—' : delta.toFixed(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
