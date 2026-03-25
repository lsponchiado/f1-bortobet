'use client';

export interface TeamDuelEntry {
  startPosition: number;
  finishPosition: number;
  dns: boolean;
  dnf: boolean;
  dsq: boolean;
  driver: {
    code: string;
    team: {
      name: string;
      color: string;
    };
  };
}

function driverStatus(e: TeamDuelEntry): string | null {
  if (e.dns) return 'DNS';
  if (e.dsq) return 'DSQ';
  if (e.dnf) return 'DNF';
  return null;
}

export function TeamDuel({ entries }: { entries: TeamDuelEntry[] }) {
  const teamMap = new Map<string, { team: TeamDuelEntry['driver']['team']; drivers: TeamDuelEntry[] }>();
  for (const e of entries) {
    const key = e.driver.team.name;
    if (!teamMap.has(key)) teamMap.set(key, { team: e.driver.team, drivers: [] });
    teamMap.get(key)!.drivers.push(e);
  }

  const totalDrivers = entries.length;
  const teams = [...teamMap.values()]
    .filter(t => t.drivers.length === 2)
    .sort((a, b) =>
      Math.min(...a.drivers.map(d => d.finishPosition)) - Math.min(...b.drivers.map(d => d.finishPosition))
    );

  return (
    <div className="flex flex-col gap-3 max-w-lg mx-auto w-full">
      {teams.map(({ team, drivers }) => {
        const [winner, loser] = [...drivers].sort((a, b) => a.finishPosition - b.finishPosition);
        const wStatus = driverStatus(winner);
        const lStatus = driverStatus(loser);
        const wDelta = winner.startPosition - winner.finishPosition;
        const lDelta = loser.startPosition - loser.finishPosition;

        // Bar: proportion inverted (P1 = longest, P20 = shortest)
        const wPct = wStatus ? 10 : Math.max(8, ((totalDrivers + 1 - winner.finishPosition) / totalDrivers) * 100);
        const lPct = lStatus ? 10 : Math.max(8, ((totalDrivers + 1 - loser.finishPosition) / totalDrivers) * 100);

        return (
          <div key={team.name} className="bg-[#1f1f27] rounded-2xl border border-white/5 overflow-hidden">
            <div className="h-1 w-full" style={{ backgroundColor: team.color }} />
            <div className="px-4 pt-3 pb-4 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">{team.name}</p>

              {/* Head-to-head bars — both grow outward from center */}
              <div className="grid grid-cols-2 gap-1">
                <div className="relative h-3">
                  <div className="absolute right-0 top-0 h-full rounded-full" style={{ width: `${wPct}%`, backgroundColor: team.color }} />
                </div>
                <div className="relative h-3">
                  <div className="absolute left-0 top-0 h-full rounded-full opacity-40" style={{ width: `${lPct}%`, backgroundColor: team.color }} />
                </div>
              </div>

              {/* Driver labels: delta | name | pos  ·  pos | name | delta */}
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-2 justify-end">
                  {!wStatus && wDelta !== 0 && (
                    <span className={`text-[10px] font-black ${wDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {wDelta > 0 ? `+${wDelta}` : wDelta}
                    </span>
                  )}
                  <span className="text-sm font-black text-white">{winner.driver.code}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${wStatus ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}>
                    {wStatus ?? `P${winner.finishPosition}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${lStatus ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-400'}`}>
                    {lStatus ?? `P${loser.finishPosition}`}
                  </span>
                  <span className="text-sm font-black text-gray-500">{loser.driver.code}</span>
                  {!lStatus && lDelta !== 0 && (
                    <span className={`text-[10px] font-black ${lDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {lDelta > 0 ? `+${lDelta}` : lDelta}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
