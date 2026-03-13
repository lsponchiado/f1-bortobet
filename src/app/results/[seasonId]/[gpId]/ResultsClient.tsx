'use client';

import { useState, useEffect } from 'react';
import { GridPanel } from '@/components/GridPanel';
import type { ResultVariant } from '@/components/DriverCard';

type SessionType =
  | 'PRACTICE_1' | 'PRACTICE_2' | 'PRACTICE_3'
  | 'SPRINT_QUALIFYING' | 'QUALIFYING' | 'SPRINT' | 'RACE';

const SESSION_LABELS: Record<SessionType, string> = {
  PRACTICE_1:        'TL 1',
  PRACTICE_2:        'TL 2',
  PRACTICE_3:        'TL 3',
  SPRINT_QUALIFYING: 'Spr. Class.',
  QUALIFYING:        'Class.',
  SPRINT:            'Sprint',
  RACE:              'Corrida',
};

interface Driver {
  id: number;
  name: string;
  number: number;
  headshotUrl: string | null;
  country: string;
  fastestLap?: boolean;
  startPosition?: number;
  dnf?: boolean;
  team: { name: string; logoUrl: string | null; color: string };
}

interface SessionInfo {
  id: number;
  type: SessionType;
  date: Date;
  scCount: number;
  vscCount: number;
  results: Driver[];
}

interface ResultsClientProps {
  sessions: SessionInfo[];
  fallbackDrivers: Driver[];
  gpName: string;
}

export default function ResultsClient({ sessions, fallbackDrivers, gpName }: ResultsClientProps) {
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    setIsLargeScreen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const selected = sessions.find((s) => s.id === selectedId);
  const displayDrivers = selected?.results.length ? selected.results : fallbackDrivers;

  const betResults: Record<number, ResultVariant> = {};
  displayDrivers.forEach((d, idx) => {
    if (d.dnf) betResults[idx] = 'red';
    else if (d.fastestLap) betResults[idx] = 'purple';
  });

  const dnfCount = displayDrivers.filter((d) => d.dnf).length;
  const showStats = selected?.type === 'RACE' || selected?.type === 'SPRINT';

  const sessionButtons = sessions.map((s) => {
    const active = s.id === selectedId;
    return (
      <button
        key={s.id}
        onClick={() => setSelectedId(s.id)}
        className={`shrink-0 px-5 py-4 rounded-xl font-black italic uppercase text-base tracking-tight transition-all active:scale-95
          ${active
            ? 'bg-[#e10600] text-white'
            : 'text-white/40 hover:text-white hover:bg-white/5'}`}
      >
        {SESSION_LABELS[s.type]}
      </button>
    );
  });

  return (
    <div className="flex flex-col lg:flex-row gap-0 pt-4">

      {/* Mobile: botões no topo */}
      <div className="lg:hidden px-4 pb-4">
        <div className="bg-[#1f1f27] rounded-2xl border border-white/5 p-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sessionButtons}
        </div>
      </div>

      {/* Desktop: sidebar */}
      <aside className="hidden lg:block w-80 shrink-0 pl-6 lg:pl-10">
        <div className="sticky top-24 pt-6">
          <div className="bg-[#1f1f27] rounded-2xl border border-white/5 p-6 flex flex-col gap-1">
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Resultados</p>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-tight mb-5 border-l-2 border-[#e10600] pl-3">
              {gpName}
            </h1>
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Sessões</p>
            {sessionButtons}
          </div>
        </div>
      </aside>

      {/* Grid de resultados */}
      <main className="flex-1 min-w-0 pb-40 lg:pb-12">
        {displayDrivers.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-white/20 font-black italic uppercase text-sm tracking-widest">
            Sem resultados disponíveis
          </div>
        ) : (
          <>
            <div className="px-4 lg:px-0 max-w-[1200px] mx-auto">
              <GridPanel
                selections={displayDrivers}
                interactive={false}
                forceCompact={!isLargeScreen}
                betResults={betResults}
              />
            </div>
            {showStats && (
              <div className="grid grid-cols-3 gap-4 px-6 pb-6 pt-2">
                <div className="bg-[#713f12]/30 rounded-2xl border border-[#eab308]/20 p-5 flex flex-col gap-1">
                  <p className="text-[#eab308]/60 text-xs font-black uppercase tracking-[0.2em]">Safety Car</p>
                  <p className="text-4xl font-black italic text-[#eab308] tracking-tighter">{selected.scCount}</p>
                </div>
                <div className="bg-[#713f12]/30 rounded-2xl border border-[#eab308]/20 p-5 flex flex-col gap-1">
                  <p className="text-[#eab308]/60 text-xs font-black uppercase tracking-[0.2em]">Virtual SC</p>
                  <p className="text-4xl font-black italic text-[#eab308] tracking-tighter">{selected.vscCount}</p>
                </div>
                <div className="bg-[#7f1d1d]/20 rounded-2xl border border-[#ef4444]/20 p-5 flex flex-col gap-1">
                  <p className="text-[#ef4444]/60 text-xs font-black uppercase tracking-[0.2em]">DNF</p>
                  <p className="text-4xl font-black italic text-[#ef4444] tracking-tighter">{dnfCount}</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
