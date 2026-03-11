'use client';

import { History, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface PastRace {
  eventName: string;
  trackName: string;
  country: string;
  trackMapUrl: string;
  seasonId: number;
  gpId: number;
  hasSprint: boolean;
  raceDate: Date;
}

interface ResultsPanelProps {
  races: PastRace[];
}

export function ResultsPanel({ races }: ResultsPanelProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  if (races.length === 0) return null;

  const race = races[index];

  const canPrev = index < races.length - 1;
  const canNext = index > 0;

  return (
    <div className="w-full max-w-4xl bg-[#1f1f27] rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
      <div className="h-1 w-full bg-white/10" />
      <div className="p-8 flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <header className="space-y-1">
            <div className="flex items-center gap-2 text-white/30 mb-1">
              <History size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Resultados Anteriores</span>
            </div>

            <div className="flex items-center gap-5">
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
                {race.eventName}
              </h2>
              <div className="flex items-center">
                <img
                  src={`https://flagcdn.com/w640/${(race.country || '').toLowerCase()}.png`}
                  alt={race.country}
                  className="h-12 w-auto rounded-sm border border-white/10 shadow-xl object-contain"
                />
              </div>
            </div>

            <div className="text-gray-400 mt-2 uppercase tracking-widest font-bold text-[10px]">
              {race.trackName}
            </div>
          </header>

          {/* Navigator */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIndex(i => i + 1)}
              disabled={!canPrev}
              className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              {races.length - index} / {races.length}
            </span>
            <button
              onClick={() => setIndex(i => i - 1)}
              disabled={!canNext}
              className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="space-y-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Sprint Race</span>
              <button
                onClick={() => router.push(`/bet/${race.seasonId}/${race.gpId}/sprint`)}
                disabled={!race.hasSprint}
                className="w-full py-4 rounded-xl font-black italic uppercase text-sm transition-all active:scale-95 shadow-lg bg-[#e10600] hover:bg-[#ff0700] text-white disabled:bg-gray-800 disabled:text-gray-500"
              >
                {race.hasSprint ? 'VER APOSTA' : 'SEM SPRINT'}
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Grand Prix</span>
              <button
                onClick={() => router.push(`/bet/${race.seasonId}/${race.gpId}/race`)}
                className="w-full py-4 rounded-xl font-black italic uppercase text-sm transition-all active:scale-95 shadow-lg bg-[#e10600] hover:bg-[#ff0700] text-white"
              >
                VER APOSTA
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Oficial</span>
              <button
                onClick={() => router.push(`/results/${race.seasonId}/${race.gpId}`)}
                className="w-full py-4 rounded-xl font-black italic uppercase text-sm transition-all active:scale-95 shadow-lg bg-white text-black hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} />
                RESULTADO
              </button>
            </div>
          </div>
        </div>

        <div className="w-full md:w-72 md:pl-6 flex items-center justify-center bg-black/20 rounded-2xl p-6 border border-white/5 relative group">
          <img
            src={race.trackMapUrl}
            alt={race.trackName}
            className="w-full h-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-500"
          />
        </div>
      </div>
    </div>
  );
}
