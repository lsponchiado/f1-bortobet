'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
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

// ── Re-sync de resultados via OpenF1 ─────────────────────────────────────────

export async function resyncSessionResults(sessionId: number): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, openf1Key: true, type: true, grandPrix: { select: { name: true } } },
  });

  if (!session) return { success: false, error: 'Sessão não encontrada' };
  if (!session.openf1Key) return { success: false, error: 'Sessão sem openf1Key mapeado' };

  try {
    // Busca resultados da API REST do OpenF1
    const baseUrl = process.env.OPENF1_API_URL || 'https://api.openf1.org';

    const [resultsRes, gridRes, lapsRes, rcRes] = await Promise.all([
      fetch(`${baseUrl}/v1/session_result?session_key=${session.openf1Key}`),
      fetch(`${baseUrl}/v1/starting_grid?session_key=${session.openf1Key}`),
      fetch(`${baseUrl}/v1/laps?session_key=${session.openf1Key}`),
      fetch(`${baseUrl}/v1/race_control?session_key=${session.openf1Key}&category=SafetyCar`),
    ]);

    const [results, grid, laps, rcMsgs] = await Promise.all([
      resultsRes.json() as Promise<Array<{ driver_number: number; position: number | null; points: number; dnf?: boolean; dns?: boolean; dsq?: boolean }>>,
      gridRes.json() as Promise<Array<{ driver_number: number; position: number | null }>>,
      lapsRes.json() as Promise<Array<{ driver_number: number; lap_duration: number | null }>>,
      rcRes.json() as Promise<Array<{ message: string }>>,
    ]);

    if (!Array.isArray(results) || results.length === 0) {
      return { success: false, error: 'Sem resultados na OpenF1 para esta sessão' };
    }

    // Starting grid
    const startPositionMap = new Map<number, number>();
    for (const g of grid) {
      if (g.driver_number && g.position) startPositionMap.set(g.driver_number, g.position);
    }

    // Fastest lap
    const validLaps = laps.filter(l => l.lap_duration != null);
    validLaps.sort((a, b) => a.lap_duration! - b.lap_duration!);
    const fastestLapDriverNumber = validLaps[0]?.driver_number || null;

    // Safety cars
    const scCount = rcMsgs.filter(m =>
      m.message?.toLowerCase().includes('deployed') &&
      !m.message?.toLowerCase().includes('virtual')
    ).length;
    const vscCount = rcMsgs.filter(m =>
      m.message?.toLowerCase().includes('virtual') &&
      m.message?.toLowerCase().includes('deployed')
    ).length;

    // Atualizar SC/VSC na sessão
    await prisma.session.update({
      where: { id: session.id },
      data: { scCount, vscCount },
    });

    // Mapear drivers
    const allDrivers = await prisma.driver.findMany();
    const driverByNumber = new Map(allDrivers.map(d => [d.number, d]));

    let synced = 0;
    for (const r of results) {
      const driver = driverByNumber.get(r.driver_number);
      if (!driver) continue;

      await prisma.sessionEntry.upsert({
        where: { sessionId_driverId: { sessionId: session.id, driverId: driver.id } },
        update: {
          startPosition: startPositionMap.get(r.driver_number) ?? 99,
          finishPosition: r.position ?? 99,
          points: r.points ?? 0,
          dnf: r.dnf === true,
          dns: r.dns === true,
          dsq: r.dsq === true,
          fastestLap: r.driver_number === fastestLapDriverNumber,
          teamId: driver.teamId,
        },
        create: {
          sessionId: session.id,
          driverId: driver.id,
          teamId: driver.teamId,
          startPosition: startPositionMap.get(r.driver_number) ?? 99,
          finishPosition: r.position ?? 99,
          points: r.points ?? 0,
          dnf: r.dnf === true,
          dns: r.dns === true,
          dsq: r.dsq === true,
          fastestLap: r.driver_number === fastestLapDriverNumber,
        },
      });
      synced++;
    }

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao sincronizar' };
  }
}

export async function getResyncSessions() {
  await requireAdmin();

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) return [];

  const sessions = await prisma.session.findMany({
    where: {
      seasonId: activeSeason.id,
      type: { in: ['RACE', 'SPRINT'] },
      cancelled: false,
      openf1Key: { not: null },
    },
    include: { grandPrix: { select: { name: true } } },
    orderBy: { date: 'desc' },
  });

  return sessions.map(s => ({
    id: s.id,
    type: s.type,
    round: s.round,
    date: s.date.toISOString(),
    gpName: s.grandPrix.name,
    openf1Key: s.openf1Key!,
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
    if (!backup.data) return { success: false, error: 'Formato de backup inválido' };
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

      // Resetar sequences para evitar conflitos de ID
      const tables = [
        'Team', 'Driver', 'User', 'Season', 'SeasonConfig', 'GrandPrix',
        'Session', 'RaceConfig', 'SessionEntry', 'BetRace', 'BetRaceGridItem',
        'BetSprint', 'BetSprintGridItem', 'InviteCode',
      ];
      for (const table of tables) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
        );
      }
    }, { timeout: 120_000 });

    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao restaurar backup' };
  }
}
