'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { resyncSessionResults, syncAllPending } from '@/lib/admin-actions';

type ResyncSession = {
  id: number;
  type: string;
  round: number;
  date: string;
  gpName: string;
  openf1Key: number;
};

type SyncResult = { sessionId: number; gpName: string; type: string; status: 'synced' | 'skipped' | 'error'; error?: string };

const SESSION_TYPE_LABELS: Record<string, string> = {
  RACE: 'Corrida',
  SPRINT: 'Sprint',
};

export function ResyncPanel({ sessions }: { sessions: ResyncSession[] }) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>('all');
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [singleResult, setSingleResult] = useState<{ success: boolean } | null>(null);

  const isSyncing = isPending;

  const handleSync = () => {
    setResults(null);
    setSingleResult(null);

    if (selected === 'all') {
      startTransition(async () => {
        const result = await syncAllPending();
        setResults(result.results);
      });
    } else {
      const sessionId = parseInt(selected, 10);
      startTransition(async () => {
        const result = await resyncSessionResults(sessionId);
        setSingleResult(result);
      });
    }
  };

  const selectedSession = selected !== 'all' ? sessions.find(s => s.id === parseInt(selected, 10)) : null;

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5 text-[#e10600]" />
        </div>
        <div className="flex-1">
          <h3 className="font-black uppercase italic tracking-tight text-white">Sincronizar Resultados</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Selecione a sessão ou sincronize tudo</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setResults(null); setSingleResult(null); }}
            disabled={isSyncing}
            className="flex-1 bg-black/30 border border-white/10 text-white text-sm font-bold rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-[#e10600]/50 disabled:opacity-50"
          >
            <option value="all">Todas as pendentes</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.gpName} — {SESSION_TYPE_LABELS[s.type] || s.type} — R{s.round}
              </option>
            ))}
          </select>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-[#e10600] hover:bg-[#ff0700] disabled:bg-white/10 disabled:text-white/30 text-white font-black uppercase italic tracking-wider px-6 py-3 rounded-xl transition-all active:scale-[0.98] shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? '...' : 'Sync'}
          </button>
        </div>

        {/* Sync All results */}
        {results && (
          <div className="flex flex-col gap-1.5">
            {results.length === 0 ? (
              <p className="text-gray-500 text-sm font-bold text-center py-2">Nenhuma sessão pendente</p>
            ) : (
              results.map(r => (
                <div key={r.sessionId} className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-white text-sm font-bold">{r.gpName}</span>
                    <span className="text-gray-500 text-[10px] font-bold uppercase">{SESSION_TYPE_LABELS[r.type] || r.type}</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                    r.status === 'synced' ? 'bg-green-500/20 text-green-400' : r.status === 'skipped' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {r.status === 'synced' ? 'Atualizado' : r.status === 'skipped' ? 'Sem dados' : r.error || 'Erro'}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Single session result */}
        {singleResult && selectedSession && (
          <div className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-2.5">
            <div className="flex flex-col">
              <span className="text-white text-sm font-bold">{selectedSession.gpName}</span>
              <span className="text-gray-500 text-[10px] font-bold uppercase">{SESSION_TYPE_LABELS[selectedSession.type] || selectedSession.type}</span>
            </div>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
              singleResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {singleResult.success ? 'Atualizado' : 'Erro'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
