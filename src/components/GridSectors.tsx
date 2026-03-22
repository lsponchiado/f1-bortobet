import { BADGE_LARGE, BADGE_LARGE_COL, BADGE_LARGE_PAD } from './grid-constants';

interface SectorData {
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

function formatSector(val: number | null): string {
  if (val == null) return '--';
  return val.toFixed(1);
}

export function GridSectors({ sectors, bestSectors }: { sectors?: SectorData; bestSectors?: SectorData }) {
  const s = sectors ?? { s1: null, s2: null, s3: null };
  const best = bestSectors ?? { s1: null, s2: null, s3: null };

  return (
    <div className="flex shrink-0 items-center gap-px rounded-sm bg-gray-800" style={{ ...BADGE_LARGE, paddingLeft: BADGE_LARGE_PAD, paddingRight: BADGE_LARGE_PAD }}>
      {(['s1', 's2', 's3'] as const).map((key, i) => {
        const isBest = s[key] != null && best[key] != null && Math.abs(s[key]! - best[key]!) < 0.001;
        return (
          <div key={key} className="flex flex-col items-center justify-center gap-0.5" style={{ width: BADGE_LARGE_COL }}>
            <span className="text-gray-500 text-[8px] font-black leading-none">S{i + 1}</span>
            <span className={`font-bold text-[10px] leading-tight tabular-nums ${isBest ? 'text-purple-400' : 'text-white'}`}>
              {formatSector(s[key])}
            </span>
          </div>
        );
      })}
    </div>
  );
}
