'use client';

import { useState, useEffect } from 'react';
import { GridPanel } from '@/components/GridPanel';
import { DriverPanel } from '@/components/DriverPanel';
import { DriverCard } from '@/components/DriverCard';
import { Minus, Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveRaceBet } from '@/lib/actions';

interface InitialBetData {
  raceId?: number;
  id?: number;
  gridIds: number[];
  fastestLapId: number | null;
  allInDriverId: number | null;
  doublePoints: boolean;
  predictedSC: number;
  predictedDNF: number;
}

interface BetRaceClientProps {
  drivers: any[];
  sessionId: number;
  initialBet?: InitialBetData;
  doublePointsTokensUsed: number;
  allowDoublePoints: boolean;
  allowHailMary: boolean;
  allowUnderdog: boolean;
  allowFreefall: boolean;
  gridPositions: Record<number, number>;
}

export default function BetRaceClient({ drivers, sessionId, initialBet, doublePointsTokensUsed, allowDoublePoints, allowHailMary, allowUnderdog, allowFreefall, gridPositions }: BetRaceClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [paddockOpen, setPaddockOpen] = useState(false);

  const [isLargeScreen, setIsLargeScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    setIsLargeScreen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [grid, setGrid] = useState<(any | null)[]>(() => {
    if (initialBet?.gridIds) {
      return initialBet.gridIds.map(id => drivers.find(d => d.id === id) || null);
    }
    return Array(10).fill(null);
  });

  const [fastestLapDriverId, setFastestLapDriverId] = useState<number | null>(
    initialBet?.fastestLapId ?? null
  );
  const [allInDriverId, setAllInDriverId] = useState<number | null>(initialBet?.allInDriverId ?? null);
  const [doublePoints, setDoublePoints] = useState<boolean>(initialBet?.doublePoints ?? false);
  const [predictedSC, setPredictedSC] = useState(initialBet?.predictedSC ?? 0);
  const [predictedDNF, setPredictedDNF] = useState(initialBet?.predictedDNF ?? 0);

  const availableDrivers = drivers.filter(
    (driver) => !grid.some((selected) => selected?.id === driver.id)
  );

  const handlePlaceNew = (driverIdStr: string, targetIndex: number) => {
    const driverId = parseInt(driverIdStr, 10);
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
    if (driverId === allInDriverId) setAllInDriverId(null);
    setGrid(prevGrid => {
      const newGrid = [...prevGrid];
      newGrid[targetIndex] = driver;
      return newGrid;
    });
  };

  const handleSwap = (sourceIndex: number, targetIndex: number) => {
    setGrid(prevGrid => {
      const newGrid = [...prevGrid];
      const temp = newGrid[sourceIndex];
      newGrid[sourceIndex] = newGrid[targetIndex];
      newGrid[targetIndex] = temp;
      return newGrid;
    });
  };

  const handleReturnToPaddock = (gridIndex: number) => {
    const driverToRemove = grid[gridIndex];
    if (driverToRemove) {
      if (fastestLapDriverId === driverToRemove.id) setFastestLapDriverId(null);
    }
    setGrid(prevGrid => {
      const newGrid = [...prevGrid];
      newGrid[gridIndex] = null;
      return newGrid;
    });
  };


  const handleDial = (setter: (value: number) => void, current: number, delta: number) => {
    setter(Math.max(0, Math.min(3, current + delta)));
  };

  const handleAllInDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const newDriverId = e.dataTransfer.getData('newDriverId');
    if (newDriverId) {
      const driverId = parseInt(newDriverId, 10);
      if (!grid.some(d => d?.id === driverId)) {
        setAllInDriverId(driverId);
      }
    }
  };

  const handleSave = async () => {
    if (grid.some(d => d === null)) {
      alert('Atenção: Preencha todo o Top 10 antes de salvar sua aposta!');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveRaceBet({
        sessionId,
        betId: initialBet?.id,
        gridIds: grid.map(d => d.id),
        fastestLapId: fastestLapDriverId,
        allInDriverId,
        doublePoints,
        predictedSC,
        predictedDNF,
      });

      if (result.success) {
        router.push('/');
        router.refresh();
      } else {
        alert(result.error || 'Erro ao salvar aposta.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex flex-col flex-1 overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-end px-4 pt-4 pb-3">
        <button
          onClick={() => setPaddockOpen(p => !p)}
          className="xl:hidden flex items-center gap-2 bg-[#1f1f27] border border-white/10 rounded-xl px-3 py-2 text-xs font-black uppercase text-gray-400 active:bg-white/10 transition-colors"
        >
          <Users className="w-4 h-4" />
          Paddock
          {availableDrivers.length > 0 && (
            <span className="bg-[#e10600] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {availableDrivers.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden gap-4 xl:gap-8 px-4 pb-4">
        {/* Desktop sidebar */}
        <aside className="hidden xl:flex xl:flex-col xl:w-[472px] xl:flex-shrink-0 xl:h-full xl:overflow-hidden xl:pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DriverPanel drivers={availableDrivers} onReturnToPaddock={handleReturnToPaddock} />
        </aside>

        {/* Content column */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Mobile paddock panel */}
          {paddockOpen && (
            <div className="xl:hidden shrink-0 overflow-y-auto max-h-[40vh] mb-2 [scrollbar-width:thin]">
              <DriverPanel drivers={availableDrivers} onReturnToPaddock={handleReturnToPaddock} />
            </div>
          )}

          <section className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-full max-w-[1200px] mx-auto">
              <div className="relative">
                <GridPanel
                  selections={grid}
                  interactive={true}
                  forceCompact={!isLargeScreen}
                  onPlaceNew={handlePlaceNew}
                  onSwap={handleSwap}
                  gridPositions={gridPositions}
                  allowHailMary={allowHailMary}
                  allowUnderdog={allowUnderdog}
                  allowFreefall={allowFreefall}
                  fastestLapDriverId={fastestLapDriverId}
                  onToggleFastestLap={(driverId) =>
                    setFastestLapDriverId((prev) => (prev === driverId ? null : driverId))
                  }
                />
              </div>
            </div>

          <div className="mt-24 w-full flex flex-col gap-6 xl:gap-8">

            {/* Row 1: Safety Cars | Abandonos | All-In | Double Points */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-[#15151e] p-4 rounded-2xl border border-white/5 flex flex-col shadow-lg">
                <span className="text-[11px] xl:text-xs font-black uppercase text-gray-500 tracking-widest text-center leading-tight">Safety Cars</span>
                <div className="flex-1 flex items-center justify-center pt-4 pb-0">
                  <div className="flex items-center gap-3 bg-black/40 rounded-xl border border-white/10 p-2 w-full justify-between">
                    <button onClick={() => handleDial(setPredictedSC, predictedSC, -1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Minus size={20} strokeWidth={3} />
                    </button>
                    <span className="text-3xl font-black text-[#e10600] w-8 text-center">{predictedSC >= 3 ? '3+' : predictedSC}</span>
                    <button onClick={() => handleDial(setPredictedSC, predictedSC, 1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#15151e] p-4 rounded-2xl border border-white/5 flex flex-col shadow-lg">
                <span className="text-[11px] xl:text-xs font-black uppercase text-gray-500 tracking-widest text-center leading-tight">Abandonos (DNF)</span>
                <div className="flex-1 flex items-center justify-center pt-4 pb-0">
                  <div className="flex items-center gap-3 bg-black/40 rounded-xl border border-white/10 p-2 w-full justify-between">
                    <button onClick={() => handleDial(setPredictedDNF, predictedDNF, -1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Minus size={20} strokeWidth={3} />
                    </button>
                    <span className="text-3xl font-black text-[#e10600] w-8 text-center">{predictedDNF >= 3 ? '3+' : predictedDNF}</span>
                    <button onClick={() => handleDial(setPredictedDNF, predictedDNF, 1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>

              {/* All-In: drop target */}
              <div
                className="bg-[#15151e] p-4 rounded-2xl border border-white/5 flex flex-col shadow-lg"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={handleAllInDrop}
              >
                <span className="text-[11px] xl:text-xs font-black uppercase text-gray-500 tracking-widest text-center leading-tight">All In</span>
                <div className="flex-1 flex items-center justify-center pt-4 pb-0">
                  {allInDriverId && drivers.find(d => d.id === allInDriverId) ? (
                    <div className="w-[150px] xl:w-[200px] shrink-0 relative">
                      <DriverCard driver={drivers.find(d => d.id === allInDriverId)!} variant="compact" />
                      <button
                        onClick={() => setAllInDriverId(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#e10600] text-white text-[10px] font-black flex items-center justify-center z-10"
                      >✕</button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center h-16 w-full">
                      <span className="text-[10px] text-white/30 uppercase font-black tracking-widest text-center px-2">Arraste um piloto aqui</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Double Points */}
              {allowDoublePoints && (doublePointsTokensUsed < 3 || doublePoints) ? (
                <div className="bg-[#15151e] p-4 rounded-2xl border border-white/5 flex flex-col shadow-lg">
                  <span className="text-[11px] xl:text-xs font-black uppercase text-gray-500 tracking-widest text-center leading-tight">Double Points</span>
                  <div className="flex-1 flex items-center justify-center pt-4 pb-0">
                    <div className="flex items-center justify-between gap-4 w-full px-2">
                      <span className="text-xs text-gray-400 uppercase font-bold leading-snug">
                        {3 - doublePointsTokensUsed} token{(3 - doublePointsTokensUsed) !== 1 ? 's' : ''} restante{(3 - doublePointsTokensUsed) !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => setDoublePoints(prev => !prev)}
                        className={`relative w-14 h-7 rounded-full transition-colors shrink-0 ${doublePoints ? 'bg-[#e10600]' : 'bg-gray-700'}`}
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-200 ${doublePoints ? 'left-8' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hidden xl:block" />
              )}
            </div>

            {/* Row 2: Summary (full width) */}
            <div className="bg-[#15151e] p-8 rounded-2xl border border-white/5 flex flex-col shadow-lg">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6 text-center">Resumo do Grid</h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-12 gap-y-2">
                {grid.map((driver, idx) => {
                  const position = idx + 1;
                  const isFL = driver && driver.id === fastestLapDriverId;
                  const qualPos = driver ? (gridPositions[driver.id] ?? null) : null;
                  const hailMary = allowHailMary && qualPos !== null && qualPos >= 20 && position <= 5;
                  const underdog = allowUnderdog && qualPos !== null && position <= 3 && (qualPos - position) >= 10;
                  const freefall = allowFreefall && qualPos !== null && (position - qualPos) >= 5;
                  return (
                    <div key={idx} className="flex items-center text-base border-b border-white/10 py-3">
                      <div className="flex items-center gap-3 w-full">
                        <span className="font-black italic text-white/30 text-lg w-8 shrink-0">P{idx + 1}</span>
                        <span className="text-white/90 font-bold uppercase tracking-wide truncate">
                          {driver ? driver.name : '---'}
                        </span>
                        <div className="flex gap-2 items-center shrink-0 ml-auto">
                          {hailMary && <span className="text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Hail Mary</span>}
                          {underdog && <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Underdog</span>}
                          {freefall && <span className="text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Freefall</span>}
                          {isFL && <span className="text-[10px] font-black bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Volta Rápida</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save button */}
            <div style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-[#e10600] hover:bg-[#ff0700] disabled:bg-zinc-800 text-white font-black italic uppercase text-2xl rounded-2xl transition-all active:scale-95 shadow-2xl flex items-center justify-center p-6"
              >
                {isSaving ? 'Gravando...' : 'Salvar Aposta'}
              </button>
            </div>

            </div>
            </section>
          </div>
        </div>
    </main>
  );
}
