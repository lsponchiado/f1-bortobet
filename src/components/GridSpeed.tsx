import { BADGE_SMALL } from './grid-constants';

export function GridSpeed({ speed, drsOn }: { speed?: number | null; drsOn?: boolean }) {
  return (
    <div className={`flex shrink-0 flex-col items-center justify-center rounded-sm transition-colors ${drsOn ? 'bg-green-600' : 'bg-gray-800'}`} style={BADGE_SMALL}>
      <span className="text-white font-black text-sm leading-tight tabular-nums">
        {speed != null ? Math.round(speed) : '--'}
      </span>
      <span className={`text-[8px] font-bold leading-none ${drsOn ? 'text-white/80' : 'text-gray-500'}`}>
        km/h
      </span>
    </div>
  );
}
