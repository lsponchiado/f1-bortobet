'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { BetGridItem, UserBetData } from '@/lib/constants';
export type { BetGridItem, UserBetData } from '@/lib/constants';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');
}

// ── Config actions ────────────────────────────────────────────────────────────

export async function getConfigData() {
  await requireAdmin();

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: { config: true },
  });

  const raceSessions = await prisma.session.findMany({
    where: { type: 'RACE', seasonId: season?.id },
    include: { raceConfig: true, grandPrix: true },
    orderBy: { round: 'asc' },
  });

  return { season, raceSessions };
}

export type SeasonConfigInput = {
  ptsP1: number; ptsP2: number; ptsP3: number; ptsP4: number; ptsP5: number;
  ptsP6: number; ptsP7: number; ptsP8: number; ptsP9: number; ptsP10: number;
  ptsHailMary: number; ptsUnderdog: number; ptsFreefall: number;
  ptsFastestLap: number; ptsSafetyCar: number; ptsDNF: number;
  sprintPtsP1: number; sprintPtsP2: number; sprintPtsP3: number; sprintPtsP4: number;
  sprintPtsP5: number; sprintPtsP6: number; sprintPtsP7: number; sprintPtsP8: number;
  doublePointsTokens: number;
  // Prêmios STROLL
  potStroll: number;
  pctGps: number; pctFinal: number;
  gpPctP1: number; gpPctP2: number; gpPctP3: number;
  finalPctP1: number; finalPctP2: number; finalPctP3: number; finalPctP4: number; finalPctP5: number;
};

function validateSeasonConfig(data: SeasonConfigInput): string | null {
  const allValues = Object.values(data);
  if (allValues.some(v => typeof v !== 'number' || isNaN(v))) return 'Todos os campos devem ser números válidos';
  if (allValues.some(v => v < 0)) return 'Nenhum valor pode ser negativo';

  const gpPctSum = data.gpPctP1 + data.gpPctP2 + data.gpPctP3;
  if (gpPctSum !== 100) return `Distribuição GP deve somar 100% (atual: ${gpPctSum}%)`;

  const finalPctSum = data.finalPctP1 + data.finalPctP2 + data.finalPctP3 + data.finalPctP4 + data.finalPctP5;
  if (finalPctSum !== 100) return `Distribuição Final deve somar 100% (atual: ${finalPctSum}%)`;

  const potPctSum = data.pctGps + data.pctFinal;
  if (potPctSum !== 100) return `% GPs + % Final deve somar 100% (atual: ${potPctSum}%)`;

  return null;
}

export async function saveSeasonConfig(data: SeasonConfigInput) {
  await requireAdmin();

  const error = validateSeasonConfig(data);
  if (error) return { success: false, error };

  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) return { success: false, error: 'Temporada ativa não encontrada' };

  await prisma.seasonConfig.upsert({
    where: { seasonId: season.id },
    create: { seasonId: season.id, ...data },
    update: data,
  });

  revalidateTag('season', { expire: 0 });
  revalidateTag('ranking', { expire: 0 });
  return { success: true };
}

export type RaceConfigInput = {
  allowHailMary: boolean; allowUnderdog: boolean; allowFreefall: boolean;
  allowFastestLap: boolean; allowSafetyCar: boolean;
  allowDNF: boolean; allowDoublePoints: boolean;
};

export async function saveRaceConfig(sessionId: number, data: RaceConfigInput) {
  await requireAdmin();

  await prisma.raceConfig.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });

  revalidateTag('gps', { expire: 0 });
  return { success: true };
}

// ── Ranking: bet details ─────────────────────────────────────────────────────

export async function getUserBetForGp(userId: number, grandPrixId: number): Promise<UserBetData> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const callerId = parseInt(session.user.id, 10);
  const isAdmin = session.user.role === 'ADMIN';

  // Só permite ver apostas alheias se a sessão já começou (ou se é admin)
  const now = new Date();
  const isSelf = callerId === userId;

  const sessions = await prisma.session.findMany({
    where: {
      grandPrixId,
      type: { in: ['RACE', 'SPRINT'] },
      ...(!isSelf && !isAdmin ? { date: { lte: now } } : {}),
    },
    select: { id: true, type: true },
  });

  const raceSessionIds = sessions.filter(s => s.type === 'RACE').map(s => s.id);
  const sprintSessionIds = sessions.filter(s => s.type === 'SPRINT').map(s => s.id);

  let race: UserBetData['race'] = null;
  if (raceSessionIds.length > 0) {
    const bet = await prisma.betRace.findFirst({
      where: { userId, sessionId: { in: raceSessionIds } },
      include: {
        predictedGrid: { include: { driver: { include: { team: true } } }, orderBy: { predictedPosition: 'asc' } },
        result: true,
      },
    });
    if (bet) {
      race = {
        grid: bet.predictedGrid.map(g => ({
          position: g.predictedPosition,
          driverId: g.driver.id,
          lastName: g.driver.lastName,
          code: g.driver.code,
          number: g.driver.number,
          headshotUrl: g.driver.headshotUrl,
          team: { name: g.driver.team.name, color: g.driver.team.color, logoUrl: g.driver.team.logoUrl },
          fastestLap: g.fastestLap,
        })),
        predictedSC: bet.predictedSC,
        predictedDNF: bet.predictedDNF,
        doublePoints: bet.doublePoints,
        result: bet.result ? {
          somaPos: bet.result.somaPos,
          hailMary: bet.result.hailMary,
          underdog: bet.result.underdog,
          freefall: bet.result.freefall,
          fastestLap: bet.result.fastestLap,
          safetyCar: bet.result.safetyCar,
          abandonos: bet.result.abandonos,
          somaTotal: bet.result.somaTotal,
        } : null,
      };
    }
  }

  let sprint: UserBetData['sprint'] = null;
  if (sprintSessionIds.length > 0) {
    const bet = await prisma.betSprint.findFirst({
      where: { userId, sessionId: { in: sprintSessionIds } },
      include: {
        predictedGrid: { include: { driver: { include: { team: true } } }, orderBy: { predictedPosition: 'asc' } },
        result: true,
      },
    });
    if (bet) {
      sprint = {
        grid: bet.predictedGrid.map(g => ({
          position: g.predictedPosition,
          driverId: g.driver.id,
          lastName: g.driver.lastName,
          code: g.driver.code,
          number: g.driver.number,
          headshotUrl: g.driver.headshotUrl,
          team: { name: g.driver.team.name, color: g.driver.team.color, logoUrl: g.driver.team.logoUrl },
          fastestLap: false,
        })),
        result: bet.result ? {
          somaPos: bet.result.somaPos,
          somaTotal: bet.result.somaTotal,
        } : null,
      };
    }
  }

  return { race, sprint };
}

export async function toggleGpCancelled(grandPrixId: number, cancelled: boolean) {
  await requireAdmin();

  await prisma.grandPrix.update({
    where: { id: grandPrixId },
    data: { cancelled },
  });

  revalidateTag('gps', { expire: 0 });
  return { success: true };
}

export async function generateInviteCode(category: 'HAAS' | 'STROLL'): Promise<{ success: boolean; code?: string; error?: string }> {
  await requireAdmin();

  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    try {
      await prisma.inviteCode.create({ data: { code, category, used: false } });
      return { success: true, code };
    } catch {
      continue;
    }
  }

  return { success: false, error: 'Não foi possível gerar um código único' };
}

// ── Re-sync de resultados via MongoDB (OpenF1 local) ─────────────────────────

import { MongoClient } from 'mongodb';

let _mongoDb: import('mongodb').Db | null = null;
async function getMongoDB() {
  if (_mongoDb) return _mongoDb;
  const uri = process.env.OPENF1_MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.OPENF1_MONGO_DB || 'openf1-livetiming';
  const client = new MongoClient(uri);
  await client.connect();
  _mongoDb = client.db(dbName);
  return _mongoDb;
}

function parseGap(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val === 'LAP' || val === '') return null;
    const parsed = parseFloat(val.replace('+', ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function syncSessionFromMongo(sessionId: number, openf1Key: number): Promise<'synced' | 'no_data' | 'error'> {
  try {
    const db = await getMongoDB();

    // Dados consolidados
    const results = await db.collection('session_result')
      .find({ session_key: openf1Key }).toArray();

    if (results.length === 0) return 'no_data';

    // Starting grid
    const startingGrid = await db.collection('starting_grid')
      .find({ session_key: openf1Key }).toArray();

    const startPositionMap = new Map<number, number>();
    for (const g of startingGrid) {
      if (g.driver_number && g.position) startPositionMap.set(g.driver_number, g.position);
    }

    // Fastest lap
    const laps = await db.collection('laps')
      .find({ session_key: openf1Key, lap_duration: { $ne: null } }).toArray();

    const bestLapMap = new Map<number, number>();
    for (const l of laps) {
      if (!l.driver_number || !l.lap_duration) continue;
      const current = bestLapMap.get(l.driver_number);
      if (!current || l.lap_duration < current) bestLapMap.set(l.driver_number, l.lap_duration);
    }
    const sortedLaps = [...laps].sort((a, b) => (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity));
    const fastestLapDriverNum = sortedLaps[0]?.driver_number || null;

    // Safety cars
    const raceControlMsgs = await db.collection('race_control')
      .find({ session_key: openf1Key, category: 'SafetyCar' }).toArray();

    const scCount = raceControlMsgs.filter(m =>
      (m.message || '').toLowerCase().includes('deployed') &&
      !(m.message || '').toLowerCase().includes('virtual')
    ).length;
    const vscCount = raceControlMsgs.filter(m =>
      (m.message || '').toLowerCase().includes('virtual') &&
      (m.message || '').toLowerCase().includes('deployed')
    ).length;

    await prisma.session.update({ where: { id: sessionId }, data: { scCount, vscCount } });

    // Stints
    const stintsData = await db.collection('stints')
      .find({ session_key: openf1Key }).sort({ stint_number: 1 }).toArray();

    const stintMap = new Map<number, string[]>();
    for (const s of stintsData) {
      if (!s.driver_number || !s.compound) continue;
      if (!stintMap.has(s.driver_number)) stintMap.set(s.driver_number, []);
      const compound = (s.compound as string).toUpperCase();
      const lapStart = s.lap_start ?? 0;
      const lapEnd = s.lap_end ?? lapStart;
      stintMap.get(s.driver_number)!.push(`${compound}:${lapEnd - lapStart + 1}`);
    }

    // Intervals
    const intervals = await db.collection('intervals')
      .find({ session_key: openf1Key }).sort({ date: -1 }).toArray();

    const intervalMap = new Map<number, { gap_to_leader: unknown; interval: unknown }>();
    for (const iv of intervals) {
      if (iv.driver_number && !intervalMap.has(iv.driver_number)) {
        intervalMap.set(iv.driver_number, { gap_to_leader: iv.gap_to_leader, interval: iv.interval });
      }
    }

    // Upsert usando dados consolidados
    const allDrivers = await prisma.driver.findMany();
    const driverByNumber = new Map(allDrivers.map(d => [d.number, d]));

    let synced = 0;
    for (const r of results) {
      const driver = driverByNumber.get(r.driver_number);
      if (!driver) continue;

      const gaps = intervalMap.get(r.driver_number);
      const data = {
        startPosition: startPositionMap.get(r.driver_number) ?? 99,
        finishPosition: r.position ?? 99,
        points: r.points ?? 0,
        dnf: r.dnf === true,
        dns: r.dns === true,
        dsq: r.dsq === true,
        fastestLap: r.driver_number === fastestLapDriverNum,
        bestLapTime: bestLapMap.get(r.driver_number) ?? null,
        gapToLeader: parseGap(r.gap_to_leader ?? gaps?.gap_to_leader),
        interval: parseGap(gaps?.interval),
        tireStints: stintMap.get(r.driver_number) ?? [],
        teamId: driver.teamId,
      };

      await prisma.sessionEntry.upsert({
        where: { sessionId_driverId: { sessionId, driverId: driver.id } },
        update: data,
        create: { sessionId, driverId: driver.id, ...data },
      });
      synced++;
    }

    return synced > 0 ? 'synced' : 'no_data';
  } catch (err) {
    console.error(`[admin-sync] Erro na sessão ${sessionId}:`, err);
    return 'error';
  }
}

export async function syncGpSessions(gpId: number): Promise<{
  success: boolean;
  results: Array<{ sessionType: string; status: 'synced' | 'no_data' | 'error'; error?: string }>;
}> {
  await requireAdmin();

  const sessions = await prisma.session.findMany({
    where: {
      grandPrixId: gpId,
      cancelled: false,
      openf1Key: { not: null },
    },
    orderBy: { date: 'asc' },
  });

  const SESSION_ORDER: Record<string, number> = {
    PRACTICE_1: 1, PRACTICE_2: 2, PRACTICE_3: 3,
    SPRINT_QUALIFYING: 4, QUALIFYING: 5, SPRINT: 6, RACE: 7,
  };

  const sorted = sessions.sort((a, b) => (SESSION_ORDER[a.type] ?? 99) - (SESSION_ORDER[b.type] ?? 99));

  const results: Array<{ sessionType: string; status: 'synced' | 'no_data' | 'error'; error?: string }> = [];

  for (const s of sorted) {
    const status = await syncSessionFromMongo(s.id, s.openf1Key!);
    results.push({
      sessionType: s.type,
      status,
      error: status === 'no_data' ? 'Sem dados no MongoDB para esta sessão' : status === 'error' ? 'Erro ao sincronizar' : undefined,
    });
  }

  revalidateTag('results', { expire: 0 });
  revalidateTag('ranking', { expire: 0 });
  revalidateTag('gps', { expire: 0 });

  return { success: true, results };
}

export async function getResyncGps() {
  await requireAdmin();

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) return [];

  const now = new Date();

  const gps = await prisma.grandPrix.findMany({
    where: {
      cancelled: false,
      sessions: { some: { seasonId: activeSeason.id, date: { lte: now } } },
    },
    include: {
      sessions: {
        where: { cancelled: false, seasonId: activeSeason.id },
        orderBy: { date: 'asc' },
        select: { type: true, date: true, round: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return gps.map(gp => ({
    id: gp.id,
    name: gp.name,
    round: gp.sessions[0]?.round ?? 0,
    sessionCount: gp.sessions.length,
  }));
}

// ── Backup / Restore ────────────────────────────────────────────────────────

export async function createBackup(): Promise<{ success: boolean; data?: string; error?: string }> {
  await requireAdmin();
  try {
    const [
      teams, drivers, users, seasons, seasonConfigs, grandPrix, sessions,
      raceConfigs, sessionEntries, betRaces, betRaceGridItems,
      betSprints, betSprintGridItems, inviteCodes,
    ] = await Promise.all([
      prisma.team.findMany(),
      prisma.driver.findMany(),
      prisma.user.findMany({ select: { id: true, email: true, username: true, name: true, role: true, category: true } }),
      prisma.season.findMany(),
      prisma.seasonConfig.findMany(),
      prisma.grandPrix.findMany(),
      prisma.session.findMany(),
      prisma.raceConfig.findMany(),
      prisma.sessionEntry.findMany(),
      prisma.betRace.findMany(),
      prisma.betRaceGridItem.findMany(),
      prisma.betSprint.findMany(),
      prisma.betSprintGridItem.findMany(),
      prisma.inviteCode.findMany(),
    ]);

    const backup = {
      version: 1,
      createdAt: new Date().toISOString(),
      data: {
        teams, drivers, users, seasons, seasonConfigs, grandPrix, sessions,
        raceConfigs, sessionEntries, betRaces, betRaceGridItems,
        betSprints, betSprintGridItems, inviteCodes,
      },
    };

    return { success: true, data: JSON.stringify(backup, null, 2) };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao gerar backup' };
  }
}

export async function restoreBackup(json: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!json.trim()) return { success: false, error: 'Arquivo vazio' };

  try {
    const backup = JSON.parse(json);
    if (!backup.data || typeof backup.data !== 'object') return { success: false, error: 'Formato de backup inválido' };
    if (backup.version !== 1) return { success: false, error: `Versão de backup não suportada: ${backup.version}` };

    const requiredKeys = ['teams', 'drivers', 'users', 'seasons', 'grandPrix', 'sessions'];
    for (const key of requiredKeys) {
      if (!Array.isArray(backup.data[key])) return { success: false, error: `Campo obrigatório ausente ou inválido: ${key}` };
    }

    const d = backup.data;

    await prisma.$transaction(async (tx) => {
      // Deletar em ordem reversa de dependência
      await tx.betSprintGridItem.deleteMany();
      await tx.betRaceGridItem.deleteMany();
      await tx.$executeRawUnsafe('DELETE FROM "bet_sprint_results_view"');
      await tx.$executeRawUnsafe('DELETE FROM "bet_race_results_view"');
      await tx.betSprint.deleteMany();
      await tx.betRace.deleteMany();
      await tx.sessionEntry.deleteMany();
      await tx.raceConfig.deleteMany();
      await tx.inviteCode.deleteMany();
      await tx.session.deleteMany();
      await tx.grandPrix.deleteMany();
      await tx.seasonConfig.deleteMany();
      await tx.season.deleteMany();
      await tx.user.deleteMany();
      await tx.driver.deleteMany();
      await tx.team.deleteMany();

      // Inserir em ordem de dependência
      if (d.teams?.length) await tx.team.createMany({ data: d.teams });
      if (d.drivers?.length) await tx.driver.createMany({ data: d.drivers });
      if (d.users?.length) {
        // Backups novos não contêm password — usa placeholder hash que impede login
        const usersWithPw = d.users.map((u: Record<string, unknown>) => ({
          ...u,
          password: u.password ?? '$2a$10$PLACEHOLDER_NO_LOGIN_ALLOWED',
        }));
        await tx.user.createMany({ data: usersWithPw });
      }
      if (d.seasons?.length) await tx.season.createMany({ data: d.seasons });
      if (d.seasonConfigs?.length) await tx.seasonConfig.createMany({ data: d.seasonConfigs });
      if (d.grandPrix?.length) await tx.grandPrix.createMany({ data: d.grandPrix });
      if (d.sessions?.length) await tx.session.createMany({ data: d.sessions });
      if (d.raceConfigs?.length) await tx.raceConfig.createMany({ data: d.raceConfigs });
      if (d.sessionEntries?.length) await tx.sessionEntry.createMany({ data: d.sessionEntries });
      if (d.betRaces?.length) await tx.betRace.createMany({ data: d.betRaces });
      if (d.betRaceGridItems?.length) await tx.betRaceGridItem.createMany({ data: d.betRaceGridItems });
      if (d.betSprints?.length) await tx.betSprint.createMany({ data: d.betSprints });
      if (d.betSprintGridItems?.length) await tx.betSprintGridItem.createMany({ data: d.betSprintGridItems });
      if (d.inviteCodes?.length) await tx.inviteCode.createMany({ data: d.inviteCodes });

      // Resetar sequences — whitelist hardcoded, nenhum input externo
      for (const table of [
        'Team', 'Driver', 'User', 'Season', 'SeasonConfig', 'GrandPrix',
        'Session', 'RaceConfig', 'SessionEntry', 'BetRace', 'BetRaceGridItem',
        'BetSprint', 'BetSprintGridItem', 'InviteCode',
      ] as const) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
        );
      }
    }, { timeout: 120_000 });

    revalidateTag('season', { expire: 0 });
    revalidateTag('drivers', { expire: 0 });
    revalidateTag('gps', { expire: 0 });
    revalidateTag('results', { expire: 0 });
    revalidateTag('ranking', { expire: 0 });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao restaurar backup' };
  }
}
