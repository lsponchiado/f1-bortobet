'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, Gauge, Clock, Timer, Circle, OctagonAlert } from 'lucide-react';
import { Grid } from '@/components/Grid';
import { WeatherWidget } from '@/components/WeatherWidget';
import { RaceControlFeed } from '@/components/RaceControlFeed';
import type { GridRowData, GridDriver } from '@/types/grid';
import { useRaceData } from './useRaceData';
import { useLiveConnection } from './useLiveConnection';

type ViewOption = 'delta' | 'velocidade' | 'tempos' | 'setores' | 'stints' | 'pitstops';

interface LiveClientProps {
  wsUrl: string;
  drivers: GridDriver[];
  startingGrid?: Record<number, number>;
}

export function LiveClient({ wsUrl, drivers, startingGrid }: LiveClientProps) {

  const driverMap = useMemo(() => {
    const map = new Map<number, GridDriver>();
    for (const d of drivers) map.set(d.number, d);
    return map;
  }, [drivers]);

  const startPosMap = useMemo(() => {
    if (!startingGrid) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const d of drivers) {
      const sp = startingGrid[d.id];
      if (sp) map.set(d.number, sp);
    }
    return map;
  }, [startingGrid, drivers]);

  const {
    positions, intervals, stintMap, bestLaps, sectorTimes,
    speeds, drsMap, pitStopMap, weather, raceControlMsgs,
    bestSectors, fastestLapDriverNum, handleEvent,
  } = useRaceData();

  const connected = useLiveConnection({ wsUrl, onEvent: handleEvent });

  const [activeView, setActiveView] = useState<ViewOption>('tempos');

  const rows: GridRowData[] = useMemo(() => {
    return [...positions.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([driverNum, pos]) => {
        const driver = driverMap.get(driverNum);
        if (!driver) return null;
        const iv = intervals.get(driverNum);
        const stints = stintMap.get(driverNum);
        const bestLap = bestLaps.get(driverNum);
        const sec = sectorTimes.get(driverNum);
        const spd = speeds.get(driverNum);
        const drs = drsMap.get(driverNum);
        const pits = pitStopMap.get(driverNum);

        return {
          position: pos,
          driver,
          delta: startPosMap.has(driverNum) ? (startPosMap.get(driverNum) ?? pos) - pos : undefined,
          variant: (driverNum === fastestLapDriverNum ? 'purple' : 'default') as GridRowData['variant'],
          timing: {
            gapToLeader: iv?.gapToLeader ?? null,
            interval: iv?.interval ?? null,
            bestLapTime: bestLap ?? null,
          },
          tireStints: stints,
          sectors: sec,
          speed: spd ?? null,
          drsOn: drs ?? false,
          pitStops: pits,
        };
      })
      .filter(Boolean) as GridRowData[];
  }, [positions, intervals, stintMap, bestLaps, sectorTimes, speeds, drsMap, pitStopMap, startPosMap, driverMap, fastestLapDriverNum]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <span className="relative flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-gray-500" />
        </span>
        <p className="text-gray-500 font-black uppercase italic tracking-widest text-sm">Conectando...</p>
      </div>
    );
  }

  if (positions.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <span className="relative flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-[#e10600]" />
        </span>
        <p className="text-gray-500 font-black uppercase italic tracking-widest text-sm">Aguardando dados ao vivo...</p>
      </div>
    );
  }

  const hasDelta = rows.some(r => r.delta !== undefined);
  const hasSpeed = rows.some(r => r.speed != null);
  const hasTiming = rows.some(r => r.timing?.gapToLeader != null || r.timing?.bestLapTime != null);
  const hasSectors = rows.some(r => r.sectors?.s1 != null);
  const hasTires = rows.some(r => r.tireStints && r.tireStints.length > 0);
  const hasPitStops = rows.some(r => r.pitStops && r.pitStops.length > 0);

  const viewOptions: { key: ViewOption; label: string; icon: React.ElementType; available: boolean }[] = [
    { key: 'delta', label: 'Delta', icon: ArrowUpDown, available: hasDelta },
    { key: 'velocidade', label: 'Veloc.', icon: Gauge, available: hasSpeed },
    { key: 'tempos', label: 'Tempos', icon: Clock, available: hasTiming },
    { key: 'setores', label: 'Setores', icon: Timer, available: hasSectors },
    { key: 'stints', label: 'Stints', icon: Circle, available: hasTires },
    { key: 'pitstops', label: 'Pits', icon: OctagonAlert, available: hasPitStops },
  ];
  const availableOptions = viewOptions.filter(o => o.available);

  const half = Math.ceil(rows.length / 2);
  const firstHalf = rows.slice(0, half);
  const secondHalf = rows.slice(half);

  const gridProps = {
    allDrivers: [] as [],
    showDropdown: false,
    showDelta: activeView === 'delta',
    showBadges: false,
    showTiming: activeView === 'tempos',
    showTires: activeView === 'stints',
    showSectors: activeView === 'setores',
    showSpeed: activeView === 'velocidade',
    showPitStops: activeView === 'pitstops',
    bestSectors,
    rowGap: 'gap-2',
    onDriverSelect: () => {},
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#e10600]" />
          </span>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">Ao Vivo</h1>
        </div>
        <WeatherWidget weather={weather} />
      </div>

      {availableOptions.length > 1 && (
        <div className="flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-1 bg-[#1f1f27] border border-white/5 rounded-xl p-1">
            {availableOptions.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase italic tracking-wider transition-all ${
                  activeView === key
                    ? 'bg-[#e10600] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="xl:hidden">
        <Grid rows={rows} {...gridProps} />
      </div>
      <div className="hidden xl:flex gap-8 justify-center">
        <Grid rows={firstHalf} {...gridProps} />
        <Grid rows={secondHalf} {...gridProps} />
      </div>

      <RaceControlFeed messages={raceControlMsgs} />
    </div>
  );
}
