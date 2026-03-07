'use client'; 

import React, { useRef, useState, useEffect } from 'react';

interface DriverCardProps {
  driver: {
    name: string;
    number: number;
    headshotUrl: string | null;
    country: string;
    team: { name: string; logoUrl: string | null; color: string; };
  };
  isMobile?: boolean; 
  result?: 'neutral' | 'green' | 'red'; // <-- NOVA PROP DE RESULTADO
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, isMobile, result = 'neutral' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSquished, setIsSquished] = useState(false);

  const nameParts = driver.name.split(' ');
  const lastName = nameParts[nameParts.length - 1];
  const driverCode = lastName.slice(0, 3).toUpperCase();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setIsSquished(entry.contentRect.width < 380);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const showCompact = isMobile || isSquished;

  // Lógica de Cores do Resultado (Hexadecimal para garantir compatibilidade)
  let bgClass = 'bg-[#1a1a1a]';
  let borderClass = 'border-white/5';

  if (result === 'green') {
    bgClass = 'bg-[#064e3b]/40'; // Fundo verde escuro desbotado
    borderClass = 'border-[#10b981]/50'; // Borda verde sutil
  } else if (result === 'red') {
    bgClass = 'bg-[#7f1d1d]/40'; // Fundo vermelho escuro desbotado
    borderClass = 'border-[#ef4444]/50'; // Borda vermelha sutil
  }

  return (
    <div ref={containerRef} className="w-full">
      
      {showCompact ? (
        // --- VERSÃO COMPACTA ---
        <div className="relative group w-full h-16 overflow-visible transition-all active:scale-95">
          {/* Glow Neon */}
          <div 
            className="absolute -inset-[1px] rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-0"
            style={{ boxShadow: `0 0 15px 1px ${driver.team.color}`, border: `1px solid ${driver.team.color}` }}
          />

          {/* O Background e a Borda agora usam as variáveis de resultado */}
          <div className={`relative w-full h-full ${bgClass} rounded-xl overflow-hidden flex items-center border ${borderClass} px-6 z-10 transition-colors duration-300`}>
            <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: driver.team.color }} />
            
            <div className="relative w-full flex items-center justify-between gap-4">
              <div className="flex-shrink-0">
                {driver.team.logoUrl && (
                  <img src={driver.team.logoUrl} className="h-7 w-auto object-contain brightness-0 invert opacity-70" alt="Logo" />
                )}
              </div>
              <span className="text-2xl font-black italic uppercase tracking-tighter text-white">
                {driverCode}
              </span>
              <span className="text-2xl font-black italic flex-shrink-0" style={{ color: driver.team.color }}>
                {driver.number}
              </span>
            </div>
          </div>
        </div>

      ) : (

        // --- VERSÃO FULL ---
        <div className="relative group w-full shrink-0 transition-all duration-300 hover:-translate-y-1 overflow-visible">
          {/* Glows */}
          <div 
            className="absolute -inset-2 rounded-[1.2rem] opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-25 group-hover:blur-3xl" 
            style={{ backgroundColor: driver.team.color }}
          />
          <div 
            className="absolute -inset-[1.5px] rounded-[1.2rem] opacity-0 transition-all duration-300 group-hover:opacity-100 z-10" 
            style={{ boxShadow: `0 0 15px 2px ${driver.team.color}`, border: `1.2px solid ${driver.team.color}` }} 
          />

          {/* O Background e a Borda agora usam as variáveis de resultado */}
          <div className={`relative flex overflow-hidden rounded-[1.2rem] ${bgClass} border ${borderClass} shadow-2xl h-32 z-20 w-full transition-colors duration-300`}>
            <div className="w-3 self-stretch flex-shrink-0" style={{ backgroundColor: driver.team.color }} />
            
            <div className="flex-1 flex p-4 gap-4">
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center gap-3">
                  {driver.team.logoUrl && (
                    <img src={driver.team.logoUrl} className="h-7 w-auto object-contain" alt="Team" />
                  )}
                  <span className="text-[11px] font-black italic uppercase tracking-widest text-white/90 truncate">
                    {driver.team.name}
                  </span>
                </div>

                <div className="flex items-end gap-5 leading-[0.7]">
                  <span className="text-6xl font-black italic uppercase tracking-tighter" style={{ color: driver.team.color }}>
                    {driver.number.toString().padStart(2, '0')}
                  </span>
                  <div className="flex flex-col justify-end truncate">
                    <p className="text-[11px] font-black italic uppercase text-gray-400 leading-none mb-1 truncate">
                      {nameParts[0]}
                    </p>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white truncate">
                      {lastName}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="relative h-full aspect-square flex-shrink-0">
                <div className="absolute top-1 right-1 translate-x-1/2 -translate-y-1/2 z-30 w-5 h-5 rounded-full border-2 border-white overflow-hidden shadow-xl bg-black">
                  <img src={`https://flagcdn.com/w640/${driver.country.toLowerCase()}.png`} className="w-full h-full object-cover" alt="Flag" />
                </div>
                <div className="relative z-10 h-full w-full overflow-hidden rounded-xl border border-white/10 bg-black/10">
                  {driver.headshotUrl && (
                    <img 
                      src={driver.headshotUrl} 
                      className="w-full h-full object-cover object-top scale-[1.5] translate-y-7 transition-transform duration-500 group-hover:scale-[1.6]" 
                      alt={driver.name} 
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};