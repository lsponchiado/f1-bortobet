import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';

// ─── Public types ────────────────────────────────────────────────────────────

export interface ScoringFilters {
  seasonId: number;
  gpId?: number;       // restrict to one GP
  userIds?: number[];  // restrict to specific users (undefined = all)
  skip?: number;       // pagination offset (applied after sort)
  take?: number;       // page size (undefined = all)
}

export interface GpBreakdown {
  gpId: number;
  gpName: string;
  racePoints: number;
  sprintPoints: number;
  totalPoints: number;
}

export interface UserScore {
  userId: number;
  username: string;
  totalPoints: number;
  byGp: GpBreakdown[];
}

export interface ScoringResult {
  scores: UserScore[];
  total: number; // count before pagination
}

// ─── Internal helpers ────────────────────────────────────────────────────────

interface PointConfig {
  race: Record<number, number>;
  sprint: Record<number, number>;
  hailMary: number;
  underdog: number;
  freefall: number;
  fastestLap: number;
  safetyCar: number;
  dnf: number;
}

const DEFAULT_CONFIG: PointConfig = {
  race:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
  sprint: { 1: 8,  2: 7,  3: 6,  4: 5,  5: 4,  6: 3, 7: 2, 8: 1 },
  hailMary: 25, underdog: 10, freefall: 5,
  fastestLap: 10, safetyCar: 10, dnf: 10,
};

interface EntryData {
  startPosition: number;
  finishPosition: number;
  dnf: boolean;
  fastestLap: boolean;
}

// ─── Main function ────────────────────────────────────────────────────────────

async function _calculateScores(filters: ScoringFilters): Promise<ScoringResult> {
  const { seasonId, gpId, userIds, skip = 0, take } = filters;

  // 1. Season + config
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { config: true },
  });
  if (!season) return { scores: [], total: 0 };

  const cfg = season.config;
  const pts: PointConfig = cfg
    ? {
        race: {
          1: cfg.ptsP1,  2: cfg.ptsP2,  3: cfg.ptsP3,  4: cfg.ptsP4,  5: cfg.ptsP5,
          6: cfg.ptsP6,  7: cfg.ptsP7,  8: cfg.ptsP8,  9: cfg.ptsP9,  10: cfg.ptsP10,
        },
        sprint: {
          1: cfg.sprintPtsP1, 2: cfg.sprintPtsP2, 3: cfg.sprintPtsP3, 4: cfg.sprintPtsP4,
          5: cfg.sprintPtsP5, 6: cfg.sprintPtsP6, 7: cfg.sprintPtsP7, 8: cfg.sprintPtsP8,
        },
        hailMary:  cfg.ptsHailMary,
        underdog:  cfg.ptsUnderdog,
        freefall:  cfg.ptsFreefall,
        fastestLap: cfg.ptsFastestLap,
        safetyCar: cfg.ptsSafetyCar,
        dnf:       cfg.ptsDNF,
      }
    : DEFAULT_CONFIG;

  // 2. Sessions (RACE + SPRINT only)
  const sessions = await prisma.session.findMany({
    where: {
      seasonId,
      ...(gpId ? { grandPrixId: gpId } : {}),
      type: { in: ['RACE', 'SPRINT'] },
      cancelled: false,
    },
    include: { raceConfig: true, grandPrix: true },
  });

  if (sessions.length === 0) return { scores: [], total: 0 };

  const raceSessionIds   = sessions.filter(s => s.type === 'RACE').map(s => s.id);
  const sprintSessionIds = sessions.filter(s => s.type === 'SPRINT').map(s => s.id);
  const allSessionIds    = sessions.map(s => s.id);
  const sessionMap       = new Map(sessions.map(s => [s.id, s]));

  // 3. Session entries
  const rawEntries = await prisma.sessionEntry.findMany({
    where: { sessionId: { in: allSessionIds } },
    select: { sessionId: true, driverId: true, startPosition: true, finishPosition: true, dnf: true, fastestLap: true },
  });

  const entryMap = new Map<string, EntryData>();
  const dnfCountBySession = new Map<number, number>();

  for (const e of rawEntries) {
    entryMap.set(`${e.sessionId}:${e.driverId}`, e);
    if (e.dnf) dnfCountBySession.set(e.sessionId, (dnfCountBySession.get(e.sessionId) ?? 0) + 1);
  }

  // 4. Bets (filtered by userIds if provided)
  const userFilter = userIds ? { userId: { in: userIds } } : {};

  const [betRaces, betSprints] = await Promise.all([
    raceSessionIds.length
      ? prisma.betRace.findMany({
          where: { sessionId: { in: raceSessionIds }, ...userFilter },
          select: {
            userId: true, sessionId: true,
            doublePoints: true,
            predictedSC: true, predictedDNF: true,
            predictedGrid: { select: { driverId: true, predictedPosition: true, fastestLap: true } },
          },
        })
      : Promise.resolve([]),
    sprintSessionIds.length
      ? prisma.betSprint.findMany({
          where: { sessionId: { in: sprintSessionIds }, ...userFilter },
          select: {
            userId: true, sessionId: true,
            predictedGrid: { select: { driverId: true, predictedPosition: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // 5. Accumulate points per user per GP
  type GpAcc = { gpId: number; gpName: string; racePoints: number; sprintPoints: number };
  const userGpMap = new Map<number, Map<number, GpAcc>>();

  const getGpAcc = (userId: number, gpId: number, gpName: string): GpAcc => {
    if (!userGpMap.has(userId)) userGpMap.set(userId, new Map());
    const m = userGpMap.get(userId)!;
    if (!m.has(gpId)) m.set(gpId, { gpId, gpName, racePoints: 0, sprintPoints: 0 });
    return m.get(gpId)!;
  };

  // ── Race bets ──
  for (const bet of betRaces) {
    const sess = sessionMap.get(bet.sessionId);
    if (!sess) continue;
    const rc  = sess.raceConfig;
    const gp  = getGpAcc(bet.userId, sess.grandPrixId, sess.grandPrix.name);
    let   pts_ = 0;

    let hailMaryUsed = 0;
    let underdogUsed = 0;

    for (const item of bet.predictedGrid) {
      const entry = entryMap.get(`${bet.sessionId}:${item.driverId}`);
      if (!entry) continue;

      // Basic position points (exact match only)
      if (entry.finishPosition === item.predictedPosition) {
        pts_ += pts.race[entry.finishPosition] ?? 0;
      }

      // Fastest Lap
      if (rc?.allowFastestLap !== false && item.fastestLap && entry.fastestLap) {
        pts_ += pts.fastestLap;
      }

      // Hail Mary: predicted top 5 + started P20+ + actually finished top 5 (max 1)
      if (
        rc?.allowHailMary !== false &&
        hailMaryUsed < 1 &&
        item.predictedPosition <= 5 &&
        entry.startPosition >= 20 &&
        entry.finishPosition <= 5
      ) {
        pts_ += pts.hailMary;
        hailMaryUsed++;
      }

      // Underdog: predicted top 3 + climbed 10+ places + actually top 3 (max 3)
      if (
        rc?.allowUnderdog !== false &&
        underdogUsed < 3 &&
        item.predictedPosition <= 3 &&
        (entry.startPosition - entry.finishPosition) >= 10 &&
        entry.finishPosition <= 3
      ) {
        pts_ += pts.underdog;
        underdogUsed++;
      }

      // Freefall: predicted to drop 5+ AND actually dropped 5+ from start
      if (
        rc?.allowFreefall !== false &&
        (item.predictedPosition - entry.startPosition) >= 5 &&
        (entry.finishPosition  - entry.startPosition) >= 5
      ) {
        pts_ += pts.freefall;
      }
    }

    // Safety Car (SC + VSC combined; predicted=3 significa "3 ou mais")
    if (rc?.allowSafetyCar !== false) {
      const actual = sess.scCount + sess.vscCount;
      const scMatch = bet.predictedSC >= 3 ? actual >= 3 : bet.predictedSC === actual;
      if (scMatch) pts_ += pts.safetyCar;
    }

    // DNF count (predicted=3 significa "3 ou mais")
    if (rc?.allowDNF !== false) {
      const actual = dnfCountBySession.get(bet.sessionId) ?? 0;
      const dnfMatch = bet.predictedDNF >= 3 ? actual >= 3 : bet.predictedDNF === actual;
      if (dnfMatch) pts_ += pts.dnf;
    }

    // Double Points (doubles the entire race total for this round)
    if (rc?.allowDoublePoints !== false && bet.doublePoints) {
      pts_ *= 2;
    }

    gp.racePoints += pts_;
  }

  // ── Sprint bets ──
  for (const bet of betSprints) {
    const sess = sessionMap.get(bet.sessionId);
    if (!sess) continue;
    const gp = getGpAcc(bet.userId, sess.grandPrixId, sess.grandPrix.name);
    let pts_ = 0;

    for (const item of bet.predictedGrid) {
      const entry = entryMap.get(`${bet.sessionId}:${item.driverId}`);
      if (!entry) continue;
      if (entry.finishPosition === item.predictedPosition) {
        pts_ += pts.sprint[entry.finishPosition] ?? 0;
      }
    }

    gp.sprintPoints += pts_;
  }

  // 6. Build final list
  const allUserIds = [...userGpMap.keys()];
  if (allUserIds.length === 0) return { scores: [], total: 0 };

  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true, username: true, name: true },
  });
  const nameMap = new Map(users.map(u => [u.id, u.username || u.name || `User ${u.id}`]));

  const scores: UserScore[] = allUserIds.map(userId => {
    const byGp = [...userGpMap.get(userId)!.values()].map(g => ({
      ...g,
      totalPoints: g.racePoints + g.sprintPoints,
    }));
    return {
      userId,
      username: nameMap.get(userId) ?? `User ${userId}`,
      totalPoints: byGp.reduce((s, g) => s + g.totalPoints, 0),
      byGp,
    };
  });

  scores.sort((a, b) => b.totalPoints - a.totalPoints);

  const total = scores.length;
  const paginated = take !== undefined ? scores.slice(skip, skip + take) : scores.slice(skip);

  return { scores: paginated, total };
}

// Cache por combinação de filtros — invalida quando resultados são atualizados
// via revalidateTag('scores') nas server actions que salvam SessionEntry
export const calculateScores = unstable_cache(
  _calculateScores,
  ['scores'],
  { tags: ['scores'], revalidate: 60 }
);
