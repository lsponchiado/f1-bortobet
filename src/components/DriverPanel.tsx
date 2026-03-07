'use client';

import React from 'react';
import { DriverCard } from './DriverCard';

interface DriverPanelProps {
  drivers: any[];
  onReturnToPaddock?: (gridIndex: number) => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({ drivers, onReturnToPaddock }) => {
  const handleDragStart = (e: React.DragEvent, driver: any) => {
    e.dataTransfer.setData('newDriverId', driver.id.toString());
    e.dataTransfer.effectAllowed = 'move';
    
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndexRaw = e.dataTransfer.getData('text/plain');
    if (sourceIndexRaw && onReturnToPaddock) {
      onReturnToPaddock(parseInt(sourceIndexRaw, 10));
    }
  };

  return (
    <div 
      className="w-full xl:h-full xl:min-h-[400px] bg-[#0a0a0a] xl:rounded-2xl xl:border border-white/5 p-2 xl:p-6"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4 xl:mb-6 border-l-2 border-red-600 pl-3">
        <h2 className="text-xs xl:text-sm font-black italic uppercase text-white/90 tracking-widest">Paddock</h2>
        <span className="text-[9px] xl:text-[10px] text-gray-500 uppercase tracking-widest">
          Arraste de volta para remover
        </span>
      </div>

      {/* MOBILE: 2 Linhas, Colunas infinitas (grid-flow-col), com scroll horizontal.
        DESKTOP (xl): 2 Colunas, Linhas infinitas (grid-cols-2), sem scroll interno.
        [scrollbar-width:none] e [&::-webkit-scrollbar]:hidden escondem a barra feia visualmente, mas mantém o scroll via touch.
      */}
      <div className="grid grid-rows-2 grid-flow-col xl:grid-rows-none xl:grid-cols-2 xl:grid-flow-row gap-3 xl:gap-6 overflow-x-auto xl:overflow-visible pb-2 xl:pb-0 justify-items-start xl:justify-items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {drivers.map((driver) => (
          <div
            key={driver.id}
            draggable
            onDragStart={(e) => handleDragStart(e, driver)}
            onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
            className="w-[220px] shrink-0 cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-transform"
          >
            <DriverCard driver={driver} isMobile={true} />
          </div>
        ))}
      </div>

      {drivers.length === 0 && (
        <div className="w-full py-8 flex items-center justify-center opacity-30 xl:mt-10">
          <p className="text-xs uppercase italic font-black">Todos no Grid</p>
        </div>
      )}
    </div>
  );
};