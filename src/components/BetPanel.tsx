'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EventSchedule {
  quali: Date;
  sprint?: Date;
  race: Date;
}

interface BetPanelProps {
  eventName: string;
  trackName: string;
  country: string; 
  trackMapUrl: string;
  schedule: EventSchedule;
  hasRaceBet: boolean;
  hasSprintBet: boolean;
  // IDs necessários para a nova estrutura de rota
  seasonId: number;
  gpId: number;
  hasSprint: boolean; // Para saber se o botão sprint deve ser habilitado
}

export const BetPanel: React.FC<BetPanelProps> = ({
  eventName,
  trackName,
  country,
  trackMapUrl,
  schedule,
  hasRaceBet,
  hasSprintBet,
  seasonId,
  gpId,
  hasSprint,
}) => {
  const router = useRouter();
  const now = new Date();

const getButtonStatus = (eventDate: Date | undefined, hasBet: boolean, isSprint: boolean) => {
    // 1. Caso não exista a sessão (ex: Sem Sprint)
    if (isSprint && !hasSprint) {
      return { text: 'SEM SPRINT', disabled: true, color: 'bg-gray-800 text-gray-500' };
    }
    if (!eventDate) return { text: 'INDISPONÍVEL', disabled: true, color: 'bg-gray-800 text-gray-500' };

    // 2. Verificação de Tempo (Lockdown 5 min antes)
    const lockTime = new Date(eventDate.getTime() - 5 * 60 * 1000);
    const isLocked = now >= lockTime;

    // 3. Se estiver trancado, o botão fica VERMELHO mas com texto de Visualizar
    if (isLocked) {
      return { 
        text: 'VISUALIZAR APOSTA', 
        disabled: false, 
        color: 'bg-[#e10600] hover:bg-[#ff0700] text-white' 
      };
    }

    // 4. Se já tem aposta e está aberto, fica BRANCO para Editar
    if (hasBet) {
      return { 
        text: 'EDITAR APOSTA', 
        disabled: false, 
        color: 'bg-white text-black hover:bg-gray-200' 
      };
    }

    // 5. Estado inicial: VERMELHO para Criar
    return { 
      text: 'CRIAR APOSTA', 
      disabled: false, 
      color: 'bg-[#e10600] hover:bg-[#ff0700] text-white' 
    };
  };

  const raceStatus = getButtonStatus(schedule.race, hasRaceBet, false);
  const sprintStatus = getButtonStatus(schedule.sprint, hasSprintBet, true);

  const formatDate = (date: Date) => {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(new Date(date));
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const tz = parts.find(p => p.type === 'timeZoneName')?.value;

    return `${day}/${month}, ${hour}:${minute} (${tz})`;
  };

  // Navegação utilizando a nova estrutura de pastas
  const handleNavigation = (type: 'race' | 'sprint') => {
    router.push(`/bet/${seasonId}/${gpId}/${type}`);
  };

  return (
    <div className="w-full max-w-4xl bg-[#1f1f27] rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-8 flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-6">
          <header className="space-y-1">
            <div className="flex items-center gap-2 text-[#e10600] mb-1">
              <Trophy size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Próximo Evento</span>
            </div>
            
            <div className="flex items-center gap-5">
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
                {eventName}
              </h2>
              <div className="flex items-center">
                <img 
                  src={`https://flagcdn.com/w640/${(country || '').toLowerCase()}.png`} 
                  alt="Flag"
                  className="h-12 w-auto rounded-sm border border-white/10 shadow-xl object-contain" 
                />
              </div>
            </div>

            <div className="text-gray-400 mt-2 uppercase tracking-widest font-bold text-[10px]">
              {trackName}
            </div>
          </header>

          <div className="grid grid-cols-1 gap-3 py-4 border-y border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-[#e10600] text-[10px] font-bold uppercase tracking-widest">Classificação</span>
              <span className="text-white font-mono text-xl font-bold">{formatDate(schedule.quali)}</span>
            </div>
            
            {hasSprint && schedule.sprint && (
              <div className="flex justify-between items-center">
                <span className="text-[#e10600] text-[10px] font-bold uppercase tracking-widest">Sprint</span>
                <span className="text-white font-mono text-xl font-bold">{formatDate(schedule.sprint)}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-[#e10600] text-[10px] font-bold uppercase tracking-widest">Corrida</span>
              <span className="text-white font-mono text-xl font-bold">{formatDate(schedule.race)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Sprint Race</span>
              <button
                onClick={() => handleNavigation('sprint')}
                disabled={sprintStatus.disabled}
                className={`w-full py-4 rounded-xl font-black italic uppercase text-sm transition-all active:scale-95 shadow-lg ${sprintStatus.color}`}
              >
                {sprintStatus.text}
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Grand Prix</span>
              <button
                onClick={() => handleNavigation('race')}
                disabled={raceStatus.disabled}
                className={`w-full py-4 rounded-xl font-black italic uppercase text-sm transition-all active:scale-95 shadow-lg ${raceStatus.color}`}
              >
                {raceStatus.text}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full md:w-72 md:pl-6 flex items-center justify-center bg-black/20 rounded-2xl p-6 border border-white/5 relative group">
          <img 
            src={trackMapUrl} 
            alt={trackName} 
            className="w-full h-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-500" 
          />
        </div>
      </div>
    </div>
  );
};