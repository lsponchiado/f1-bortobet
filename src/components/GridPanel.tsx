'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';
import { DriverCard } from './DriverCard';
import type { ResultVariant } from './DriverCard';

interface GridPanelProps {
  selections: any[];
  initialCompact?: boolean;
  forceCompact?: boolean;
  onSwap?: (sourceIndex: number, targetIndex: number) => void;
  onPlaceNew?: (driverId: string, targetIndex: number) => void;
  interactive?: boolean;
  betResults?: Record<number, ResultVariant>;
  gridPositions?: Record<number, number>;
  allowHailMary?: boolean;
  allowUnderdog?: boolean;
  allowFreefall?: boolean;
  fastestLapDriverId?: number | null;
  onToggleFastestLap?: (driverId: number) => void;
  driverPoints?: Record<number, number>;
  showPositionDelta?: boolean;
}

type LayoutMode = 'full' | 'compact-zigzag' | 'compact-col';

export function GridPanel({
  selections,
  initialCompact,
  forceCompact,
  onSwap,
  onPlaceNew,
  interactive = true,
  betResults = {},
  gridPositions,
  allowHailMary = true,
  allowUnderdog = true,
  allowFreefall = true,
  fastestLapDriverId,
  onToggleFastestLap,
  driverPoints,
  showPositionDelta = true,
}: GridPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>((initialCompact || forceCompact) ? 'compact-col' : 'full');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    // forceCompact=false: always full, no observer needed.
    if (forceCompact === false) {
      setLayoutMode('full');
      return;
    }

    // forceCompact=true: never full, but zigzag vs col depends on width.
    // forceCompact=undefined: fully auto.
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[entries.length - 1].contentRect;
      if (!forceCompact && width >= 1000) setLayoutMode('full');
      else if (width >= 280) setLayoutMode('compact-zigzag');
      else setLayoutMode('compact-col');
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [forceCompact]);

  const isFull = layoutMode === 'full';
  const isSingleCol = layoutMode === 'compact-col';
  const isCompact = layoutMode !== 'full';

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!interactive) return;
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { setDraggedIndex(index); }, 0);
  };

  const handleDragEnd = () => { setDraggedIndex(null); };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    if (!interactive) return;
    e.preventDefault();

    const newDriverId = e.dataTransfer.getData('newDriverId');
    if (newDriverId && onPlaceNew) {
      onPlaceNew(newDriverId, targetIndex);
      return;
    }

    const sourceIndexRaw = e.dataTransfer.getData('text/plain');
    if (sourceIndexRaw) {
      const sourceIndex = parseInt(sourceIndexRaw, 10);
      if (sourceIndex !== targetIndex && onSwap) {
        onSwap(sourceIndex, targetIndex);
      }
    }
  };

  return (
    <div ref={containerRef} className="w-full mx-auto p-10 overflow-visible bg-[#1f1f27] rounded-3xl">
      <div className={`w-full mx-auto flex flex-col transition-all duration-500 ease-in-out ${isFull ? 'max-w-full space-y-1' :(isSingleCol ? 'max-w-full space-y-14' : 'max-w-[688px] space-y-14')}`}>
        {selections.map((driver, idx) => {
          const position = idx + 1;
          const isRight = position % 2 === 0;
          const cardResult = betResults[idx] || 'neutral';

          return (
            <div key={position} className={`flex w-full pointer-events-none ${isSingleCol ? 'justify-center' : (isRight ? 'justify-end' : 'justify-start')}`} style={{ zIndex: 50 - idx }}>
              <div className={`flex flex-col shrink-0 pointer-events-auto transition-all duration-500 ease-in-out ${isCompact ? 'w-[226px]' : 'w-[552px]'}`}>

                {/* Status bar */}
                {(() => {
                  const qualPos = (driver && gridPositions) ? (gridPositions[driver.id] ?? null) : null;
                  const effectiveStartPos = qualPos ?? driver?.startPosition ?? null;
                  const delta = (effectiveStartPos && effectiveStartPos <= 22) ? effectiveStartPos - position : null;
                  const deltaStr = delta === null ? null : delta === 0 ? '=' : delta > 0 ? `+${delta}` : `${delta}`;
                  const deltaColor = delta === null || delta === 0 ? 'text-white/20' : delta > 0 ? 'text-emerald-400' : 'text-red-400';

                  const hailMary = allowHailMary && qualPos !== null && qualPos >= 20 && position <= 5;
                  const underdog = allowUnderdog && qualPos !== null && position <= 3 && (qualPos - position) >= 10;
                  const freefall = allowFreefall && qualPos !== null && (position - qualPos) >= 5;

                  const isFastestLap = !!(driver && fastestLapDriverId === driver.id);
                  const showFLToggle = !!(driver && onToggleFastestLap);
                  const showSideBar = showFLToggle || !!(driverPoints && driver);

                  // Result mode FL indicator (non-interactive)
                  const isPredictedFL = !interactive && driver && fastestLapDriverId === driver.id;
                  const flHit = isPredictedFL && cardResult === 'purple';
                  const flBadge = isPredictedFL ? (
                    <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded border ${flHit ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                      <Timer size={10} strokeWidth={2.5} />
                      {!isCompact && 'Volta Rápida'}
                    </span>
                  ) : null;

                  const flButton = showFLToggle ? (
                    <button
                      onClick={() => onToggleFastestLap!(driver.id)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                        isFastestLap
                          ? 'bg-[#7c3aed] text-white shadow-[0_0_10px_2px_rgba(124,58,237,0.5)]'
                          : 'bg-white/5 text-white/25 hover:bg-white/10 hover:text-white/50'
                      }`}
                    >
                      <Timer size={16} strokeWidth={2.5} />
                    </button>
                  ) : null;

                  const hasBadge = hailMary || underdog || freefall || isPredictedFL;
                  const badges = hasBadge ? (
                    <div className="flex items-center gap-1.5 mx-2">
                      {hailMary && <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{isCompact ? 'HM' : 'Hail Mary'}</span>}
                      {underdog && <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{isCompact ? 'UD' : 'Underdog'}</span>}
                      {freefall && <span className="text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">{isCompact ? 'FF' : 'Freefall'}</span>}
                      {flBadge}
                    </div>
                  ) : null;

                  const align = isSingleCol ? 'justify-start' : (isRight ? 'justify-end' : 'justify-start');

                  // Side status bar goes on the right for left-col cards, left for right-col cards
                  const sideOnLeft = isRight && !isSingleCol;

                  const driverPts = (driverPoints && driver) ? (driverPoints[driver.id] ?? null) : null;
                  const ptsColor = driverPts !== null && driverPts > 0 ? 'text-emerald-400' : driverPts !== null && driverPts < 0 ? 'text-red-400' : 'text-white/30';
                  const sideBar = (
                    <div className={`flex flex-col items-center justify-start w-auto shrink-0 min-w-[60px] ${isCompact ? 'pt-[6px]' : 'pt-[22px]'}`}>
                      {driverPts !== null ? (
                        <div className="flex items-baseline gap-1">
                          <span className={`text-xl font-black tabular-nums leading-none ${ptsColor}`}>
                            {driverPts > 0 ? '+' : ''}{driverPts}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-wider ${ptsColor} opacity-60`}>
                            pts
                          </span>
                        </div>
                      ) : flButton}
                    </div>
                  );

                  return (
                    <>
                      <div className={`flex items-center gap-2 pb-3 flex-wrap ${align}`}>
                        {isRight && (
                          <>
                            {badges}
                            {showPositionDelta && deltaStr && <span className={`text-xl font-black italic tracking-tighter px-2 ${deltaColor}`}>{deltaStr}</span>}
                          </>
                        )}
                        <span className="text-3xl font-black italic text-white/40 uppercase tracking-tighter">P{position}</span>
                        {!isRight && (
                          <>
                            {showPositionDelta && deltaStr && <span className={`text-xl font-black italic tracking-tighter px-2 ${deltaColor}`}>{deltaStr}</span>}
                            {badges}
                          </>
                        )}
                      </div>

                      <div className={`flex flex-row items-stretch gap-3 w-full ${sideOnLeft ? 'justify-end' : ''}`}>
                        {showSideBar && sideOnLeft && sideBar}
                        <div
                          className={`group relative shrink-0 transition-all duration-500 ease-in-out ${isCompact ? 'w-[174px] p-3 min-h-[94px]' : 'w-[500px] p-6 min-h-[180px]'} border-2 border-transparent ${interactive ? 'hover:border-white/10' : ''} rounded-lg bg-transparent`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx)}
                        >
                          <div className="absolute top-0 left-0 right-0 h-[6px] bg-white transition-all duration-500 ease-in-out" />
                          <div className={`absolute top-0 left-0 w-[6px] transition-all duration-500 ease-in-out ${isCompact ? 'h-12' : 'h-20'} bg-white`} />
                          <div className={`absolute top-0 right-0 w-[6px] transition-all duration-500 ease-in-out ${isCompact ? 'h-12' : 'h-20'} bg-white`} />

                          <div className={`h-full w-full flex items-center justify-center transition-opacity duration-300 ${!driver ? 'opacity-20' : 'opacity-100'}`}>
                            {driver ? (
                              <div
                                draggable={interactive}
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragEnd={handleDragEnd}
                                className={`w-full transition-opacity duration-300 ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedIndex === idx ? 'opacity-40' : 'opacity-100'}`}
                              >
                                <DriverCard driver={driver} variant={isCompact ? 'compact' : 'full'} result={cardResult} />
                              </div>
                            ) : (
                              <div className={`transition-all duration-500 ease-in-out ${isCompact ? 'h-16' : 'h-32'} w-full flex items-center justify-center`}>
                                <div className="w-6 h-[2px] bg-white/40 rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                        {showSideBar && !sideOnLeft && sideBar}
                      </div>
                    </>
                  );
                })()}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
