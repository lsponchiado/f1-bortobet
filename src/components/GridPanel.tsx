'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DriverCard } from './DriverCard';

interface GridPanelProps {
  selections: any[];
  isMobile?: boolean; 
  onSwap?: (sourceIndex: number, targetIndex: number) => void;
  onPlaceNew?: (driverId: string, targetIndex: number) => void;
  interactive?: boolean;
  
  showFastestLapToggle?: boolean;
  showFavoriteDriverToggle?: boolean;

  fastestLapIndex?: number | null;
  actualFastestLapIndex?: number | null; 
  onToggleFastestLap?: (index: number) => void;
  
  favoriteDriverIndex?: number | null;
  onToggleFavoriteDriver?: (index: number) => void;
  
  showPositionChanges?: boolean;
  positionChanges?: Record<number, number>;
  betResults?: Record<number, 'neutral' | 'green' | 'red'>; 
  earnedPoints?: Record<number, number>; 
}

type LayoutMode = 'full' | 'compact-zigzag' | 'compact-col';

export const GridPanel: React.FC<GridPanelProps> = ({ 
  selections, 
  isMobile: serverIsMobile, 
  onSwap, 
  onPlaceNew,
  interactive = true,
  showFastestLapToggle = true,
  showFavoriteDriverToggle = true,
  fastestLapIndex = null,
  actualFastestLapIndex = null,
  onToggleFastestLap,
  favoriteDriverIndex = null,
  onToggleFavoriteDriver,
  showPositionChanges = false,
  positionChanges = {},
  betResults = {},
  earnedPoints = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(serverIsMobile ? 'compact-col' : 'full');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        if (width >= 960) setLayoutMode('full');
        else if (width >= 350) setLayoutMode('compact-zigzag');
        else setLayoutMode('compact-col');
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
    // AQUI: Alterei de pb-40 para pb-8 para remover aquele buraco gigante embaixo do grid.
    <div ref={containerRef} className="w-full max-w-[1150px] mx-auto pt-12 pb-8 overflow-visible">
      
      {/* Ajuste fino de space-y para encaixar com a nova margem colada */}
      <div className={`w-full mx-auto flex flex-col transition-all duration-500 ease-in-out ${isFull ? 'max-w-full space-y-[-32px]' : (isSingleCol ? 'max-w-full space-y-12' : 'max-w-[584px] space-y-10')}`}>
        {selections.map((driver, idx) => {
          const position = idx + 1;
          const isRight = position % 2 === 0;
          
          const isFavoriteDriver = favoriteDriverIndex === idx;
          const isPredictedFastest = fastestLapIndex === idx;
          const isActualFastest = actualFastestLapIndex === idx;
          const hasRaceResults = actualFastestLapIndex !== null && actualFastestLapIndex !== undefined;
          
          const isFailedFastest = hasRaceResults && isPredictedFastest && !isActualFastest;
          const isSuccessFastest = isPredictedFastest || isActualFastest;

          const shouldShowBadge = showPositionChanges && driver !== null;
          const posChange = positionChanges[idx] || 0;
          const cardResult = betResults[idx] || 'neutral';
          
          const circleBase = "relative flex items-center justify-center w-9 h-9 xl:w-11 xl:h-11 rounded-full border-2 transition-all duration-300 shadow-lg shrink-0";
          
          // 1. Badge de Posições Ganhas/Perdidas
          let posBadgeColors = '';
          let posBadgeText = '';
          if (shouldShowBadge) {
            if (posChange > 0) {
              posBadgeColors = 'bg-[#064e3b] text-[#34d399] border-[#10b981]';
              posBadgeText = `+${posChange}`;
            } else if (posChange < 0) {
              posBadgeColors = 'bg-[#7f1d1d] text-[#f87171] border-[#ef4444]';
              posBadgeText = `${posChange}`;
            } else {
              posBadgeColors = 'bg-[#262626] text-[#a3a3a3] border-[#525252]';
              posBadgeText = '0';
            }
          }
          const posBadgeClass = `${circleBase} ${posBadgeColors} font-black italic text-sm xl:text-base`;

          // 2. Badge de Pontos
          const points = earnedPoints[idx];
          const hasPoints = points !== undefined && driver !== null;
          let ptsBadgeColors = '';
          let ptsBadgeText = '';
          
          if (hasPoints) {
            const isSingular = points === 1 || points === -1;
            const word = isSingular ? 'PONTO' : 'PONTOS';
            
            if (points > 0) {
              ptsBadgeColors = 'bg-[#064e3b] text-[#34d399] border-[#10b981]';
              ptsBadgeText = `+${points} ${word}`;
            } else if (points < 0) {
              ptsBadgeColors = 'bg-[#7f1d1d] text-[#f87171] border-[#ef4444]';
              ptsBadgeText = `${points} ${word}`;
            } else {
              ptsBadgeColors = 'bg-[#262626] text-[#a3a3a3] border-[#525252]';
              ptsBadgeText = `0 ${word}`;
            }
          }
          const pointsClass = `flex items-center justify-center px-3 xl:px-4 h-9 xl:h-11 rounded-full border-2 transition-all duration-300 shadow-lg shrink-0 ${ptsBadgeColors} font-black italic text-[10px] xl:text-xs uppercase tracking-wider`;

          // --- COMPONENTES ISOLADOS PARA ORDENAÇÃO SIMÉTRICA ---
          
          const positionText = (
            <span className={`leading-none transition-all duration-500 ease-in-out ${isCompact ? 'text-3xl text-white/30' : 'text-4xl text-white/20'} font-black italic select-none tracking-widest uppercase`}>
              P{position}
            </span>
          );

          const fastestLapBtn = driver && showFastestLapToggle && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (interactive && onToggleFastestLap) onToggleFastestLap(idx);
              }}
              disabled={!interactive}
              className={`${circleBase} outline-none appearance-none touch-manipulation ${interactive ? 'cursor-pointer' : 'cursor-default'}
                ${isFailedFastest 
                  ? 'bg-[#7f1d1d] border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110 text-white opacity-100' 
                  : isSuccessFastest
                    ? 'bg-[#9333ea] border-[#9333ea] shadow-[0_0_15px_rgba(147,51,234,0.8)] scale-110 text-white opacity-100'
                    : 'bg-[#1a1a1a] border-[#ffffff33] text-[#ffffff80] xl:hover:text-white xl:hover:border-[#9333ea] opacity-90'
                }
                ${!interactive && !isSuccessFastest && !isFailedFastest ? 'hidden' : ''} 
              `}
              title={isFailedFastest ? "Volta Mais Rápida (Errou)" : "Volta Mais Rápida"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 xl:w-6 xl:h-6 pointer-events-none">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
              </svg>
            </button>
          );

          const favoriteDriverBtn = driver && showFavoriteDriverToggle && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (interactive && onToggleFavoriteDriver) onToggleFavoriteDriver(idx);
              }}
              disabled={!interactive}
              className={`${circleBase} outline-none appearance-none touch-manipulation ${interactive ? 'cursor-pointer' : 'cursor-default'}
                ${isFavoriteDriver 
                  ? 'bg-[#eab308] border-[#eab308] shadow-[0_0_15px_rgba(234,179,8,0.8)] scale-110 text-white opacity-100' 
                  : 'bg-[#1a1a1a] border-[#ffffff33] text-[#ffffff80] xl:hover:text-white xl:hover:border-[#eab308] opacity-90'
                }
                ${!interactive && !isFavoriteDriver ? 'hidden' : ''} 
              `}
              title="Piloto Favorito (Coringa)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 xl:w-6 xl:h-6 pointer-events-none">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
            </button>
          );

          return (
            <div key={position} className={`flex w-full pointer-events-none ${isSingleCol ? 'justify-center' : (isRight ? 'justify-end' : 'justify-start')}`} style={{ zIndex: 50 - idx }}>
              <div className={`relative shrink-0 pointer-events-auto transition-all duration-500 ease-in-out ${isCompact ? 'w-[220px]' : 'w-[468px]'}`}>
                
                {/* CABEÇALHO (Aproximado do Box: -top-10 e -top-[3.25rem]) */}
                <div className={`absolute z-50 transition-all duration-500 ease-in-out ${isCompact ? '-top-10' : '-top-[3.25rem]'} ${!isRight ? 'left-2' : 'right-2'} flex flex-row items-end gap-2 xl:gap-3`}>
                  
                  {/* COLUNA ESQUERDA: PONTOS MAIS À DIREITA */}
                  {!isRight && (
                    <>
                      {positionText}
                      {shouldShowBadge && <div className={posBadgeClass}>{posBadgeText}</div>}
                      {fastestLapBtn}
                      {favoriteDriverBtn}
                      {hasPoints && <div className={pointsClass}>{ptsBadgeText}</div>}
                    </>
                  )}

                  {/* COLUNA DIREITA: PONTOS MAIS À ESQUERDA */}
                  {isRight && (
                    <>
                      {hasPoints && <div className={pointsClass}>{ptsBadgeText}</div>}
                      {favoriteDriverBtn}
                      {fastestLapBtn}
                      {shouldShowBadge && <div className={posBadgeClass}>{posBadgeText}</div>}
                      {positionText}
                    </>
                  )}

                </div>

                {/* ZONA DO BOX */}
                <div className={`group relative w-full transition-all duration-500 ease-in-out ${isCompact ? 'p-3 min-h-[94px]' : 'p-6 min-h-[180px]'} border-2 border-transparent ${interactive ? 'hover:border-white/10' : ''} rounded-lg bg-transparent`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx)}>
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
                        <DriverCard driver={driver} isMobile={isCompact} result={cardResult} />
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
};