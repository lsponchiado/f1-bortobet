import type { PitStop } from '@/types/grid';
import { BADGE_LARGE, BADGE_LARGE_COL, BADGE_LARGE_PAD, MIN_SCROLL_SLOTS, getScrollMargins } from './grid-constants';

export function GridPitStops({ pitStops }: { pitStops?: PitStop[] }) {
  const stops = pitStops ?? [];
  const slots = Math.max(MIN_SCROLL_SLOTS, stops.length);

  return (
    <div
      className="scrollbar-hide flex shrink-0 items-center gap-px rounded-sm bg-gray-800"
      style={{
        ...BADGE_LARGE,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        scrollPaddingInlineStart: BADGE_LARGE_PAD,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {Array.from({ length: slots }, (_, i) => {
        const margin = getScrollMargins(i, slots, BADGE_LARGE_PAD);

        if (i < stops.length) {
          const stop = stops[i];
          return (
            <div
              key={i}
              className="flex shrink-0 flex-col items-center justify-center gap-0.5"
              style={{ width: BADGE_LARGE_COL, scrollSnapAlign: 'start', ...margin }}
            >
              <span className="text-gray-500 text-[8px] font-black leading-none">L{stop.lap}</span>
              <span className="text-white font-bold text-[10px] leading-tight tabular-nums">
                {stop.duration != null ? stop.duration.toFixed(1) : '--'}
              </span>
            </div>
          );
        }
        return (
          <div
            key={i}
            className="flex shrink-0 flex-col items-center justify-center gap-0.5"
            style={{ width: BADGE_LARGE_COL, scrollSnapAlign: 'start', ...margin }}
          >
            <span className="text-gray-700 text-[10px] font-bold">--</span>
          </div>
        );
      })}
    </div>
  );
}
