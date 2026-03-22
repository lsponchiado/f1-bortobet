'use client';

import { useState } from 'react';
import { ArrowUpDown, Clock, Circle } from 'lucide-react';
import { Grid } from '@/components/Grid';
import { GpSessionBar } from '@/components/GpSessionBar';
import type { GridRowData, CardVariant } from '@/types/grid';

type ViewOption = 'delta' | 'tempos' | 'stints';

interface SessionEntry {
  startPosition: number;
  finishPosition: number;
  dns: boolean;
  dnf: boolean;
  dsq: boolean;
  fastestLap: boolean;
  bestLapTime: number | null;
  gapToLeader: number | null;
  interval: number | null;
  tireStints: string[];
  driver: {
    id: number;
    lastName: string;
    code: string;
    number: number;
    headshotUrl: string | null;
    team: {
      name: string;
      color: string;
      logoUrl: string | null;
    };
  };
}

interface SessionData {
  id: number;
  type: string;
  date: string;
  cancelled: boolean;
  entries: SessionEntry[];
}

interface GpOption {
  id: number;
  name: string;
  country: string;
}

interface ResultadosClientProps {
  sessions: SessionData[];
  gpName: string;
  currentGpId: number;
  allGps: GpOption[];
}

function entryToRowData(entry: SessionEntry, position: number): GridRowData {
  let variant: CardVariant = 'default';

  if (entry.fastestLap) variant = 'purple';

  const delta: number | string | undefined = entry.dns ? 'DNS' : entry.dsq ? 'DSQ' : entry.dnf ? 'DNF'
    : entry.startPosition - entry.finishPosition;

  return {
    position,
    driver: entry.driver,
    delta,
    variant,
    timing: {
      gapToLeader: entry.gapToLeader,
      interval: entry.interval,
      bestLapTime: entry.bestLapTime,
    },
    tireStints: entry.tireStints,
  };
}

export function ResultadosClient({ sessions, gpName, currentGpId, allGps }: ResultadosClientProps) {
  const sessionsWithEntries = sessions
    .filter(s => !s.cancelled && s.entries.length > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const [activeSessionId, setActiveSessionId] = useState<number | null>(
    () => {
      const race = sessionsWithEntries.find(s => s.type === 'RACE');
      if (race) return race.id;
      const sprint = sessionsWithEntries.find(s => s.type === 'SPRINT');
      if (sprint) return sprint.id;
      return sessionsWithEntries[sessionsWithEntries.length - 1]?.id ?? null;
    }
  );

  const [activeView, setActiveView] = useState<ViewOption>('delta');

  const activeSession = sessionsWithEntries.find(s => s.id === activeSessionId);

  const rows: GridRowData[] = activeSession
    ? activeSession.entries.map((entry, i) => entryToRowData(entry, i + 1))
    : [];

  const isRaceType = activeSession?.type === 'RACE' || activeSession?.type === 'SPRINT';

  if (sessionsWithEntries.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500 font-black uppercase italic tracking-widest">
          Sem resultados disponíveis
        </p>
      </div>
    );
  }

  const half = Math.ceil(rows.length / 2);
  const firstHalf = rows.slice(0, half);
  const secondHalf = rows.slice(half);

  const hasTiming = rows.some(r => r.timing?.gapToLeader != null || r.timing?.bestLapTime != null);
  const hasTires = rows.some(r => r.tireStints && r.tireStints.length > 0);

  const viewOptions: { key: ViewOption; label: string; icon: React.ElementType; available: boolean }[] = [
    { key: 'delta', label: 'Delta', icon: ArrowUpDown, available: isRaceType },
    { key: 'tempos', label: 'Tempos', icon: Clock, available: isRaceType && hasTiming },
    { key: 'stints', label: 'Stints', icon: Circle, available: isRaceType && hasTires },
  ];

  const availableOptions = viewOptions.filter(o => o.available);

  const gridProps = {
    allDrivers: [] as [],
    showDropdown: false,
    showDelta: activeView === 'delta',
    showBadges: false,
    showTiming: activeView === 'tempos',
    showTires: activeView === 'stints',
    rowGap: 'gap-2',
    onDriverSelect: () => {},
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col gap-3">
        <GpSessionBar
          gpName={gpName}
          currentGpId={currentGpId}
          allGps={allGps}
          basePath="/resultados"
          sessions={sessionsWithEntries}
          activeSessionId={activeSessionId}
          onSessionChange={setActiveSessionId}
        />

        {isRaceType && availableOptions.length > 1 && (
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
      </div>

      {/* Mobile: grid único */}
      <div className="xl:hidden">
        <Grid key={activeSessionId} rows={rows} {...gridProps} />
      </div>

      {/* Desktop: dois grids lado a lado */}
      <div className="hidden xl:flex gap-8 justify-center">
        <Grid key={`${activeSessionId}-a`} rows={firstHalf} {...gridProps} />
        <Grid key={`${activeSessionId}-b`} rows={secondHalf} {...gridProps} />
      </div>
    </div>
  );
}
