import type { RaceControlMessage } from '@/types/grid';

const FLAG_COLORS: Record<string, string> = {
  YELLOW: 'bg-yellow-500',
  DOUBLE_YELLOW: 'bg-yellow-500',
  RED: 'bg-red-600',
  GREEN: 'bg-green-500',
  BLUE: 'bg-blue-500',
  BLACK_AND_WHITE: 'bg-gray-400',
  CHEQUERED: 'bg-white',
};

const CATEGORY_COLORS: Record<string, string> = {
  SafetyCar: 'bg-orange-500',
  Drs: 'bg-green-500',
  Flag: '',
};

function dotColor(msg: RaceControlMessage): string {
  if (msg.flag && FLAG_COLORS[msg.flag]) return FLAG_COLORS[msg.flag];
  if (CATEGORY_COLORS[msg.category]) return CATEGORY_COLORS[msg.category];
  return 'bg-gray-500';
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function RaceControlFeed({ messages }: { messages: RaceControlMessage[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-xl bg-[#1f1f27] border border-white/5 overflow-hidden">
      <div className="px-4 py-2 border-b border-white/5">
        <span className="text-[10px] font-black uppercase italic tracking-widest text-gray-500">
          Race Control
        </span>
      </div>
      <div className="scrollbar-hide max-h-48 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={`${msg.date}-${msg.message}`}
            className="flex items-start gap-3 px-4 py-2.5 border-b border-white/[0.03] last:border-0"
          >
            <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor(msg)}`} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold leading-snug">{msg.message}</p>
            </div>
            <span className="text-gray-600 text-[10px] font-mono shrink-0">
              {formatTime(msg.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
