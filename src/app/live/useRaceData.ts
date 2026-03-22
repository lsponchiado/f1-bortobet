import { useState, useCallback, useMemo } from 'react';
import type { PitStop, RaceControlMessage, WeatherData } from '@/types/grid';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventData = any;

interface RaceDataState {
  positions: Map<number, number>;
  intervals: Map<number, { gapToLeader: number | null; interval: number | null }>;
  stintMap: Map<number, string[]>;
  bestLaps: Map<number, number>;
  sectorTimes: Map<number, { s1: number | null; s2: number | null; s3: number | null }>;
  speeds: Map<number, number>;
  drsMap: Map<number, boolean>;
  pitStopMap: Map<number, PitStop[]>;
  weather: WeatherData | null;
  raceControlMsgs: RaceControlMessage[];
}

interface BestSectors {
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

export function useRaceData() {
  const [positions, setPositions] = useState<RaceDataState['positions']>(new Map());
  const [intervals, setIntervals] = useState<RaceDataState['intervals']>(new Map());
  const [stintMap, setStintMap] = useState<RaceDataState['stintMap']>(new Map());
  const [bestLaps, setBestLaps] = useState<RaceDataState['bestLaps']>(new Map());
  const [sectorTimes, setSectorTimes] = useState<RaceDataState['sectorTimes']>(new Map());
  const [speeds, setSpeeds] = useState<RaceDataState['speeds']>(new Map());
  const [drsMap, setDrsMap] = useState<RaceDataState['drsMap']>(new Map());
  const [pitStopMap, setPitStopMap] = useState<RaceDataState['pitStopMap']>(new Map());
  const [weather, setWeather] = useState<RaceDataState['weather']>(null);
  const [raceControlMsgs, setRaceControlMsgs] = useState<RaceDataState['raceControlMsgs']>([]);

  const handleEvent = useCallback((event: string, data: unknown) => {
    const items = Array.isArray(data) ? (data as EventData[]) : [data as EventData];

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
        setSectorTimes(prev => {
          const next = new Map(prev);
          for (const d of items) {
            if (!d.driver_number) continue;
            next.set(d.driver_number, {
              s1: d.duration_sector_1 ?? null,
              s2: d.duration_sector_2 ?? null,
              s3: d.duration_sector_3 ?? null,
            });
          }
          return next;
        });
        break;

      case 'car_data':
        setSpeeds(prev => {
          const next = new Map(prev);
          for (const d of items) {
            if (d.driver_number && d.speed != null) {
              next.set(d.driver_number, d.speed);
            }
          }
          return next;
        });
        setDrsMap(prev => {
          const next = new Map(prev);
          for (const d of items) {
            if (d.driver_number && d.drs != null) {
              next.set(d.driver_number, d.drs >= 10);
            }
          }
          return next;
        });
        break;

      case 'pit':
        setPitStopMap(prev => {
          const next = new Map(prev);
          for (const d of items) {
            if (!d.driver_number) continue;
            const existing = next.get(d.driver_number) || [];
            const stop: PitStop = { lap: d.lap_number ?? 0, duration: d.pit_duration ?? null };
            if (!existing.some(s => s.lap === stop.lap)) {
              next.set(d.driver_number, [...existing, stop]);
            }
          }
          return next;
        });
        break;

      case 'weather': {
        const w = Array.isArray(data) ? data[0] : data;
        if (w) {
          setWeather({
            airTemperature: (w as EventData).air_temperature ?? null,
            trackTemperature: (w as EventData).track_temperature ?? null,
            humidity: (w as EventData).humidity ?? null,
            rainfall: (w as EventData).rainfall ?? false,
            windSpeed: (w as EventData).wind_speed ?? null,
          });
        }
        break;
      }

      case 'race_control':
        for (const d of items) {
          setRaceControlMsgs(prev => [{
            date: d.date || new Date().toISOString(),
            category: d.category || '',
            flag: d.flag,
            message: d.message || '',
            driverNumber: d.driver_number,
          }, ...prev].slice(0, 50));
        }
        break;
    }
  }, []);

  const bestSectors: BestSectors = useMemo(() => {
    let s1: number | null = null;
    let s2: number | null = null;
    let s3: number | null = null;
    for (const sec of sectorTimes.values()) {
      if (sec.s1 != null && (s1 == null || sec.s1 < s1)) s1 = sec.s1;
      if (sec.s2 != null && (s2 == null || sec.s2 < s2)) s2 = sec.s2;
      if (sec.s3 != null && (s3 == null || sec.s3 < s3)) s3 = sec.s3;
    }
    return { s1, s2, s3 };
  }, [sectorTimes]);

  const fastestLapDriverNum = useMemo(() => {
    let best: number | null = null;
    let bestNum: number | null = null;
    for (const [num, lap] of bestLaps.entries()) {
      if (best == null || lap < best) { best = lap; bestNum = num; }
    }
    return bestNum;
  }, [bestLaps]);

  return {
    positions, intervals, stintMap, bestLaps, sectorTimes,
    speeds, drsMap, pitStopMap, weather, raceControlMsgs,
    bestSectors, fastestLapDriverNum,
    handleEvent,
  };
}
