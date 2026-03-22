const COMPOUND_COLORS: Record<string, { bg: string; text: string }> = {
  SOFT: { bg: '#e10600', text: '#fff' },
  MEDIUM: { bg: '#f5c518', text: '#000' },
  HARD: { bg: '#f0f0f0', text: '#000' },
  INTERMEDIATE: { bg: '#43b02a', text: '#fff' },
  WET: { bg: '#0072c6', text: '#fff' },
};

const MIN_SLOTS = 3;

function parseStint(stint: string): { compound: string; laps: number | null } {
  const parts = stint.split(':');
  const compound = parts[0];
  const laps = parts[1] ? parseInt(parts[1]) : null;
  return { compound, laps: laps && !isNaN(laps) ? laps : null };
}

export function GridTires({ tireStints }: { tireStints?: string[] }) {
  const stints = tireStints ?? [];
  const slots = Math.max(MIN_SLOTS, stints.length);

  // circle 28px, gap 4px, pad 8px each side
  // width = 8 + 28 + 4 + 28 + 4 + 28 + 8 = 108
  return (
    <div
      className="scrollbar-hide flex shrink-0 items-center gap-1 rounded-sm bg-gray-800"
      style={{
        width: 108,
        height: 64,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        scrollPaddingInlineStart: 8,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {Array.from({ length: slots }, (_, i) => {
        const isFirst = i === 0;
        const isLast = i === slots - 1;
        const margin = {
          ...(isFirst && { marginLeft: 8 }),
          ...(isLast && { marginRight: 8 }),
        };

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
