// src/components/BetExtrasPanel.tsx
import { useMemo } from 'react';
import { Timer, ShieldAlert, Ban, ChevronDown } from 'lucide-react';
import GridCard from './GridCard';
import type { GridDriver } from '../types/grid';

interface BetExtrasPanelProps {
  isEditable: boolean;
  allDrivers: GridDriver[];
  fastestLapId: number | null;
  onFastestLapChange: (id: number | null) => void;
  predictedSC: number;
  onSCChange: (n: number) => void;
  predictedDNF: number;
  onDNFChange: (n: number) => void;
}

const SC_DNF_OPTIONS = [0, 1, 2, 3];

export function BetExtrasPanel({
  isEditable,
  allDrivers,
  fastestLapId,
  onFastestLapChange,
  predictedSC,
  onSCChange,
  predictedDNF,
  onDNFChange,
}: BetExtrasPanelProps) {
  const selectedFastestLapDriver: GridDriver = useMemo(() => {
    if (!fastestLapId) return { id: -1, lastName: '???', code: '???', number: 0, headshotUrl: null, team: { name: '', color: '#333', logoUrl: null } };
    return allDrivers.find(d => d.id === fastestLapId) ?? { id: -1, lastName: '???', code: '???', number: 0, headshotUrl: null, team: { name: '', color: '#333', logoUrl: null } };
  }, [fastestLapId, allDrivers]);

  const groupedDrivers: [string, GridDriver[]][] = useMemo(() => {
    const groups: Record<string, GridDriver[]> = {};
    for (const d of allDrivers) {
      const team = d.team.name || 'Sem equipe';
      if (!groups[team]) groups[team] = [];
      groups[team].push(d);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [allDrivers]);

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto gap-2">
      {/* Fastest Lap */}
      <div className="flex w-full flex-row items-center gap-1 sm:gap-2 overflow-visible">
        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-sm bg-purple-600 text-white shadow-lg">
          <Timer size={22} />
        </div>

        <GridCard driver={selectedFastestLapDriver} variant="default" />

        {isEditable && (
          <div className="relative h-16 w-10 shrink-0">
            <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-gray-800 text-white pointer-events-none">
              <ChevronDown size={20} />
            </div>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'clear') {
                  onFastestLapChange(null);
                } else {
                  onFastestLapChange(Number(val));
                }
                e.target.value = '';
              }}
              defaultValue=""
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            >
              <option value="" disabled hidden></option>
              <option value="clear">Limpar</option>
              {groupedDrivers.map(([team, drivers]) => (
                <optgroup key={team} label={team}>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.lastName}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Safety Cars */}
      <div className="flex w-full flex-row items-center gap-1 sm:gap-2">
        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-sm bg-yellow-500 text-black shadow-lg">
          <ShieldAlert size={22} />
        </div>
        <div className="flex flex-1 h-16 items-center gap-1 sm:gap-2 rounded-sm bg-gray-700 border border-white/5 shadow-lg px-2">
          {SC_DNF_OPTIONS.map((n) => (
            <button
              key={n}
              disabled={!isEditable}
              onClick={() => onSCChange(n)}
              className={`flex-1 h-12 text-sm font-black rounded-sm transition-all ${
                predictedSC === n
                  ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {n === 3 ? '3+' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Abandonos */}
      <div className="flex w-full flex-row items-center gap-1 sm:gap-2">
        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-sm bg-red-600 text-white shadow-lg">
          <Ban size={22} />
        </div>
        <div className="flex flex-1 h-16 items-center gap-1 sm:gap-2 rounded-sm bg-gray-700 border border-white/5 shadow-lg px-2">
          {SC_DNF_OPTIONS.map((n) => (
            <button
              key={n}
              disabled={!isEditable}
              onClick={() => onDNFChange(n)}
              className={`flex-1 h-12 text-sm font-black rounded-sm transition-all ${
                predictedDNF === n
                  ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.3)]'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {n === 3 ? '3+' : n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}