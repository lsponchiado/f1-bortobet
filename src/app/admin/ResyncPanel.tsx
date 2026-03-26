'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { syncGpSessions } from '@/lib/admin-actions';

type ResyncGp = {
  id: number;
  name: string;
  round: number;
  sessionCount: number;
};

type SyncResult = { sessionType: string; status: 'synced' | 'no_data' | 'error'; error?: string };

const SESSION_LABELS: Record<string, string> = {
  PRACTICE_1: 'Treino Livre 1',
  PRACTICE_2: 'Treino Livre 2',
  PRACTICE_3: 'Treino Livre 3',
  SPRINT_QUALIFYING: 'Classificação Sprint',
  QUALIFYING: 'Classificação',
  SPRINT: 'Sprint',
  RACE: 'Corrida',
};

export function ResyncPanel({ gps }: { gps: ResyncGp[] }) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>(gps[0]?.id?.toString() ?? '');
  const [results, setResults] = useState<SyncResult[] | null>(null);

  const handleSync = () => {
    if (!selected) return;
    setResults(null);

    const gpId = parseInt(selected, 10);
    startTransition(async () => {
      const result = await syncGpSessions(gpId);
      setResults(result.results);
    });
  };

  const selectedGp = gps.find(g => g.id === parseInt(selected, 10));

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5 text-[#e10600]" />
        </div>
        <div className="flex-1">
          <h3 className="font-black uppercase italic tracking-tight text-white">Sincronizar Resultados</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Sincroniza todas as sessões do GP selecionado</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setResults(null); }}
            disabled={isPending}
            className="flex-1 bg-black/30 border border-white/10 text-white text-sm font-bold rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-[#e10600]/50 disabled:opacity-50"
          >
            {gps.length === 0 && <option value="">Nenhum GP disponível</option>}
            {gps.map(gp => (
              <option key={gp.id} value={gp.id}>
                R{gp.round} — {gp.name} ({gp.sessionCount} sessões)
              </option>
            ))}
          </select>

          <button
            onClick={handleSync}
            disabled={isPending || !selected}
            className="flex items-center gap-2 bg-[#e10600] hover:bg-[#ff0700] disabled:bg-white/10 disabled:text-white/30 text-white font-black uppercase italic tracking-wider px-6 py-3 rounded-xl transition-all active:scale-[0.98] shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            {isPending ? '...' : 'Sync'}
          </button>
        </div>

        {results && (
          <div className="flex flex-col gap-1.5">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-2.5">
                <span className="text-white text-sm font-bold">{SESSION_LABELS[r.sessionType] || r.sessionType}</span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                  r.status === 'synced' ? 'bg-green-500/20 text-green-400' :
                  r.status === 'no_data' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {r.status === 'synced' ? 'OK' : r.status === 'no_data' ? 'Sem dados' : r.error || 'Erro'}
                </span>
              </div>
            ))}
            {selectedGp && (
              <p className="text-gray-500 text-[10px] font-bold text-center mt-1">
                {results.filter(r => r.status === 'synced').length}/{results.length} sessões sincronizadas — {selectedGp.name}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
