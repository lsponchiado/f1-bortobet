'use client';

import { useState, useEffect, useRef } from 'react';
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
  hideTeamLogo?: boolean;
  gridPositions?: Record<number, number>;
  allowHailMary?: boolean;
  allowUnderdog?: boolean;
  allowFreefall?: boolean;
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
  hideTeamLogo = false,
  gridPositions,
  allowHailMary = true,
  allowUnderdog = true,
  allowFreefall = true,
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
      else if (width >= 350) setLayoutMode('compact-zigzag');
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
    <div ref={containerRef} className="w-full max-w-[1150px] mx-auto pt-4 pb-8 overflow-visible">
      <div className={`w-full mx-auto flex flex-col transition-all duration-500 ease-in-out ${isFull ? 'max-w-full space-y-3' : (isSingleCol ? 'max-w-full space-y-24' : 'max-w-[584px] space-y-24')}`}>
        {selections.map((driver, idx) => {
          const position = idx + 1;
          const isRight = position % 2 === 0;
          const cardResult = betResults[idx] || 'neutral';

          return (
            <div key={position} className={`flex w-full pointer-events-none ${isSingleCol ? 'justify-center' : (isRight ? 'justify-end' : 'justify-start')}`} style={{ zIndex: 50 - idx }}>
              <div className={`flex flex-col shrink-0 pointer-events-auto transition-all duration-500 ease-in-out ${isCompact ? 'w-[174px]' : 'w-[500px]'}`}>

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

                  const align = isSingleCol ? 'justify-start' : (isRight ? 'justify-end' : 'justify-start');
                  return (
                    <div className={`flex items-center gap-2 pb-3 flex-wrap ${align}`}>
                      {isRight && (
                        <>
                          {hailMary && <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Hail Mary</span>}
                          {underdog && <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Underdog</span>}
                          {freefall && <span className="text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Freefall</span>}
                          {deltaStr && <span className={`text-xl font-black italic tracking-tighter px-2 ${deltaColor}`}>{deltaStr}</span>}
                        </>
                      )}
                      <span className="text-3xl font-black italic text-white/40 uppercase tracking-tighter">P{position}</span>
                      {!isRight && (
                        <>
                          {deltaStr && <span className={`text-xl font-black italic tracking-tighter px-2 ${deltaColor}`}>{deltaStr}</span>}
                          {hailMary && <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Hail Mary</span>}
                          {underdog && <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Underdog</span>}
                          {freefall && <span className="text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Freefall</span>}
                        </>
                      )}
                    </div>
                  );
                })()}

                <div
                  className={`group relative w-full transition-all duration-500 ease-in-out ${isCompact ? 'p-3 min-h-[94px]' : 'p-6 min-h-[180px]'} border-2 border-transparent ${interactive ? 'hover:border-white/10' : ''} rounded-lg bg-transparent`}
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
                        <DriverCard driver={driver} variant={isCompact ? 'compact' : 'full'} result={cardResult} hideTeamLogo={isCompact && hideTeamLogo} />
                      </div>
                    ) : (
                      <div className={`transition-all duration-500 ease-in-out ${isCompact ? 'h-16' : 'h-32'} w-full flex items-center justify-center`}>
                        <div className="w-6 h-[2px] bg-white/40 rounded-full" />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
