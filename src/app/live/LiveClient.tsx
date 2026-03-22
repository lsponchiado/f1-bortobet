'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, Circle } from 'lucide-react';
import { Grid } from '@/components/Grid';
import type { GridRowData, GridDriver } from '@/types/grid';

type ViewOption = 'tempos' | 'stints';

interface LiveClientProps {
  wsUrl: string;
  drivers: GridDriver[];
}

export function LiveClient({ wsUrl, drivers }: LiveClientProps) {
  const driverMap = useMemo(() => {
    const map = new Map<number, GridDriver>();
    for (const d of drivers) {
      map.set(d.number, d);
    }
    return map;
  }, [drivers]);

  const [connected, setConnected] = useState(false);
  const [positions, setPositions] = useState<Map<number, number>>(new Map());
  const [intervals, setIntervals] = useState<Map<number, { gapToLeader: number | null; interval: number | null }>>(new Map());
  const [stintMap, setStintMap] = useState<Map<number, string[]>>(new Map());
  const [bestLaps, setBestLaps] = useState<Map<number, number>>(new Map());
  const [activeView, setActiveView] = useState<ViewOption>('tempos');

  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let disposed = false;

    function connect() {
      if (disposed) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        if (!disposed) retryTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleEvent(msg.event, msg.data);
        } catch { /* ignore non-JSON */ }
      };
    }

    function handleEvent(event: string, data: unknown) {
      const items = Array.isArray(data) ? data : [data];

      switch (event) {
        case 'position':
          setPositions(prev => {
            const next = new Map(prev);
            for (const d of items) next.set(d.driver_number, d.position);
            return next;
          });
          break;

        case 'intervals':
          setIntervals(prev => {
            const next = new Map(prev);
            for (const d of items) {
              next.set(d.driver_number, {
                gapToLeader: d.gap_to_leader ?? null,
                interval: d.interval ?? null,
              });
            }
            return next;
          });
          break;

        case 'stints':
          setStintMap(prev => {
            const next = new Map(prev);
            for (const d of items) {
              if (!d.driver_number || !d.compound) continue;
              const compound = (d.compound as string).toUpperCase();
              const lapStart = d.lap_start ?? 0;
              const lapEnd = d.lap_end ?? lapStart;
              const laps = lapEnd - lapStart + 1;
              const existing = next.get(d.driver_number) || [];
              const stintIdx = (d.stint_number || 1) - 1;
              const updated = [...existing];
              updated[stintIdx] = `${compound}:${laps}`;
              next.set(d.driver_number, updated);
            }
            return next;
          });
          break;

        case 'laps':
          setBestLaps(prev => {
            const next = new Map(prev);
            for (const d of items) {
              if (d.lap_duration && d.lap_duration > 0) {
                const current = next.get(d.driver_number);
                if (!current || d.lap_duration < current) {
                  next.set(d.driver_number, d.lap_duration);
                }
              }
            }
            return next;
          });
          break;
      }
    }

    connect();

    return () => {
      disposed = true;
      ws?.close();
      clearTimeout(retryTimeout);
    };
  }, [wsUrl]);

  const rows: GridRowData[] = useMemo(() => {
    return [...positions.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([driverNum, pos]) => {
        const driver = driverMap.get(driverNum);
        if (!driver) return null;
        const iv = intervals.get(driverNum);
        const stints = stintMap.get(driverNum);
        const bestLap = bestLaps.get(driverNum);

        return {
          position: pos,
          driver,
          variant: 'default' as const,
          timing: {
            gapToLeader: iv?.gapToLeader ?? null,
            interval: iv?.interval ?? null,
            bestLapTime: bestLap ?? null,
          },
          tireStints: stints,
        };
      })
      .filter(Boolean) as GridRowData[];
  }, [positions, intervals, stintMap, bestLaps, driverMap]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <span className="relative flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-gray-500" />
        </span>
        <p className="text-gray-500 font-black uppercase italic tracking-widest text-sm">
          Conectando...
        </p>
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
        <p className="text-gray-500 font-black uppercase italic tracking-widest text-sm">
          Aguardando dados ao vivo...
        </p>
      </div>
    );
  }

  const hasTiming = rows.some(r => r.timing?.gapToLeader != null || r.timing?.bestLapTime != null);
  const hasTires = rows.some(r => r.tireStints && r.tireStints.length > 0);

  const viewOptions: { key: ViewOption; label: string; icon: React.ElementType; available: boolean }[] = [
    { key: 'tempos', label: 'Tempos', icon: Clock, available: hasTiming },
    { key: 'stints', label: 'Stints', icon: Circle, available: hasTires },
  ];
  const availableOptions = viewOptions.filter(o => o.available);

  const half = Math.ceil(rows.length / 2);
  const firstHalf = rows.slice(0, half);
  const secondHalf = rows.slice(half);

  const gridProps = {
    allDrivers: [] as [],
    showDropdown: false,
    showDelta: false,
    showBadges: false,
    showTiming: activeView === 'tempos',
    showTires: activeView === 'stints',
    rowGap: 'gap-2',
    onDriverSelect: () => {},
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex items-center justify-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#e10600]" />
        </span>
        <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">
          Ao Vivo
        </h1>
      </div>

      {availableOptions.length > 1 && (
        <div className="flex justify-center">
          <div className="inline-flex gap-1 bg-[#1f1f27] border border-white/5 rounded-xl p-1">
            {availableOptions.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase italic tracking-wider transition-all ${
                  activeView === key
                    ? 'bg-[#e10600] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: grid unico */}
      <div className="xl:hidden">
        <Grid rows={rows} {...gridProps} />
      </div>

      {/* Desktop: dois grids lado a lado */}
      <div className="hidden xl:flex gap-8 justify-center">
        <Grid rows={firstHalf} {...gridProps} />
        <Grid rows={secondHalf} {...gridProps} />
      </div>
    </div>
  );
}
