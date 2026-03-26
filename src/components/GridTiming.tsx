import { BADGE_SMALL } from './grid-constants';

interface TimingData {
  gapToLeader: number | null;
  interval: number | null;
  bestLapTime: number | null;
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  }
  return secs.toFixed(3);
}

function formatGap(seconds: number): string {
  if (seconds >= 120) {
    const laps = Math.floor(seconds / 60);
    return `+${laps} LAP${laps > 1 ? 'S' : ''}`;
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `+${mins}:${secs.toFixed(1).padStart(4, '0')}`;
  }
  return `+${seconds.toFixed(3)}`;
}

export function GridTiming({ timing, position, leaderLapTime }: { timing?: TimingData; position: number; leaderLapTime?: number }) {
  if (!timing) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-sm bg-gray-800" style={BADGE_SMALL}>
        <span className="text-gray-600 text-[10px] font-bold">--</span>
      </div>
    );
  }

  const isLeader = position === 1;
  const hasGaps = timing.gapToLeader != null || timing.interval != null;

  let topLine = '';
  let bottomLine = '';

  if (hasGaps) {
    // Corrida/Sprint: gap ao líder + intervalo
    if (isLeader && timing.bestLapTime) {
      topLine = formatLapTime(timing.bestLapTime);
      bottomLine = 'LEADER';
    } else {
      topLine = timing.gapToLeader != null ? formatGap(timing.gapToLeader) : '--';
      bottomLine = timing.interval != null ? formatGap(timing.interval) : '--';
    }
  } else if (timing.bestLapTime) {
    // Practice/Qualifying: tempo de volta + gap ao melhor
    topLine = formatLapTime(timing.bestLapTime);
    if (isLeader) {
      bottomLine = 'BEST';
    } else if (leaderLapTime) {
      bottomLine = formatGap(timing.bestLapTime - leaderLapTime);
    }
  } else {
    topLine = '--';
  }

  return (
    <div className="flex shrink-0 flex-col items-center justify-center rounded-sm bg-gray-800 px-1" style={BADGE_SMALL}>
      <span className="text-white font-bold text-[11px] leading-tight tracking-tight">
        {topLine}
      </span>
      <span className="text-gray-500 font-bold text-[10px] leading-tight tracking-tight">
        {bottomLine}
      </span>
    </div>
  );
}
