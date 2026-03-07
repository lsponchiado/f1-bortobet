'use client';

import React, { useState } from 'react';
import { GridPanel } from '../../../components/GridPanel';

interface TestClientProps {
  initialDrivers: any[];
}

export default function TestClient({ initialDrivers }: TestClientProps) {
  const preFilledGrid = initialDrivers.slice(0, 10);
  const [grid] = useState<(any | null)[]>(preFilledGrid);
  
  // APOSTAS FEITAS
  const fastestLap = 0;      // Apostou volta rápida no P1
  const favoriteDriver = 2;  // Coringa no P3 (Ex: Alonso)
  
  // GABARITO OFICIAL
  const mockActualFastestLap = 1; // Quem fez a volta na vida real foi o P2. O P1 vai ficar com relógio Vermelho.

  // MOCK DE EVENTOS (Aposta vs Chegada Oficial)
  // Cenário:
  // - P1: Apostou P1. Chegou P3. (Caiu 2 posições. Cor: Red)
  // - P2: Apostou P2. Chegou P2. (Manteve 0. Cor: Green)
  // - P3: Apostou P3 (Favorito). Chegou P1! (Subiu 2 posições. Cor: Red pq errou a cravada).
  
  const mockPositionChanges = {
    0: -2,  // Estava apostado em P1, mas a corrida jogou pra P3
    1: 0,   // Acertou na mosca
    2: 2,   // Estava apostado em P3, mas a corrida jogou pra P1
    3: 0,   // Acertou na mosca
  };

  const mockBetResults: Record<number, 'neutral' | 'green' | 'red'> = {
    0: 'red',   // Errou P1
    1: 'green', // Acertou P2
    2: 'red',   // Errou P3
    3: 'green', // Acertou P4
  };

  // PONTUAÇÃO CALCULADA E DISTRIBUÍDA (Matemática Oficial)
  const mockEarnedPoints: Record<number, number> = {
    0: 0,    // P1 Errado. Não é favorito. = 0 PONTOS. (Errou a volta rápida também).
    1: 18,   // P2 Acertou na mosca = +18 PONTOS. (Fez a volta, mas não tinha apostado o troféu nele, então não ganha os +10).
    2: 25,   // P3 Errado! MAS ELE É O FAVORITO! Ele chegou em P1 na vida real, então suga os exatos +25 PONTOS pra você.
    3: 12,   // P4 Acertou na mosca = +12 PONTOS.
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-y-auto text-white">
      <main className="flex-1 p-4 flex justify-center">
        <div className="w-full min-w-full xl:min-w-[960px] max-w-[1200px] pb-40">
          
          <div className="flex flex-col items-center justify-center mb-10 mt-6 gap-2">
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
              Gabarito da Corrida
            </h1>
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
              Visualização de Resultados e Pontos
            </p>
          </div>

          <GridPanel 
            selections={grid} 
            interactive={false} 
            
            showFastestLapToggle={true}
            showFavoriteDriverToggle={true}
            
            fastestLapIndex={fastestLap}
            actualFastestLapIndex={mockActualFastestLap}
            favoriteDriverIndex={favoriteDriver}
            
            showPositionChanges={true}
            positionChanges={mockPositionChanges}
            betResults={mockBetResults} 
            earnedPoints={mockEarnedPoints} 
          />

        </div>
      </main>
    </div>
  );
}