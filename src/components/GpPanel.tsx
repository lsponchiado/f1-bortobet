'use client';

import { useRouter } from 'next/navigation';
type SessionType =
  | 'PRACTICE_1'
  | 'PRACTICE_2'
  | 'PRACTICE_3'
  | 'SPRINT_QUALIFYING'
  | 'QUALIFYING'
  | 'SPRINT'
  | 'RACE';

interface SessionInfo {
  type: SessionType;
  date: Date;
  cancelled: boolean;
}

interface GpPanelProps {
  eventName: string;
  trackName: string;
  country: string;
  trackMapUrl: string;
  sessions: SessionInfo[];
  hasRaceBet: boolean;
  hasSprintBet: boolean;
  seasonId: number;
  gpId: number;
}

const SESSION_LABELS: Record<SessionType, string> = {
  PRACTICE_1: 'Treino Livre 1',
  PRACTICE_2: 'Treino Livre 2',
  PRACTICE_3: 'Treino Livre 3',
  SPRINT_QUALIFYING: 'Classificação Sprint',
  QUALIFYING: 'Classificação',
  SPRINT: 'Sprint',
  RACE: 'Corrida',
};

const SESSION_LABELS_SHORT: Record<SessionType, string> = {
  PRACTICE_1: 'TL 1',
  PRACTICE_2: 'TL 2',
  PRACTICE_3: 'TL 3',
  SPRINT_QUALIFYING: 'Spr. class.',
  QUALIFYING: 'Class.',
  SPRINT: 'Sprint',
  RACE: 'Corrida',
};

const SESSION_ORDER: SessionType[] = [
  'PRACTICE_1',
  'PRACTICE_2',
  'SPRINT_QUALIFYING',
  'PRACTICE_3',
  'QUALIFYING',
  'SPRINT',
  'RACE',
];

type ButtonStatus = {
  text: string;
  disabled: boolean;
  color: string;
};

export function GpPanel({
  eventName,
  trackName,
  country,
  trackMapUrl,
  sessions,
  hasRaceBet,
  hasSprintBet,
  seasonId,
  gpId,
}: GpPanelProps) {
  const router = useRouter();
  const now = new Date();

  const raceSession = sessions.find((s) => s.type === 'RACE');
  const sprintSession = sessions.find((s) => s.type === 'SPRINT');

  const getButtonStatus = (
    session: SessionInfo | undefined,
    hasBet: boolean,
    label: string
  ): ButtonStatus => {
    if (!session || session.cancelled) {
      return { text: `SEM ${label.toUpperCase()}`, disabled: true, color: 'bg-gray-800 text-gray-500' };
    }

    const lockTime = new Date(session.date.getTime() - 5 * 60 * 1000);
    const isLocked = now >= lockTime;

    if (isLocked) {
      if (!hasBet) return { text: 'SEM APOSTAS', disabled: true, color: 'bg-gray-800 text-gray-500' };
      return { text: 'VISUALIZAR APOSTA', disabled: false, color: 'bg-[#e10600] hover:bg-[#ff0700] text-white' };
    }
    if (hasBet) {
      return { text: 'EDITAR APOSTA', disabled: false, color: 'bg-white text-black hover:bg-gray-200' };
    }
    return { text: 'CRIAR APOSTA', disabled: false, color: 'bg-[#e10600] hover:bg-[#ff0700] text-white' };
  };

  const raceStatus = getButtonStatus(raceSession, hasRaceBet, 'CORRIDA');
  const sprintStatus = getButtonStatus(sprintSession, hasSprintBet, 'SPRINT');

  const formatDate = (date: Date) => {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(new Date(date));
    const day = parts.find((p) => p.type === 'day')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value;

    return `${day}/${month}, ${hour}:${minute}`;
  };

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="w-full bg-[#1f1f27] rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-8 space-y-6">
        {/* Header em largura total */}
        <header>
          <div className="flex items-center gap-5">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
              {eventName}
            </h2>
            <img
              src={`https://flagcdn.com/w640/${(country || '').toLowerCase()}.png`}
              alt={country}
              className="h-12 w-auto rounded-sm border border-white/10 shadow-xl object-contain flex-shrink-0"
            />
          </div>
          <div className="text-gray-400 mt-2 uppercase tracking-widest font-bold text-sm">
            {trackName}
          </div>
        </header>

        {/* Duas colunas: sessões+botões | mapa */}
        <div className="flex flex-col md:flex-row gap-14 items-end">
          <div className="flex-1 space-y-6">
            <div className="flex flex-col gap-3 py-4 border-y border-white/5">

            {sortedSessions.map((s) => {
              const past = !s.cancelled && s.date < now;
              return (
                <div key={s.type} className={`grid grid-cols-2 items-start gap-4 ${past ? 'opacity-40' : ''}`}>
                  <span className="text-[#e10600] text-xl font-black italic uppercase tracking-tight">
                    <span className="md:hidden">{SESSION_LABELS_SHORT[s.type]}</span>
                    <span className="hidden md:inline">{SESSION_LABELS[s.type]}</span>
                  </span>
                  {s.cancelled ? (
                    <div className="text-gray-500 text-xl font-black italic uppercase tracking-tight text-right">
                      Cancelada
                    </div>
                  ) : (
                    <div className={`text-white font-mono text-xl font-bold text-right ${past ? 'line-through' : ''}`}>
                      {formatDate(s.date)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 items-stretch">
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Sprint Race</span>
              <button
                onClick={() => router.push(`/bet/${seasonId}/${gpId}/sprint`)}
                disabled={sprintStatus.disabled}
                className={`w-full flex-1 py-4 rounded-xl font-black italic uppercase text-sm transition-all active:scale-95 shadow-lg ${sprintStatus.color}`}
              >
                {sprintStatus.text}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Grand Prix</span>
              <button
                onClick={() => router.push(`/bet/${seasonId}/${gpId}/race`)}
                disabled={raceStatus.disabled}
                className={`w-full flex-1 py-4 rounded-xl font-black italic uppercase text-sm transition-all active:scale-95 shadow-lg ${raceStatus.color}`}
              >
                {raceStatus.text}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block text-center">Resultados</span>
              {(() => {
                const anyPast = sessions.some((s) => !s.cancelled && new Date(s.date) < now);
                return (
                  <button
                    onClick={() => anyPast && router.push(`/results/${seasonId}/${gpId}`)}
                    disabled={!anyPast}
                    className={`w-full flex-1 py-4 rounded-xl font-black italic uppercase text-sm transition-all shadow-lg ${
                      anyPast
                        ? 'active:scale-95 bg-[#e10600] hover:bg-[#ff0700] text-white'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {anyPast ? <><span className="md:hidden">VER RESULT.</span><span className="hidden md:inline">VER RESULTADOS</span></> : <><span className="md:hidden">INDISP.</span><span className="hidden md:inline">INDISPONÍVEL</span></>}
                  </button>
                );
              })()}
            </div>
          </div>
          </div>

          {/* Map: desktop only, right column */}
          <div className="hidden md:flex w-80 aspect-square items-center justify-center bg-black/20 rounded-2xl p-6 border border-white/5 relative group flex-shrink-0">
            <img
              src={trackMapUrl}
              alt={trackName}
              className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
