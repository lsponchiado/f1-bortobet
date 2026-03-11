'use client';

import { useRef, useState, useEffect } from 'react';

interface Driver {
  name: string;
  number: number;
  headshotUrl: string | null;
  country: string;
  team: {
    name: string;
    logoUrl: string | null;
    color: string;
  };
}

export type ResultVariant = 'neutral' | 'green' | 'red' | 'purple';

type DriverCardVariant = 'auto' | 'compact' | 'full';

interface DriverCardProps {
  driver: Driver;
  variant?: DriverCardVariant;
  result?: ResultVariant;
  hideTeamLogo?: boolean;
}

const RESULT_STYLES: Record<ResultVariant, { bg: string; border: string }> = {
  neutral: { bg: 'bg-[#1a1a1a]',    border: 'border-white/5' },
  green:   { bg: 'bg-[#064e3b]/40', border: 'border-[#10b981]/50' },
  red:     { bg: 'bg-[#7f1d1d]/40', border: 'border-[#ef4444]/50' },
  purple:  { bg: 'bg-[#6b21a8]/30', border: 'border-[#c084fc]/60' },
};

function getNameParts(name: string) {
  const parts = name.split(' ');
  const lastName = parts[parts.length - 1];
  return { firstName: parts[0], lastName, code: lastName.slice(0, 3).toUpperCase() };
}

interface CardVariantProps {
  driver: Driver;
  resultStyles: { bg: string; border: string };
  hideTeamLogo?: boolean;
}

function DriverCardCompact({ driver, resultStyles, hideTeamLogo }: CardVariantProps) {
  const { code } = getNameParts(driver.name);

  return (
    <div className="relative group w-full h-16 overflow-visible transition-all active:scale-95">
      <div
        className="absolute -inset-[1px] rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-0"
        style={{ boxShadow: `0 0 15px 1px ${driver.team.color}`, border: `1px solid ${driver.team.color}` }}
      />
      <div className={`relative w-full h-full ${resultStyles.bg} rounded-xl overflow-hidden flex items-center border ${resultStyles.border} px-6 z-10 transition-colors duration-300`}>
        <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: driver.team.color }} />
        <div className="relative w-full flex items-center justify-between gap-4">
          {!hideTeamLogo && (
            <div className="flex-shrink-0">
              {driver.team.logoUrl && (
                <img src={driver.team.logoUrl} className="h-7 w-auto max-w-[52px] object-contain brightness-0 invert opacity-70" alt={driver.team.name} />
              )}
            </div>
          )}
          <span className="text-2xl font-black italic uppercase tracking-tighter text-white">
            {code}
          </span>
          <span className="text-2xl font-black italic flex-shrink-0" style={{ color: driver.team.color }}>
            {driver.number}
          </span>
        </div>
      </div>
    </div>
  );
}

function DriverCardFull({ driver, resultStyles }: CardVariantProps) {
  const { firstName, lastName } = getNameParts(driver.name);

  return (
    <div className="relative group w-full shrink-0 transition-all duration-300 hover:-translate-y-1 overflow-visible">
      <div
        className="absolute -inset-2 rounded-[1.2rem] opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-25 group-hover:blur-3xl"
        style={{ backgroundColor: driver.team.color }}
      />
      <div
        className="absolute -inset-[1.5px] rounded-[1.2rem] opacity-0 transition-all duration-300 group-hover:opacity-100 z-10"
        style={{ boxShadow: `0 0 15px 2px ${driver.team.color}`, border: `1.2px solid ${driver.team.color}` }}
      />
      <div className={`relative flex overflow-hidden rounded-[1.2rem] ${resultStyles.bg} border ${resultStyles.border} shadow-2xl h-32 z-20 w-full transition-colors duration-300`}>
        <div className="w-3 self-stretch flex-shrink-0" style={{ backgroundColor: driver.team.color }} />
        <div className="flex-1 flex p-4 gap-4">
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center gap-3">
              {driver.team.logoUrl && (
                <img src={driver.team.logoUrl} className="h-7 w-auto object-contain" alt={driver.team.name} />
              )}
              <span className="text-[11px] font-black italic uppercase tracking-widest text-white/90 truncate">
                {driver.team.name}
              </span>
            </div>
            <div className="flex items-end gap-5 leading-[0.7]">
              <span className="text-6xl font-black italic uppercase tracking-tighter" style={{ color: driver.team.color }}>
                {driver.number.toString().padStart(2, '0')}
              </span>
              <div className="flex flex-col justify-end truncate pr-2">
                <p className="text-[11px] font-black italic uppercase text-gray-400 leading-none mb-1 truncate">
                  {firstName}
                </p>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white truncate">
                  {lastName}
                </h3>
              </div>
            </div>
          </div>
          <div className="relative h-full aspect-square flex-shrink-0">
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
  );
}

export function DriverCard({ driver, variant = 'auto', result = 'neutral', hideTeamLogo = false }: DriverCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSquished, setIsSquished] = useState(false);

  useEffect(() => {
    if (variant !== 'auto') return;

    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      setIsSquished(last.contentRect.width < 380);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [variant]);

  const showCompact = variant === 'compact' || (variant === 'auto' && isSquished);
  const resultStyles = RESULT_STYLES[result];

  return (
    <div ref={containerRef} className="w-full">
      {showCompact
        ? <DriverCardCompact driver={driver} resultStyles={resultStyles} hideTeamLogo={hideTeamLogo} />
        : <DriverCardFull driver={driver} resultStyles={resultStyles} />
      }
    </div>
  );
}
