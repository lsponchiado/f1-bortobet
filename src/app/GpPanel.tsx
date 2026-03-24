import { SESSION_LABELS, SESSION_LABELS_SHORT, type SessionType } from '@/lib/constants';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDate(date: Date) {
  const parts = dateFormatter.formatToParts(new Date(date));
  const day = parts.find((p) => p.type === 'day')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  return `${day}/${month}, ${hour}:${minute}`;
}

interface SessionInfo {
  type: SessionType;
  date: Date;
  cancelled: boolean;
}

interface GpPanelProps {
  eventName: string;
  trackName: string;
  trackMapUrl: string;
  sessions: SessionInfo[];
  heading?: string;
}

export function GpPanel({
  eventName,
  trackName,
  trackMapUrl,
  sessions,
  heading,
}: GpPanelProps) {
  const now = new Date();

  return (
    <div className="w-full bg-[#1f1f27] rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 p-8 space-y-6">
          <header>
            {heading && (
              <p className="text-gray-500 text-lg font-black italic uppercase tracking-tighter mb-1 -mt-2">{heading}{'\u00A0\u00A0\u00A0'} · {'\u00A0\u00A0\u00A0'}{trackName}</p>
            )}
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white leading-none">
              {eventName}
            </h2>
          </header>

          <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
            {sessions.map((s) => {
              const past = !s.cancelled && new Date(s.date) < now;

              return (
                <div key={s.type} className={`grid grid-cols-2 items-center gap-4 ${past ? 'opacity-40' : ''}`}>
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
        </div>

        {/* Map: desktop only, stretches full height */}
        <div className="hidden md:flex w-80 items-center justify-center bg-black/20 p-6 border-l border-white/5 group flex-shrink-0">
          <img
            src={trackMapUrl}
            alt={trackName}
            className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-500"
          />
        </div>
      </div>
    </div>
  );
}
