'use client';

import React from 'react';
import { BetPanel } from '@/components/BetPanel';

export default function TestBetPanel() {
  // Simulação de datas
  const futureRace = new Date();
  futureRace.setDate(futureRace.getDate() + 5);

  const futureSprint = new Date();
  futureSprint.setDate(futureSprint.getDate() + 4);

  const futureQuali = new Date();
  futureQuali.setDate(futureQuali.getDate() + 3);

  // Simulação de evento trancado (daqui a 2 minutos)
  const lockedRace = new Date();
  lockedRace.setMinutes(lockedRace.getMinutes() + 2);

  const handleAction = (type: string) => {
    alert(`Clicou para: ${type}`);
  };

  return (
    <main className="min-h-screen bg-[#0f0f14] p-12 space-y-12 flex flex-col items-center">
      <h1 className="text-white/20 font-black uppercase tracking-[0.5em] text-sm">Laboratório de Painéis</h1>

      {/* Cenário 1: Novo Usuário / Novo GP (GP Australia) */}
      <section className="space-y-4">
        <p className="text-gray-500 text-xs font-bold uppercase text-center">Cenário 1: Tudo aberto - Sem aposta feita</p>
        <BetPanel 
          eventName="GP da Austrália"
          location="Melbourne, Victoria"
          trackMapUrl="https://media.formula1.com/image/upload/f_auto,q_auto,c_fill,g_auto,w_1100,h_619/content/dam/fom-website/2018-redesign-assets/circuit-maps/1.3.svg"
          schedule={{
            quali: futureQuali,
            sprint: futureSprint,
            race: futureRace
          }}
          hasRaceBet={false}
          hasSprintBet={false}
          onAction={handleAction}
        />
      </section>

      {/* Cenário 2: Usuário já apostou / Sem Sprint (GP Brasil) */}
      <section className="space-y-4">
        <p className="text-gray-500 text-xs font-bold uppercase text-center">Cenário 2: Aposta feita - Sem Sprint no GP</p>
        <BetPanel 
          eventName="GP de Interlagos"
          location="São Paulo, Brasil"
          trackMapUrl="https://media.formula1.com/image/upload/f_auto,q_auto,c_fill,g_auto,w_1100,h_619/content/dam/fom-website/2018-redesign-assets/circuit-maps/Brazil_Circuit.png"
          schedule={{
            quali: futureQuali,
            race: futureRace
            // Note que não passei a sprint aqui
          }}
          hasRaceBet={true}
          hasSprintBet={false}
          onAction={handleAction}
        />
      </section>

      {/* Cenário 3: Trancado (Faltando 2 min) */}
      <section className="space-y-4">
        <p className="text-gray-500 text-xs font-bold uppercase text-center">Cenário 3: Evento prestes a começar (Visualizar apenas)</p>
        <BetPanel 
          eventName="GP de Mônaco"
          location="Monte Carlo"
          trackMapUrl="https://media.formula1.com/image/upload/f_auto,q_auto,c_fill,g_auto,w_1100,h_619/content/dam/fom-website/2018-redesign-assets/circuit-maps/Monaco_Circuit.png"
          schedule={{
            quali: futureQuali,
            race: lockedRace
          }}
          hasRaceBet={true}
          hasSprintBet={false}
          onAction={handleAction}
        />
      </section>
    </main>
  );
}