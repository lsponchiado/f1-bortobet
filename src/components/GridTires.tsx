import { BADGE_LARGE, BADGE_LARGE_PAD, MIN_SCROLL_SLOTS, getScrollMargins } from './grid-constants';

const COMPOUND_COLORS: Record<string, { bg: string; text: string }> = {
  SOFT: { bg: '#e10600', text: '#fff' },
  MEDIUM: { bg: '#f5c518', text: '#000' },
  HARD: { bg: '#f0f0f0', text: '#000' },
  INTERMEDIATE: { bg: '#43b02a', text: '#fff' },
  WET: { bg: '#0072c6', text: '#fff' },
};

function parseStint(stint: string): { compound: string; laps: number | null } {
  const parts = stint.split(':');
  const compound = parts[0];
  const laps = parts[1] ? parseInt(parts[1]) : null;
  return { compound, laps: laps && !isNaN(laps) ? laps : null };
}

export function GridTires({ tireStints }: { tireStints?: string[] }) {
  const stints = tireStints ?? [];
  const slots = Math.max(MIN_SCROLL_SLOTS, stints.length);

  return (
    <div
      className="scrollbar-hide flex shrink-0 items-center gap-1 rounded-sm bg-gray-800"
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

        if (i < stints.length) {
          const { compound, laps } = parseStint(stints[i]);
          const cfg = COMPOUND_COLORS[compound] || COMPOUND_COLORS.HARD;
          return (
            <div
              key={i}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black leading-none"
              style={{ backgroundColor: cfg.bg, color: cfg.text, scrollSnapAlign: 'start', ...margin }}
            >
              {laps ?? compound.charAt(0)}
            </div>
          );
        }
        return (
          <div
            key={i}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-700"
            style={{ scrollSnapAlign: 'start', ...margin }}
          />
        );
      })}
    </div>
  );
}
