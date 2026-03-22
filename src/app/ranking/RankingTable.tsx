'use client';

import { Trophy, Zap, Flag, Sigma, Star, ArrowDownUp, DollarSign } from 'lucide-react';

const POSITION_COLORS: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
};

const SHOW_GANHOS_CATEGORIES = new Set(['STROLL', 'HULKENBERG']);

export interface RankingEntry {
  userId: number;
  username: string;
  name: string;
  category: string;
  sprintPoints: number;
  racePoints: number;
  gpTotal: number;
  total: number;
  gap: number;
  ganhos: number;
}

interface RankingTableProps {
  entries: RankingEntry[];
  showGpColumns: boolean;
  showSprint?: boolean;
  onUserClick?: (userId: number) => void;
}

export function RankingTable({ entries, showGpColumns, showSprint = false, onUserClick }: RankingTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500 font-black uppercase italic tracking-widest">
          Sem dados de pontuação
        </p>
      </div>
    );
  }

  const showGanhos = entries.some(e => SHOW_GANHOS_CATEGORIES.has(e.category));

  const legendItems = showGpColumns
    ? [
        ...(showSprint ? [{ icon: Zap, label: 'Sprint' }] : []),
        { icon: Flag, label: 'Corrida' },
        ...(showSprint ? [{ icon: Sigma, label: 'Soma' }] : []),
        { icon: ArrowDownUp, label: 'Gap' },
        ...(showGanhos ? [{ icon: DollarSign, label: 'Ganhos' }] : []),
      ]
    : [
        { icon: Star, label: 'Total' },
        { icon: ArrowDownUp, label: 'Gap' },
        ...(showGanhos ? [{ icon: DollarSign, label: 'Ganhos' }] : []),
      ];

  return (
    <div className="bg-[#1f1f27] border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-center gap-4 px-4 py-4 border-b border-white/5 overflow-x-auto">
        {legendItems.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 shrink-0">
            <Icon size={11} className="text-gray-500" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-xs uppercase italic tracking-wider">
        <thead>
          <tr className="text-gray-500 font-black border-b border-white/10">
            <th className="text-left py-3 px-3 w-8">#</th>
            <th className="text-left py-3 px-2">Usuário</th>
            {showGpColumns && (
              <>
                {showSprint && <th className="py-3 px-2 text-center"><Zap size={13} className="inline" /></th>}
                <th className="py-3 px-2 text-center"><Flag size={13} className="inline" /></th>
                {showSprint && <th className="py-3 px-2 text-center"><Sigma size={13} className="inline" /></th>}
              </>
            )}
            {!showGpColumns && (
              <th className="py-3 px-2 text-center"><Star size={13} className="inline" /></th>
            )}
            <th className="py-3 px-2 text-center"><ArrowDownUp size={13} className="inline" /></th>
            {showGanhos && (
              <th className="py-3 px-3 text-center"><DollarSign size={13} className="inline" /></th>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const pos = i + 1;
            const posColor = POSITION_COLORS[pos] ?? 'text-gray-500';

            return (
              <tr
                key={entry.userId}
                onClick={onUserClick ? () => onUserClick(entry.userId) : undefined}
                className={`border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors ${onUserClick ? 'cursor-pointer' : ''}`}
              >
                <td className={`py-4 px-3 font-black ${posColor}`}>
                  {pos <= 3 ? <Trophy size={14} className="inline" /> : pos}
                </td>

                <td className="py-4 px-2">
                  <p className="font-black text-white truncate max-w-40">
                    {entry.username}
                  </p>
                  <p className="text-[10px] text-gray-500 tracking-widest">
                    {entry.category}
                  </p>
                </td>

                {showGpColumns && (
                  <>
                    {showSprint && (
                      <td className="py-4 px-2 text-center tabular-nums text-gray-400 font-semibold">
                        {entry.sprintPoints}
                      </td>
                    )}
                    <td className="py-4 px-2 text-center tabular-nums text-gray-400 font-semibold">
                      {entry.racePoints}
                    </td>
                    {showSprint && (
                      <td className="py-4 px-2 text-center tabular-nums text-white font-black">
                        {entry.gpTotal}
                      </td>
                    )}
                  </>
                )}

                {!showGpColumns && (
                  <td className="py-4 px-2 text-center tabular-nums text-white font-black text-sm">
                    {entry.total}
                  </td>
                )}

                <td className={`py-4 px-2 text-center tabular-nums font-semibold ${entry.gap === 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.gap === 0 ? '—' : `-${entry.gap}`}
                </td>

                {showGanhos && (
                  <td className="py-4 px-3 text-center tabular-nums text-emerald-400 font-semibold">
                    {SHOW_GANHOS_CATEGORIES.has(entry.category)
                      ? `R$ ${entry.ganhos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : ''}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
