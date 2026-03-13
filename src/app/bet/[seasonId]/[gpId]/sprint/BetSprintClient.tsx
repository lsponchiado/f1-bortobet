'use client';

import { useState, useEffect } from 'react';
import { GridPanel } from '@/components/GridPanel';
import { DriverPanel } from '@/components/DriverPanel';
import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveSprintBet } from '@/lib/actions';

interface InitialBetData {
  id?: number;
  gridIds: number[];
}

interface BetSprintClientProps {
  drivers: any[];
  sessionId: number;
  initialBet?: InitialBetData;
  gridPositions: Record<number, number>;
}

export default function BetSprintClient({ drivers, sessionId, initialBet, gridPositions }: BetSprintClientProps) {
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
    return Array(8).fill(null);
  });

  const availableDrivers = drivers.filter(
    (driver) => !grid.some((selected) => selected?.id === driver.id)
  );

  const handlePlaceNew = (driverIdStr: string, targetIndex: number) => {
    const driverId = parseInt(driverIdStr, 10);
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;
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
    setGrid(prevGrid => {
      const newGrid = [...prevGrid];
      newGrid[gridIndex] = null;
      return newGrid;
    });
  };

  const handleSave = async () => {
    if (grid.some(d => d === null)) {
      alert('Atenção: Preencha todo o Top 8 antes de salvar sua aposta!');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveSprintBet({
        sessionId,
        gridIds: grid.map(d => d.id),
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
                  allowHailMary={false}
                  allowUnderdog={false}
                  allowFreefall={false}
                />
              </div>
            </div>

            <div className="mt-24 w-full flex flex-col gap-6 xl:gap-8">

              {/* Summary */}
              <div className="bg-[#15151e] p-8 rounded-2xl border border-white/5 flex flex-col shadow-lg">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6 text-center">Resumo do Grid</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-12 gap-y-2">
                  {grid.map((driver, idx) => (
                    <div key={idx} className="flex items-center text-base border-b border-white/10 py-3">
                      <div className="flex items-center gap-3 w-full">
                        <span className="font-black italic text-white/30 text-lg w-8 shrink-0">P{idx + 1}</span>
                        <span className="text-white/90 font-bold uppercase tracking-wide truncate">
                          {driver ? driver.name : '---'}
                        </span>
                      </div>
                    </div>
                  ))}
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
