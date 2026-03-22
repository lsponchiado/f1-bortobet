// Shared dimension constants for grid badge components
// Stints, Sectors, PitStops share the same size
export const BADGE_LARGE = { width: 104, height: 64 };
export const BADGE_LARGE_COL = 30;
export const BADGE_LARGE_PAD = 6;

// Delta, Speed, Timing share the same size
export const BADGE_SMALL = { width: 80, height: 64 };

export const MIN_SCROLL_SLOTS = 3;

export function getScrollMargins(index: number, total: number, pad: number) {
  return {
    ...(index === 0 && { marginLeft: pad }),
    ...(index === total - 1 && { marginRight: pad }),
  };
}
