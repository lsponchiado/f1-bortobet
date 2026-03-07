'use client';

import React, { useState } from 'react';
import { GridPanel } from '@/components/GridPanel';
import { DriverPanel } from '@/components/DriverPanel';
import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveRaceBet } from '@/lib/actions'; 

// Tipagem para os dados de uma aposta existente
interface InitialBetData {
  id?: number;
  gridIds: number[];
  fastestLapId: number | null;
  favoriteId: number | null;
  predictedSC: number;
  predictedDNF: number;
}

interface BetRaceClientProps {
  drivers: any[];
  raceId: number;
  initialBet?: InitialBetData; // Propriedade opcional para o modo edição
}

export default function BetRaceClient({ drivers, raceId, initialBet }: BetRaceClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Inicializa o Grid: se houver aposta inicial, mapeia os IDs para os objetos dos pilotos
  const [grid, setGrid] = useState<(any | null)[]>(() => {
    if (initialBet?.gridIds) {
      return initialBet.gridIds.map(id => drivers.find(d => d.id === id) || null);
    }
    return Array(10).fill(null);
  });

  // Inicializa os estados de destaque e dials com valores existentes ou padrões
  const [fastestLapDriverId, setFastestLapDriverId] = useState<number | null>(
    initialBet?.fastestLapId ?? null
  );
  const [favoriteDriverId, setFavoriteDriverId] = useState<number | null>(
    initialBet?.favoriteId ?? null
  );
  const [predictedSC, setPredictedSC] = useState(initialBet?.predictedSC ?? 0);
  const [predictedDNF, setPredictedDNF] = useState(initialBet?.predictedDNF ?? 0);

  // Filtra motoristas disponíveis (quem não está no grid)
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
    const driverToRemove = grid[gridIndex];
    if (driverToRemove) {
      if (fastestLapDriverId === driverToRemove.id) setFastestLapDriverId(null);
      if (favoriteDriverId === driverToRemove.id) setFavoriteDriverId(null);
    }
    setGrid(prevGrid => {
      const newGrid = [...prevGrid];
      newGrid[gridIndex] = null;
      return newGrid;
    });
  };

  const handleToggleFastestLap = (index: number) => {
    const driver = grid[index];
    if (!driver) return;
    setFastestLapDriverId(prev => prev === driver.id ? null : driver.id);
  };

  const handleToggleFavorite = (index: number) => {
    const driver = grid[index];
    if (!driver) return;
    setFavoriteDriverId(prev => prev === driver.id ? null : driver.id);
  };

  const handleDial = (setter: React.Dispatch<React.SetStateAction<number>>, current: number, delta: number) => {
    setter(Math.max(0, Math.min(8, current + delta)));
  };

  const handleSave = async () => {
    if (grid.some(d => d === null)) {
      alert("Atenção: Preencha todo o Top 10 antes de salvar sua aposta!");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveRaceBet({
        raceId,
        betId: initialBet?.id, // Enviamos o ID da aposta se estivermos editando
        gridIds: grid.map(d => d.id),
        fastestLapId: fastestLapDriverId,
        favoriteId: favoriteDriverId,
        predictedSC,
        predictedDNF
      });

      if (result.success) {
        router.push('/');
        router.refresh();
      } else {
        alert(result.error || "Erro ao salvar aposta.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro de conexão ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentFastestLapIndex = grid.findIndex(d => d !== null && d.id === fastestLapDriverId);
  const currentFavoriteIndex = grid.findIndex(d => d !== null && d.id === favoriteDriverId);

  return (
    <main className="flex flex-1 overflow-hidden p-4 gap-8">
      
      {/* PAINEL ESQUERDO: Paddock */}
      <section className="w-[350px] flex-shrink-0 overflow-y-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <DriverPanel drivers={availableDrivers} onReturnToPaddock={handleReturnToPaddock} />
      </section>

      {/* PAINEL DIREITO: Grid e Controles */}
      <section className="flex-1 overflow-y-auto pb-40 flex justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-full max-w-[800px]">
          
          <div className="flex flex-col items-center justify-center mb-10 mt-6 gap-2">
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
              {initialBet ? 'Editar Aposta' : 'Aposta da Corrida'}
            </h1>
            <p className="text-[#e10600] text-xs font-bold uppercase tracking-widest">
              Arraste os pilotos para os boxes
            </p>
          </div>

          <GridPanel 
            selections={grid} 
            interactive={true} 
            onPlaceNew={handlePlaceNew}
            onSwap={handleSwap}
            showFastestLapToggle={true}
            showFavoriteDriverToggle={true}
            fastestLapIndex={currentFastestLapIndex !== -1 ? currentFastestLapIndex : null}
            onToggleFastestLap={handleToggleFastestLap}
            favoriteDriverIndex={currentFavoriteIndex !== -1 ? currentFavoriteIndex : null}
            onToggleFavoriteDriver={handleToggleFavorite}
          />

          <div className="mt-24 w-full"> 
            
            <div className="flex flex-row items-stretch gap-8 w-full">
              
              {/* 1. DIALS */}
              <div className="flex flex-col gap-8 shrink-0 w-[200px]">
                
                <div className="flex-1 bg-[#15151e] p-6 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-4 w-full shadow-lg">
                  <span className="text-[11px] xl:text-xs font-black uppercase text-gray-500 tracking-widest text-center leading-tight">Safety Cars</span>
                  <div className="flex items-center gap-3 bg-black/40 rounded-xl border border-white/10 p-2 w-full justify-between mt-auto mb-auto">
                    <button onClick={() => handleDial(setPredictedSC, predictedSC, -1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Minus size={20} strokeWidth={3} />
                    </button>
                    <span className="text-3xl font-black text-[#e10600] w-8 text-center">{predictedSC}</span>
                    <button onClick={() => handleDial(setPredictedSC, predictedSC, 1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-[#15151e] p-6 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-4 w-full shadow-lg">
                  <span className="text-[11px] xl:text-xs font-black uppercase text-gray-500 tracking-widest text-center leading-tight">Abandonos (DNF)</span>
                  <div className="flex items-center gap-3 bg-black/40 rounded-xl border border-white/10 p-2 w-full justify-between mt-auto mb-auto">
                    <button onClick={() => handleDial(setPredictedDNF, predictedDNF, -1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Minus size={20} strokeWidth={3} />
                    </button>
                    <span className="text-3xl font-black text-[#e10600] w-8 text-center">{predictedDNF}</span>
                    <button onClick={() => handleDial(setPredictedDNF, predictedDNF, 1)} className="p-3 text-gray-500 hover:text-white transition-colors">
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

              </div>

              {/* 2. RESUMO DO GRID */}
              <div className="flex-1 bg-[#15151e] p-8 rounded-2xl border border-white/5 flex flex-col shadow-lg min-w-0">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-6 text-center">Resumo do Grid</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-12 gap-y-2">
                  {grid.map((driver, idx) => {
                    const isFL = driver && driver.id === fastestLapDriverId;
                    const isFav = driver && driver.id === favoriteDriverId;
                    return (
                      <div key={idx} className="flex items-center text-base border-b border-white/10 py-3">
                        <div className="flex items-center gap-3 w-full">
                          <span className="font-black italic text-white/30 text-lg w-8 shrink-0">P{idx + 1}</span>
                          <span className="text-white/90 font-bold uppercase tracking-wide truncate">
                            {driver ? driver.name : '---'}
                          </span>
                          
                          <div className="flex gap-2 items-center shrink-0">
                            {isFL && <span className="text-[#9333ea] text-xl leading-none drop-shadow-[0_0_8px_rgba(147,51,234,0.8)]" title="Volta Rápida">⏱</span>}
                            {isFav && <span className="text-[#eab308] text-xl leading-none drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" title="Favorito">★</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="w-full pt-12 pb-8">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-[#e10600] hover:bg-[#ff0700] disabled:bg-zinc-800 text-white font-black italic uppercase text-2xl rounded-2xl transition-all active:scale-95 shadow-2xl flex items-center justify-center p-6"
              >
                {isSaving ? 'Gravando...' : 'Salvar Aposta'}
              </button>
            </div>

          </div>

        </div>
      </section>

    </main>
  );
}