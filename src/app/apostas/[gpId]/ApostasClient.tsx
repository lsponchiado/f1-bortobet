'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Grid } from '@/components/Grid';
import { GpSessionBar } from '@/components/GpSessionBar';
import { BetExtrasPanel } from '@/components/BetExtrasPanel';
import { BetResultsTable } from '@/components/BetResultsTable';
import type { GridRowData, GridDriver, CardVariant, BadgeType } from '@/types/grid';
import { placeholderDriver } from '@/lib/grid';
import { saveRaceBet, saveSprintBet, deleteRaceBet, deleteSprintBet } from '@/lib/actions';
import { GRID_SIZE, type BetGridItem, type RaceResultData, type SprintResultData } from '@/lib/constants';

interface SessionEntry {
  driverId: number;
  startPosition: number;
  finishPosition: number;
  fastestLap: boolean;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}

interface RaceConfig {
  allowHailMary: boolean;
  allowUnderdog: boolean;
  allowFreefall: boolean;
  allowSafetyCar: boolean;
  allowDNF: boolean;
  allowFastestLap: boolean;
  allowDoublePoints: boolean;
}

interface SessionInfo {
  id: number;
  type: string;
  date: string;
  cancelled: boolean;
  hasEntries: boolean;
  scCount: number;
  vscCount: number;
  raceConfig: RaceConfig | null;
  entries: SessionEntry[];
}

interface ExistingBets {
  race: {
    grid: BetGridItem[];
    predictedSC: number;
    predictedDNF: number;
    doublePoints: boolean;
  } | null;
  sprint: { grid: BetGridItem[] } | null;
}

interface BetResults {
  race: RaceResultData | null;
  sprint: SprintResultData | null;
}

interface GpOption {
  id: number;
  name: string;
  country: string;
}

interface ApostasClientProps {
  sessions: SessionInfo[];
  gpName: string;
  currentGpId: number;
  allGps: GpOption[];
  allDrivers: GridDriver[];
  existingBets: ExistingBets;
  betResults: BetResults;
  qualifyingResults: { RACE: Record<number, number>; SPRINT: Record<number, number> };
  isAdmin: boolean;
  currentUserId: number;
  doublePointsRemaining: number;
}

export function ApostasClient(props: ApostasClientProps) {
  const { sessions, gpName, currentGpId, allGps, allDrivers, existingBets, betResults, qualifyingResults, currentUserId, isAdmin, doublePointsRemaining } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // User bypass: redirect to ?asUser=X if needed
  useEffect(() => {
    if (!isAdmin) return;
    const bypassActive = sessionStorage.getItem('betUserBypass') === 'true';
    const bypassUserId = sessionStorage.getItem('betUserBypassId');
    const url = new URL(window.location.href);
    const currentAsUser = url.searchParams.get('asUser');

    if (bypassActive && bypassUserId && currentAsUser !== bypassUserId) {
      url.searchParams.set('asUser', bypassUserId);
      router.replace(url.pathname + url.search);
    } else if ((!bypassActive || !bypassUserId) && currentAsUser) {
      url.searchParams.delete('asUser');
      router.replace(url.pathname + url.search);
    }
  }, [isAdmin, router]);

  const allBettableSessions = sessions
    .filter(s => !s.cancelled && (s.type === 'RACE' || s.type === 'SPRINT'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const [activeSessionId, setActiveSessionId] = useState<number | null>(() => {
    const upcoming = allBettableSessions.find(s => new Date(s.date) > new Date());
    return upcoming?.id ?? allBettableSessions[allBettableSessions.length - 1]?.id ?? null;
  });

  const activeSession = allBettableSessions.find(s => s.id === activeSessionId);
  const isRace = activeSession?.type === 'RACE';
  
  const isBeforeSession = activeSession ? new Date(activeSession.date) > new Date() : false;
  const [lockBypass, setLockBypass] = useState(false);
  useEffect(() => {
    if (isAdmin) setLockBypass(sessionStorage.getItem('betLockBypass') === 'true');
  }, [isAdmin]);
  const isEditable = isBeforeSession || (isAdmin && lockBypass);
  const hasBet = isRace ? existingBets.race !== null : existingBets.sprint !== null;

  const existingRaceBet = existingBets.race;
  const [predictedSC, setPredictedSC] = useState<number>(existingRaceBet?.predictedSC ?? 0);
  const [predictedDNF, setPredictedDNF] = useState<number>(existingRaceBet?.predictedDNF ?? 0);
  const [fastestLapId, setFastestLapId] = useState<number | null>(
    existingRaceBet?.grid.find(g => g.fastestLap)?.driverId ?? null
  );
  const [doublePoints, setDoublePoints] = useState<boolean>(existingRaceBet?.doublePoints ?? false);

  const activeResult = isRace ? betResults.race : betResults.sprint;

  const gridInitialData = useMemo(() => {
    const betKey = isRace ? 'race' : 'sprint';
    const existingGrid = existingBets[betKey]?.grid;
    const gridSize = isRace ? GRID_SIZE.RACE : GRID_SIZE.SPRINT;
    const qualiMap = qualifyingResults[activeSession?.type as keyof typeof qualifyingResults] || {};
    const resultMap = new Map(activeSession?.entries.map(e => [e.driverId, e]) || []);

    return Array.from({ length: gridSize }, (_, i) => {
      const pos = i + 1;
      const bet = existingGrid?.find(g => g.position === pos);

      const driver: GridDriver = bet ? {
        id: bet.driverId,
        lastName: bet.lastName,
        code: bet.code,
        number: bet.number,
        headshotUrl: bet.headshotUrl,
        team: bet.team
      } : placeholderDriver(pos);

      let variant: CardVariant = 'default';
      let badges: BadgeType[] = [];
      let delta: number | string | undefined = undefined;

      if (!isEditable && activeSession?.hasEntries && activeResult) {
        // Use view data for variant and badges
        variant = activeResult.somaPos[i] > 0 ? 'green' : 'red';
        if (isRace && 'hailMary' in activeResult) {
          const rr = activeResult as RaceResultData;
          if (rr.hailMary[i] > 0) badges.push('HM');
          if (rr.underdog[i] > 0) badges.push('UD');
          if (rr.freefall[i] > 0) badges.push('FF');
        }
        // Delta from actual entries
        const entry = resultMap.get(driver.id);
        if (entry) {
          if (entry.dns) delta = 'DNS';
          else if (entry.dsq) delta = 'DSQ';
          else if (entry.dnf) delta = 'DNF';
          else delta = pos - entry.finishPosition;
        }
      } else {
        const qualiPos = qualiMap[driver.id];
        delta = qualiPos !== undefined ? qualiPos - pos : undefined;
      }

      return { position: pos, driver, variant, badges, delta };
    });
  }, [activeSessionId, existingBets, isEditable, qualifyingResults, activeSession, isRace, activeResult]);

  const [rows, setRows] = useState<GridRowData[]>(gridInitialData);

  useEffect(() => {
    setRows(gridInitialData);
    setSaveStatus('idle');
    if (isRace) {
      setPredictedSC(existingRaceBet?.predictedSC ?? 0);
      setPredictedDNF(existingRaceBet?.predictedDNF ?? 0);
      setFastestLapId(existingRaceBet?.grid.find(g => g.fastestLap)?.driverId ?? null);
      setDoublePoints(existingRaceBet?.doublePoints ?? false);
    }
  }, [gridInitialData, isRace, existingRaceBet]);

  const qualiMap = useMemo(() => {
    return qualifyingResults[activeSession?.type as keyof typeof qualifyingResults] || {};
  }, [qualifyingResults, activeSession]);

  const handleDriverSelect = (position: number, driver: GridDriver | null) => {
    setRows(prev => prev.map(row => {
      if (row.position !== position) return row;
      const newDriver = driver || placeholderDriver(position);
      const qualiPos = newDriver.id > 0 ? qualiMap[newDriver.id] : undefined;
      const delta = qualiPos !== undefined ? qualiPos - position : undefined;
      return { ...row, driver: newDriver, variant: 'default' as CardVariant, delta };
    }));
    setSaveStatus('idle');
  };

  const isGridComplete = rows.every(r => r.driver.id > 0);
  const isGridEmpty = rows.every(r => r.driver.id <= 0);

  const hasQualiResults = Object.keys(qualiMap).length > 0;

  const handleCopyQuali = () => {
    const gridSize = isRace ? GRID_SIZE.RACE : GRID_SIZE.SPRINT;
    // qualiMap: driverId -> qualiPosition. Invert to position -> driverId
    const posToDriverId = new Map<number, number>();
    for (const [driverIdStr, pos] of Object.entries(qualiMap)) {
      posToDriverId.set(pos as number, parseInt(driverIdStr, 10));
    }

    setRows(Array.from({ length: gridSize }, (_, i) => {
      const pos = i + 1;
      const driverId = posToDriverId.get(pos);
      const driver = driverId ? allDrivers.find(d => d.id === driverId) : undefined;
      return {
        position: pos,
        driver: driver || placeholderDriver(pos),
        variant: 'default' as CardVariant,
        badges: [],
        delta: driver ? 0 : undefined,
      };
    }));
    setSaveStatus('idle');
  };

  const handleClearGrid = () => {
    const gridSize = isRace ? GRID_SIZE.RACE : GRID_SIZE.SPRINT;
    setRows(Array.from({ length: gridSize }, (_, i) => ({
      position: i + 1,
      driver: placeholderDriver(i + 1),
      variant: 'default' as CardVariant,
      badges: [],
      delta: undefined,
    })));
    setSaveStatus('idle');
  };

  const handleDelete = () => {
    if (!activeSession) return;
    setSaveStatus('saving');
    startTransition(async () => {
      const result = isRace
        ? await deleteRaceBet({ sessionId: activeSession.id, targetUserId: currentUserId })
        : await deleteSprintBet({ sessionId: activeSession.id, targetUserId: currentUserId });
      if (result.success) {
        router.refresh();
      } else {
        setSaveStatus('error');
      }
    });
  };

  const handleSave = () => {
    if (!activeSession || !isGridComplete) return;

    setSaveStatus('saving');
    startTransition(async () => {
      const gridIds = rows.map(r => r.driver.id);
      let result;

      if (activeSession.type === 'RACE') {
        result = await saveRaceBet({
          sessionId: activeSession.id,
          gridIds,
          fastestLapId,
          doublePoints,
          predictedSC,
          predictedDNF,
          targetUserId: currentUserId,
        });
      } else {
        result = await saveSprintBet({
          sessionId: activeSession.id,
          gridIds,
          targetUserId: currentUserId,
        });
      }

      setSaveStatus(result.success ? 'saved' : 'error');
    });
  };

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto gap-8 pb-20">
      <GpSessionBar
        gpName={gpName}
        currentGpId={currentGpId}
        allGps={allGps}
        basePath="/apostas"
        sessions={allBettableSessions}
        activeSessionId={activeSessionId}
        onSessionChange={setActiveSessionId}
      />

      {!isEditable && !hasBet ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500 font-black uppercase italic tracking-widest">
            Nenhuma aposta registrada
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-xs font-black uppercase italic tracking-widest text-gray-500 text-center">Grid de Chegada</h3>
          <Grid
            key={activeSessionId}
            rows={rows}
            allDrivers={allDrivers}
            showDropdown={isEditable}
            showDelta={true}
            showBadges={!isEditable && activeSession?.hasEntries}
            rowGap="gap-2"
            onDriverSelect={handleDriverSelect}
          />

          {isEditable && (!isGridEmpty || hasQualiResults) && (
            <div className="flex gap-2">
              {!isGridEmpty && (
                <button
                  onClick={handleClearGrid}
                  className="flex-1 py-3 rounded-sm font-black uppercase italic tracking-tighter text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all active:scale-95"
                >
                  Limpar Grid
                </button>
              )}
              {hasQualiResults && (
                <button
                  onClick={handleCopyQuali}
                  className="flex-1 py-3 rounded-sm font-black uppercase italic tracking-tighter text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all active:scale-95"
                >
                  Copiar Qualify
                </button>
              )}
            </div>
          )}

          {isRace && activeSession?.raceConfig && (
            <>
            <h3 className="text-xs font-black uppercase italic tracking-widest text-gray-500 text-center">Extras</h3>
            <BetExtrasPanel
              isEditable={isEditable}
              allDrivers={allDrivers}
              fastestLapId={fastestLapId}
              onFastestLapChange={setFastestLapId}
              predictedSC={predictedSC}
              onSCChange={setPredictedSC}
              predictedDNF={predictedDNF}
              onDNFChange={setPredictedDNF}
              doublePoints={doublePoints}
              onDoublePointsChange={setDoublePoints}
              doublePointsRemaining={doublePointsRemaining}
            />
            </>
          )}

          {!isEditable && hasBet && activeSession?.hasEntries && activeResult && (
            <>
            <h3 className="text-xs font-black uppercase italic tracking-widest text-gray-500 text-center">Pontuação</h3>
            <BetResultsTable result={activeResult} isRace={isRace} />
            </>
          )}

          {isEditable && (
            <>
              <button
                disabled={!isGridComplete || isPending || saveStatus === 'saving'}
                className={`w-full py-4 rounded-sm font-black uppercase italic tracking-tighter transition-all shadow-xl ${
                  saveStatus === 'saved'
                    ? 'bg-green-600 text-white cursor-default'
                    : isGridComplete && saveStatus !== 'saving'
                      ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95 cursor-pointer'
                      : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
                onClick={handleSave}
              >
                {saveStatus === 'saving' ? 'Processando...' : saveStatus === 'saved' ? '✓ Feito!' : 'Confirmar Aposta'}
              </button>

              {hasBet && (
                <button
                  disabled={isPending || saveStatus === 'saving'}
                  onClick={handleDelete}
                  className="w-full py-4 rounded-sm font-black uppercase italic tracking-tighter text-red-600 border border-red-600/20 hover:border-red-600/50 hover:bg-red-600/10 transition-all active:scale-95"
                >
                  Deletar Aposta
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}