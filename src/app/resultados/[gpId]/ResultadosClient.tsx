'use client';

import { useState } from 'react';
import { ArrowUpDown, Clock, Circle, Users } from 'lucide-react';
import { Grid } from '@/components/Grid';
import { GpSessionBar } from '@/components/GpSessionBar';
import { TeamDuel } from '@/components/TeamDuel';
import type { GridRowData, CardVariant } from '@/types/grid';

type ViewOption = 'delta' | 'tempos' | 'stints' | 'equipe';

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
  scCount: number;
  vscCount: number;
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
    : (entry.startPosition >= 90 ? undefined : entry.startPosition - entry.finishPosition);

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
    () => sessionsWithEntries[sessionsWithEntries.length - 1]?.id ?? null
  );

  const [activeView, setActiveView] = useState<ViewOption>('delta');

  const activeSession = sessionsWithEntries.find(s => s.id === activeSessionId);

  const rows: GridRowData[] = activeSession
    ? activeSession.entries.map((entry, i) => entryToRowData(entry, i + 1))
    : [];

  const isRaceType = activeSession?.type === 'RACE' || activeSession?.type === 'SPRINT';

  if (sessionsWithEntries.length === 0) {
    return (
      <div className="flex flex-col gap-8 pb-20">
        <GpSessionBar
          gpName={gpName}
          currentGpId={currentGpId}
          allGps={allGps}
          basePath="/resultados"
          sessions={[]}
          activeSessionId={null}
          onSessionChange={() => {}}
        />
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500 font-black uppercase italic tracking-widest">
            Sem resultados disponíveis
          </p>
        </div>
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
    { key: 'tempos', label: 'Tempos', icon: Clock, available: true },
    { key: 'stints', label: 'Stints', icon: Circle, available: true },
    { key: 'equipe', label: 'Equipe', icon: Users, available: true },
  ];

  const availableOptions = viewOptions.filter(o => o.available);

  // Se a view ativa não está disponível nesta sessão, cai pra tempos
  const effectiveView = availableOptions.some(o => o.key === activeView) ? activeView : 'tempos';

  // Melhor tempo de volta (P1) para calcular gaps em practice/qualifying
  const leaderLapTime = rows[0]?.timing?.bestLapTime ?? undefined;

  const gridProps = {
    allDrivers: [] as [],
    showDropdown: false,
    showDelta: effectiveView === 'delta',
    showBadges: false,
    showTiming: effectiveView === 'tempos',
    showTires: effectiveView === 'stints',
    leaderLapTime,
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

        {availableOptions.length > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex gap-1 bg-[#1f1f27] border border-white/5 rounded-xl p-1">
              {availableOptions.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveView(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase italic tracking-wider transition-all ${
                    effectiveView === key
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

      {effectiveView === 'equipe' && activeSession ? (
        <TeamDuel entries={activeSession.entries} />
      ) : (
        <>
          {/* Mobile: grid único */}
          <div className="xl:hidden">
            <Grid key={activeSessionId} rows={rows} {...gridProps} />
          </div>

          {/* Desktop: dois grids lado a lado */}
          <div className="hidden xl:flex gap-8 justify-center">
            <Grid key={`${activeSessionId}-a`} rows={firstHalf} {...gridProps} />
            <Grid key={`${activeSessionId}-b`} rows={secondHalf} {...gridProps} />
          </div>
        </>
      )}

      {/* Session summary table */}
      {isRaceType && activeSession && (() => {
        const dnfCount = activeSession.entries.filter(e => e.dnf).length;
        const dnsCount = activeSession.entries.filter(e => e.dns).length;
        const dsqCount = activeSession.entries.filter(e => e.dsq).length;
        const sc = activeSession.scCount;
        const vsc = activeSession.vscCount;

        const stats = [
          { label: 'Safety Car', value: sc },
          { label: 'Virtual SC', value: vsc },
          { label: 'Abandonos', value: dnfCount },
          { label: 'Não Largaram', value: dnsCount },
          { label: 'Desclassificados', value: dsqCount },
        ].filter(s => s.value > 0);

        if (stats.length === 0) return null;

        return (
          <div className="max-w-md mx-auto w-full">
            <div className="bg-[#1f1f27] rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Resumo da Sessão</p>
              </div>
              <div className="divide-y divide-white/5">
                {stats.map(s => (
                  <div key={s.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-bold text-gray-400">{s.label}</span>
                    <span className="text-sm font-black tabular-nums text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
