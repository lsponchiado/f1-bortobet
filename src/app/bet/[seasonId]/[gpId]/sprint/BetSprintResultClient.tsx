'use client';

import { useState, useEffect } from 'react';
import { GridPanel } from '@/components/GridPanel';
import type { ResultVariant } from '@/components/DriverCard';

interface DriverBetResult {
  driver: any;
  driverId: number;
  predictedPosition: number;
  actualFinishPosition: number | null;
  basePoints: number;
  driverTotal: number;
  result: ResultVariant;
}

interface ScoreLine {
  label: string;
  points: number;
}

interface BetSprintResultClientProps {
  driverResults: DriverBetResult[];
  betResults: Record<number, ResultVariant>;
  driverPoints: Record<number, number>;
  grandTotal: number;
  scoreLines: ScoreLine[];
  gridPositions: Record<number, number>;
}

export default function BetSprintResultClient({
  driverResults,
  betResults,
  driverPoints,
  grandTotal,
  scoreLines,
  gridPositions,
}: BetSprintResultClientProps) {
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
          gridPositions={gridPositions}
          allowHailMary={false}
          allowUnderdog={false}
          allowFreefall={false}
          showPositionDelta={false}
        />
      </div>

      {/* Score breakdown table */}
      <div className="w-full bg-[#1f1f27] rounded-2xl border border-white/5 p-6 lg:p-8">
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
