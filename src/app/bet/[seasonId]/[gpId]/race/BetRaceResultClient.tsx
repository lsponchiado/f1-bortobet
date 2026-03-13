'use client';

import { useState, useEffect } from 'react';
import { GridPanel } from '@/components/GridPanel';
import { DriverCard } from '@/components/DriverCard';
import type { ResultVariant } from '@/components/DriverCard';

interface DriverBetResult {
  driver: any;
  driverId: number;
  predictedPosition: number;
  actualFinishPosition: number | null;
  basePoints: number;
  mechanics: string[];
  driverTotal: number;
  result: ResultVariant;
}

interface ScoreLine {
  label: string;
  points: number;
}

interface BetRaceResultClientProps {
  driverResults: DriverBetResult[];
  betResults: Record<number, ResultVariant>;
  driverPoints: Record<number, number>;
  fastestLapDriverId: number | null;
  allInDriver: any | null;
  allInPoints: number;
  allowAllIn: boolean;
  predictedSC: number;
  actualSC: number;
  scPoints: number;
  allowSafetyCar: boolean;
  predictedDNF: number;
  actualDNF: number;
  dnfPoints: number;
  allowDNF: boolean;
  doublePoints: boolean;
  baseTotal: number;
  grandTotal: number;
  scoreLines: ScoreLine[];
  gridPositions: Record<number, number>;
  allowHailMary: boolean;
  allowUnderdog: boolean;
  allowFreefall: boolean;
}

export default function BetRaceResultClient({
  driverResults,
  betResults,
  driverPoints,
  fastestLapDriverId,
  allInDriver,
  allInPoints,
  allowAllIn,
  predictedSC,
  actualSC,
  scPoints,
  allowSafetyCar,
  predictedDNF,
  actualDNF,
  dnfPoints,
  allowDNF,
  doublePoints,
  baseTotal,
  grandTotal,
  scoreLines,
  gridPositions,
  allowHailMary,
  allowUnderdog,
  allowFreefall,
}: BetRaceResultClientProps) {
  const grid = driverResults.map(r => r.driver);

  const [isLargeScreen, setIsLargeScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    setIsLargeScreen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const fmtPts = (p: number) => (p > 0 ? `+${p}` : `${p}`);

  const showStatsRow = allowSafetyCar || allowDNF || (allowAllIn && allInDriver);

  return (
    <main className="px-4 lg:px-12 py-6 pb-40 lg:pb-12 flex flex-col items-center gap-6">

      {/* Grid */}
      <div className="w-full max-w-[1200px] mx-auto">
        <GridPanel
          selections={grid}
          interactive={false}
          forceCompact={!isLargeScreen}
          betResults={betResults}
          driverPoints={driverPoints}
          fastestLapDriverId={fastestLapDriverId}
          gridPositions={gridPositions}
          allowHailMary={allowHailMary}
          allowUnderdog={allowUnderdog}
          allowFreefall={allowFreefall}
          showPositionDelta={false}
        />
      </div>

      {/* SC / DNF / All-In cards */}
      {showStatsRow && (
        <div className="w-full max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-3 gap-4">
          {allowSafetyCar && (
            <div className="bg-[#713f12]/30 rounded-2xl border border-[#eab308]/20 p-5 flex flex-col gap-1">
              <p className="text-[#eab308]/60 text-xs font-black uppercase tracking-[0.2em]">Safety Car</p>
              <p className="text-sm text-[#eab308]/60 mt-1">
                Previsto: <span className="text-[#eab308] font-bold">{predictedSC >= 3 ? '3+' : predictedSC}</span>
                {' · '}Real: <span className="text-[#eab308] font-bold">{actualSC}</span>
              </p>
              <p className={`text-2xl font-black italic mt-1 ${scPoints > 0 ? 'text-emerald-400' : 'text-[#eab308]/40'}`}>
                {fmtPts(scPoints)}
              </p>
            </div>
          )}

          {allowDNF && (
            <div className="bg-[#7f1d1d]/20 rounded-2xl border border-[#ef4444]/20 p-5 flex flex-col gap-1">
              <p className="text-[#ef4444]/60 text-xs font-black uppercase tracking-[0.2em]">DNF</p>
              <p className="text-sm text-[#ef4444]/60 mt-1">
                Previsto: <span className="text-[#ef4444] font-bold">{predictedDNF >= 3 ? '3+' : predictedDNF}</span>
                {' · '}Real: <span className="text-[#ef4444] font-bold">{actualDNF}</span>
              </p>
              <p className={`text-2xl font-black italic mt-1 ${dnfPoints > 0 ? 'text-emerald-400' : 'text-[#ef4444]/40'}`}>
                {fmtPts(dnfPoints)}
              </p>
            </div>
          )}

          {allowAllIn && allInDriver && (
            <div className={`bg-[#1f1f27] rounded-2xl border p-5 flex flex-col gap-2 ${allInPoints > 0 ? 'border-emerald-500/30' : allInPoints < 0 ? 'border-red-500/30' : 'border-white/5'}`}>
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">All-In</p>
              <div className="w-full">
                <DriverCard driver={allInDriver} variant="compact" />
              </div>
              <p className={`text-2xl font-black italic ${allInPoints > 0 ? 'text-emerald-400' : allInPoints < 0 ? 'text-red-400' : 'text-white/30'}`}>
                {fmtPts(allInPoints)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Score breakdown table */}
      <div className="w-full max-w-[1200px] mx-auto bg-[#1f1f27] rounded-2xl border border-white/5 p-6 lg:p-8">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-6">Composição da Pontuação</h3>

        <div className="flex flex-col">
          {scoreLines.map((line, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-white/70 font-bold uppercase tracking-wide text-sm">{line.label}</span>
              <span className={`font-black italic text-lg tabular-nums ${line.points > 0 ? 'text-emerald-400' : line.points < 0 ? 'text-red-400' : 'text-white/30'}`}>
                {fmtPts(line.points)}
              </span>
            </div>
          ))}

          {doublePoints && (
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-amber-400 font-bold uppercase tracking-wide text-sm">Double Points</span>
              <span className="text-amber-400 font-black italic text-lg tabular-nums">+{baseTotal}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-5 mt-2 border-t border-white/10">
          <span className="text-white font-black uppercase tracking-widest text-sm">Total</span>
          <span className={`font-black italic text-4xl tabular-nums ${grandTotal > 0 ? 'text-emerald-400' : grandTotal < 0 ? 'text-red-400' : 'text-white'}`}>
            {grandTotal}
          </span>
        </div>
      </div>

    </main>
  );
}
