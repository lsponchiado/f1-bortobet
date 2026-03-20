'use client';

import { useState, useTransition } from 'react';
import { Ticket } from 'lucide-react';
import { generateInviteCode } from '@/lib/admin-actions';

export function InvitePanel() {
  const [category, setCategory] = useState<'HAAS' | 'STROLL'>('HAAS');
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setCode(null);
    setError(null);
    startTransition(async () => {
      const result = await generateInviteCode(category);
      if (result.success && result.code) {
        setCode(result.code);
      } else {
        setError(result.error ?? 'Erro desconhecido');
      }
    });
  };

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <Ticket className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Gerar Convite</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Crie códigos de convite para novos participantes</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          {(['HAAS', 'STROLL'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setCode(null); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                category === cat
                  ? 'bg-[#e10600] text-white'
                  : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 hover:bg-[#e10600] hover:text-white text-gray-400 disabled:bg-white/10 disabled:text-white/20"
        >
          {isPending ? 'Gerando...' : 'Gerar Código'}
        </button>

        {code && (
          <div
            onClick={() => { navigator.clipboard.writeText(code); }}
            className="flex items-center justify-center py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors"
          >
            <span className="text-2xl font-black tracking-[0.3em] text-emerald-400 select-all">{code}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-xs font-bold text-red-400">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
