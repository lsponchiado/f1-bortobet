'use client';

import { useState } from 'react';
import GridRow from '@/components/GridRow';
import { GpSessionBar } from '@/components/GpSessionBar';
import type { GridRowData, CardVariant } from '@/types/grid';

interface SessionEntry {
  startPosition: number;
  finishPosition: number;
  dns: boolean;
  dnf: boolean;
  dsq: boolean;
  fastestLap: boolean;
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

  if (entry.dnf || entry.dns || entry.dsq) variant = 'red';
  else if (entry.fastestLap) variant = 'purple';

  const isClassified = !entry.dnf && !entry.dns && !entry.dsq;
  const delta = isClassified ? entry.startPosition - entry.finishPosition : undefined;

  return {
    position,
    driver: entry.driver,
    delta,
    variant,
  };
}

export default function ResultadosClient({ sessions, gpName, currentGpId, allGps }: ResultadosClientProps) {
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

  const gridRow = (row: GridRowData) => (
    <GridRow
      key={row.position}
      data={row}
      showDropdown={false}
      showDelta={isRaceType}
      showBadges={false}
      availableDrivers={[]}
      onDriverSelect={() => {}}
    />
  );

  return (
    <div>
      <GpSessionBar
        gpName={gpName}
        currentGpId={currentGpId}
        allGps={allGps}
        basePath="/resultados"
        sessions={sessionsWithEntries}
        activeSessionId={activeSessionId}
        onSessionChange={setActiveSessionId}
      />

      {/* Grid: coluna única em tela estreita, duas colunas em xl+ */}
      <div className="pt-2 xl:pt-6">
        <div className="flex flex-col gap-2 xl:hidden">
          {rows.map(gridRow)}
        </div>
        <div className="hidden xl:flex gap-20 justify-center">
          <div className="flex flex-col gap-2">
            {rows.slice(0, Math.ceil(rows.length / 2)).map(gridRow)}
          </div>
          <div className="flex flex-col gap-2">
            {rows.slice(Math.ceil(rows.length / 2)).map(gridRow)}
          </div>
        </div>
      </div>
    </div>
  );
}
