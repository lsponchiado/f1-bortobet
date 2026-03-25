import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ── Active Season (changes ~1x/year) ────────────────────────────────────────

export const getActiveSeason = unstable_cache(
  () => prisma.season.findFirst({ where: { isActive: true } }),
  ['active-season'],
  { tags: ['season'] }
);

export const getActiveSeasonWithConfig = unstable_cache(
  () => prisma.season.findFirst({ where: { isActive: true }, include: { config: true } }),
  ['active-season-config'],
  { tags: ['season'] }
);

// ── Drivers (changes rarely) ─────────────────────────────────────────────────

export const getActiveDrivers = unstable_cache(
  () => prisma.driver.findMany({
    where: { enabled: true },
    orderBy: { teamId: 'asc' },
    include: { team: true },
  }),
  ['active-drivers'],
  { tags: ['drivers'] }
);

// ── GP lists (changes when admin syncs/cancels) ──────────────────────────────

export const getGpsForSeason = unstable_cache(
  async (seasonId: number) => {
    const raw = await prisma.grandPrix.findMany({
      where: { sessions: { some: { seasonId } } },
      select: {
        id: true,
        name: true,
        country: true,
        sessions: {
          where: { seasonId },
          orderBy: { date: 'asc' },
          take: 1,
          select: { date: true },
        },
      },
    });
    raw.sort((a, b) => (a.sessions[0]?.date.getTime() ?? 0) - (b.sessions[0]?.date.getTime() ?? 0));
    return raw.map(g => ({ id: g.id, name: g.name, country: g.country }));
  },
  ['gps-for-season'],
  { tags: ['gps'] }
);

export const getGpsWithResults = unstable_cache(
  async (seasonId: number) => {
    const raw = await prisma.grandPrix.findMany({
      where: {
        sessions: { some: { seasonId, entries: { some: {} } } },
      },
      select: {
        id: true,
        name: true,
        country: true,
        sessions: {
          where: { seasonId },
          orderBy: { date: 'asc' },
          take: 1,
          select: { date: true },
        },
      },
    });
    raw.sort((a, b) => (a.sessions[0]?.date.getTime() ?? 0) - (b.sessions[0]?.date.getTime() ?? 0));
    return raw.map(g => ({ id: g.id, name: g.name, country: g.country }));
  },
  ['gps-with-results'],
  { tags: ['gps', 'results'] }
);

// ── Session results (changes when admin syncs results) ───────────────────────

export const getSessionsWithEntries = unstable_cache(
  async (gpId: number, seasonId: number) => {
    const sessions = await prisma.session.findMany({
      where: { grandPrixId: gpId, seasonId },
      include: {
        entries: {
          include: { driver: { include: { team: true } } },
          orderBy: { finishPosition: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });
    return sessions.map(s => ({
      id: s.id,
      type: s.type as string,
      date: s.date.toISOString(),
      cancelled: s.cancelled,
      scCount: s.scCount,
      vscCount: s.vscCount,
      entries: s.entries.map(e => ({
        startPosition: e.startPosition,
        finishPosition: e.finishPosition,
        dns: e.dns,
        dnf: e.dnf,
        dsq: e.dsq,
        fastestLap: e.fastestLap,
        bestLapTime: e.bestLapTime,
        gapToLeader: e.gapToLeader,
        interval: e.interval,
        tireStints: e.tireStints,
        driver: {
          id: e.driver.id,
          lastName: e.driver.lastName,
          code: e.driver.code,
          number: e.driver.number,
          headshotUrl: e.driver.headshotUrl,
          team: {
            name: e.driver.team.name,
            color: e.driver.team.color,
            logoUrl: e.driver.team.logoUrl,
          },
        },
      })),
    }));
  },
  ['sessions-with-entries'],
  { tags: ['results'] }
);

// ── Ranking scores (changes when results sync or bets are scored) ────────────

export const getRankingScores = unstable_cache(
  async (seasonId: number) => {
    const raw = await prisma.$queryRaw<Array<{
      userId: number; username: string; name: string; category: string;
      grandPrixId: number; grandPrixName: string; sessionId: number;
      sessionType: string; points: number; totalPoints: number;
    }>>`
      SELECT "userId", username, name, category, "grandPrixId", "grandPrixName", "sessionId", "sessionType", points, "totalPoints"
      FROM user_scores_view
      WHERE "seasonId" = ${seasonId}
    `;
    return raw.map(s => ({ ...s, points: Number(s.points), totalPoints: Number(s.totalPoints) }));
  },
  ['ranking-scores'],
  { tags: ['ranking'] }
);

export const getRankingEarnings = unstable_cache(
  async (seasonId: number) => {
    const raw = await prisma.$queryRaw<Array<{
      userId: number; grandPrixId: number; gpEarning: number; seasonEarning: number; totalEarning: number;
    }>>`
      SELECT "userId", "grandPrixId", "gpEarning", "seasonEarning", "totalEarning"
      FROM user_earnings_view
      WHERE "seasonId" = ${seasonId}
    `;
    return raw.map(e => ({
      userId: Number(e.userId),
      grandPrixId: Number(e.grandPrixId),
      gpEarning: Number(e.gpEarning),
      seasonEarning: Number(e.seasonEarning),
      totalEarning: Number(e.totalEarning),
    }));
  },
  ['ranking-earnings'],
  { tags: ['ranking'] }
);

export const getRankingGpOptions = unstable_cache(
  async (seasonId: number) => {
    const [gpOptionsRaw, gpSessionDates] = await Promise.all([
      prisma.$queryRaw<{ id: number; name: string }[]>`
        SELECT DISTINCT ON (gp.id) gp.id, gp.name
        FROM "GrandPrix" gp
        JOIN "Session" s ON s."grandPrixId" = gp.id
        JOIN "SessionEntry" se ON se."sessionId" = s.id
        WHERE s."seasonId" = ${seasonId}
          AND NOT gp.cancelled
        ORDER BY gp.id, s.date ASC
      `,
      prisma.$queryRaw<{ id: number; minDate: Date }[]>`
        SELECT gp.id, MIN(s.date) AS "minDate"
        FROM "GrandPrix" gp
        JOIN "Session" s ON s."grandPrixId" = gp.id
        WHERE s."seasonId" = ${seasonId}
        GROUP BY gp.id
        ORDER BY "minDate" ASC
      `,
    ]);
    const gpOrder = new Map(gpSessionDates.map((g, i) => [Number(g.id), i]));
    return gpOptionsRaw
      .map(g => ({ id: Number(g.id), name: g.name }))
      .sort((a, b) => (gpOrder.get(a.id) ?? 0) - (gpOrder.get(b.id) ?? 0));
  },
  ['ranking-gp-options'],
  { tags: ['ranking', 'gps'] }
);
