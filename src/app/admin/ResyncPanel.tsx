'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { resyncSessionResults } from '@/lib/admin-actions';

type ResyncSession = {
  id: number;
  type: string;
  round: number;
  date: string;
  gpName: string;
  openf1Key: number;
};

export function ResyncPanel({ sessions }: { sessions: ResyncSession[] }) {
  const [isPending, startTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [status, setStatus] = useState<Record<number, 'success' | 'error'>>({});

  const handleSync = (sessionId: number) => {
    setSyncingId(sessionId);
    startTransition(async () => {
      const result = await resyncSessionResults(sessionId);
      setStatus(prev => ({ ...prev, [sessionId]: result.success ? 'success' : 'error' }));
      setSyncingId(null);
    });
  };

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Sincronizar Resultados</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Re-importa resultados da OpenF1 (desclassificações, correções)</p>
        </div>
      </div>
      <div className="p-6 flex flex-col gap-2">
        {sessions.length === 0 && (
          <p className="text-gray-600 text-sm font-bold">Nenhuma sessão com openf1Key mapeado</p>
        )}
        {sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between bg-black/20 rounded-xl px-4 py-3">
            <div className="flex flex-col">
              <span className="text-white text-sm font-bold">{s.gpName}</span>
              <span className="text-gray-500 text-xs font-bold">
                R{s.round} — {s.type === 'RACE' ? 'Corrida' : 'Sprint'} — {new Date(s.date).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <button
              onClick={() => handleSync(s.id)}
              disabled={isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-95 ${
                status[s.id] === 'success'
                  ? 'bg-green-600 text-white'
                  : status[s.id] === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-white/5 text-white hover:bg-white/10'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingId === s.id ? 'animate-spin' : ''}`} />
              {syncingId === s.id ? 'Sincronizando...' : status[s.id] === 'success' ? 'Atualizado' : status[s.id] === 'error' ? 'Erro' : 'Sync'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
