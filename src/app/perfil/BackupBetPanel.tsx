'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, ShieldCheck } from 'lucide-react';
import { Grid } from '@/components/Grid';
import { BetExtrasPanel } from '@/components/BetExtrasPanel';
import type { GridRowData, GridDriver, CardVariant } from '@/types/grid';
import { placeholderDriver } from '@/lib/grid';
import { saveBackupRaceBet, saveBackupSprintBet, deleteBackupBet } from '@/lib/actions';
import { GRID_SIZE } from '@/lib/constants';

interface BackupRaceData {
  gridIds: number[];
  fastestLapId: number | null;
  predictedSC: number;
  predictedDNF: number;
}

interface BackupSprintData {
  gridIds: number[];
}

interface BackupBetPanelProps {
  allDrivers: GridDriver[];
  backupRace: BackupRaceData | null;
  backupSprint: BackupSprintData | null;
}


function buildRows(gridIds: number[], gridSize: number, allDrivers: GridDriver[]): GridRowData[] {
  return Array.from({ length: gridSize }, (_, i) => {
    const driverId = gridIds[i];
    const driver = driverId ? allDrivers.find(d => d.id === driverId) : undefined;
    return {
      position: i + 1,
      driver: driver || placeholderDriver(i + 1),
      variant: 'default' as CardVariant,
      badges: [],
      delta: undefined,
    };
  });
}

type EditingMode = null | 'race' | 'sprint';

export function BackupBetPanel({ allDrivers, backupRace, backupSprint }: BackupBetPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditingMode>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Race state
  const [raceRows, setRaceRows] = useState<GridRowData[]>(
    buildRows(backupRace?.gridIds ?? [], GRID_SIZE.RACE, allDrivers)
  );
  const [predictedSC, setPredictedSC] = useState(backupRace?.predictedSC ?? 0);
  const [predictedDNF, setPredictedDNF] = useState(backupRace?.predictedDNF ?? 0);
  const [fastestLapId, setFastestLapId] = useState<number | null>(backupRace?.fastestLapId ?? null);

  // Sprint state
  const [sprintRows, setSprintRows] = useState<GridRowData[]>(
    buildRows(backupSprint?.gridIds ?? [], GRID_SIZE.SPRINT, allDrivers)
  );

  const handleDriverSelect = (position: number, driver: GridDriver | null, type: 'race' | 'sprint') => {
    const setter = type === 'race' ? setRaceRows : setSprintRows;
    setter(prev => prev.map(row => {
      if (row.position !== position) return row;
      return { ...row, driver: driver || placeholderDriver(position), variant: 'default' as CardVariant };
    }));
    setSaveStatus('idle');
  };

  const handleSaveRace = () => {
    const gridIds = raceRows.map(r => r.driver.id);
    if (gridIds.some(id => id <= 0)) return;
    setSaveStatus('saving');
    startTransition(async () => {
      const result = await saveBackupRaceBet({ gridIds, fastestLapId, predictedSC, predictedDNF });
      setSaveStatus(result.success ? 'saved' : 'error');
      if (result.success) {
        setTimeout(() => { setEditing(null); setSaveStatus('idle'); router.refresh(); }, 800);
      }
    });
  };

  const handleSaveSprint = () => {
    const gridIds = sprintRows.map(r => r.driver.id);
    if (gridIds.some(id => id <= 0)) return;
    setSaveStatus('saving');
    startTransition(async () => {
      const result = await saveBackupSprintBet({ gridIds });
      setSaveStatus(result.success ? 'saved' : 'error');
      if (result.success) {
        setTimeout(() => { setEditing(null); setSaveStatus('idle'); router.refresh(); }, 800);
      }
    });
  };

  const handleDelete = (type: 'race' | 'sprint') => {
    startTransition(async () => {
      const result = await deleteBackupBet(type);
      if (result.success) {
        if (type === 'race') {
          setRaceRows(buildRows([], GRID_SIZE.RACE, allDrivers));
          setPredictedSC(0);
          setPredictedDNF(0);
          setFastestLapId(null);
        } else {
          setSprintRows(buildRows([], GRID_SIZE.SPRINT, allDrivers));
        }
        setEditing(null);
        router.refresh();
      }
    });
  };

  const raceComplete = raceRows.every(r => r.driver.id > 0);
  const sprintComplete = sprintRows.every(r => r.driver.id > 0);
  const hasRaceBackup = backupRace !== null;
  const hasSprintBackup = backupSprint !== null;

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Apostas Backup</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Caso esqueça de apostar, o backup é usado automaticamente</p>
        </div>
      </div>
      <div className="px-6 py-2">

        {/* Race backup row */}
        <div className="flex items-center justify-between py-4">
          <span className="text-white font-black uppercase italic text-sm">Corrida</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setEditing(editing === 'race' ? null : 'race'); setSaveStatus('idle'); }}
              className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#e10600] transition-colors px-3 py-1.5 rounded-xl hover:bg-white/5"
            >
              {editing === 'race' ? 'Fechar' : hasRaceBackup ? 'Editar' : 'Criar'}
            </button>
            {hasRaceBackup && (
              <button
                onClick={() => handleDelete('race')}
                className="p-2 transition-colors rounded-lg hover:bg-red-500/10"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Race editor */}
        {editing === 'race' && (
          <div className="space-y-4 pb-4">
            <h4 className="text-xs font-black uppercase italic tracking-widest text-gray-500 text-center">Grid de Chegada (Top 10)</h4>
            <Grid
              rows={raceRows}
              allDrivers={allDrivers}
              showDropdown={true}
              showDelta={false}
              showBadges={false}
              rowGap="gap-2"
              onDriverSelect={(pos, driver) => handleDriverSelect(pos, driver, 'race')}
            />
            <h4 className="text-xs font-black uppercase italic tracking-widest text-gray-500 text-center">Extras</h4>
            <BetExtrasPanel
              isEditable={true}
              allDrivers={allDrivers}
              fastestLapId={fastestLapId}
              onFastestLapChange={setFastestLapId}
              predictedSC={predictedSC}
              onSCChange={setPredictedSC}
              predictedDNF={predictedDNF}
              onDNFChange={setPredictedDNF}
              doublePoints={false}
              onDoublePointsChange={() => {}}
              doublePointsRemaining={0}
              hideDoublePoints
            />
            <button
              disabled={!raceComplete || isPending || saveStatus === 'saving'}
              className={`w-full py-4 rounded-sm font-black uppercase italic tracking-tighter transition-all shadow-xl ${
                saveStatus === 'saved'
                  ? 'bg-green-600 text-white cursor-default'
                  : raceComplete && saveStatus !== 'saving'
                    ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95 cursor-pointer'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              onClick={handleSaveRace}
            >
              {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? '✓ Salvo!' : 'Salvar Backup Corrida'}
            </button>
          </div>
        )}

        {/* Sprint backup row */}
        <div className="flex items-center justify-between py-4 border-t border-white/5">
          <span className="text-white font-black uppercase italic text-sm">Sprint</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setEditing(editing === 'sprint' ? null : 'sprint'); setSaveStatus('idle'); }}
              className="text-xs font-black uppercase tracking-widest text-gray-500 hover:text-[#e10600] transition-colors px-3 py-1.5 rounded-xl hover:bg-white/5"
            >
              {editing === 'sprint' ? 'Fechar' : hasSprintBackup ? 'Editar' : 'Criar'}
            </button>
            {hasSprintBackup && (
              <button
                onClick={() => handleDelete('sprint')}
                className="p-2 transition-colors rounded-lg hover:bg-red-500/10"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Sprint editor */}
        {editing === 'sprint' && (
          <div className="space-y-4 pb-4">
            <h4 className="text-xs font-black uppercase italic tracking-widest text-gray-500 text-center">Grid de Chegada (Top 8)</h4>
            <Grid
              rows={sprintRows}
              allDrivers={allDrivers}
              showDropdown={true}
              showDelta={false}
              showBadges={false}
              rowGap="gap-2"
              onDriverSelect={(pos, driver) => handleDriverSelect(pos, driver, 'sprint')}
            />
            <button
              disabled={!sprintComplete || isPending || saveStatus === 'saving'}
              className={`w-full py-4 rounded-sm font-black uppercase italic tracking-tighter transition-all shadow-xl ${
                saveStatus === 'saved'
                  ? 'bg-green-600 text-white cursor-default'
                  : sprintComplete && saveStatus !== 'saving'
                    ? 'bg-red-600 text-white hover:bg-red-700 active:scale-95 cursor-pointer'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              onClick={handleSaveSprint}
            >
              {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? '✓ Salvo!' : 'Salvar Backup Sprint'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
