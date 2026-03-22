import type { RaceResultData, SprintResultData } from '@/lib/constants';

interface BetResultsTableProps {
  result: RaceResultData | SprintResultData;
  isRace: boolean;
}

export function BetResultsTable({ result, isRace }: BetResultsTableProps) {
  const gridTotal = result.somaPos.reduce((a, b) => a + b, 0);

  const rows: { label: string; value: number }[] = [
    { label: 'Grid', value: gridTotal },
  ];

  if (isRace && 'fastestLap' in result) {
    const r = result as RaceResultData;
    rows.push(
      { label: 'Volta Rápida', value: r.fastestLap },
      { label: 'Safety Car', value: r.safetyCar },
      { label: 'Abandonos', value: r.abandonos },
      { label: 'Hail Mary', value: r.hailMary.reduce((a, b) => a + b, 0) },
      { label: 'Underdog', value: r.underdog.reduce((a, b) => a + b, 0) },
      { label: 'Freefall', value: r.freefall.reduce((a, b) => a + b, 0) },
    );
  }

  const visibleRows = rows.filter(r => r.label === 'Grid' || r.value !== 0);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="rounded-sm overflow-hidden border border-white/5">
        {visibleRows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-4 py-3 text-sm font-bold ${
              i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'
            }`}
          >
            <span className="text-gray-400 uppercase italic tracking-wider text-xs">{row.label}</span>
            <span className={row.value > 0 ? 'text-green-400' : 'text-gray-500'}>
              {row.value > 0 ? `+${row.value}` : row.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-4 bg-[#1f1f27] border-t border-white/10">
          <span className="text-white uppercase italic tracking-wider text-xs font-black">Total</span>
          <span className={`text-lg font-black ${result.somaTotal > 0 ? 'text-green-400' : 'text-gray-500'}`}>
            {result.somaTotal > 0 ? `+${result.somaTotal}` : result.somaTotal}
          </span>
        </div>
      </div>
    </div>
  );
}
