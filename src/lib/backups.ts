import { prisma } from '@/lib/prisma';

/**
 * Aplica apostas backup para uma sessão específica.
 * Chamado quando uma sessão começa (via worker/MQTT ou endpoint).
 * Retorna quantas apostas foram aplicadas.
 */
export async function applyBackupsForSession(sessionId: number): Promise<number> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, type: true, cancelled: true },
  });

  if (!session || session.cancelled) return 0;

  const isRace = session.type === 'RACE';
  let applied = 0;

  if (isRace) {
    const backups = await prisma.backupRaceBet.findMany({
      where: { gridIds: { isEmpty: false } },
    });

    for (const backup of backups) {
      const existing = await prisma.betRace.findFirst({
        where: { userId: backup.userId, sessionId },
      });
      if (existing) continue;

      await prisma.$transaction(async (tx) => {
        const bet = await tx.betRace.create({
          data: {
            userId: backup.userId,
            sessionId,
            predictedSC: backup.predictedSC,
            predictedDNF: backup.predictedDNF,
            doublePoints: false,
          },
        });

        const gridItems = backup.gridIds.map((driverId, index) => ({
          betId: bet.id,
          driverId,
          predictedPosition: index + 1,
          fastestLap: driverId === backup.fastestLapId,
        }));

        await tx.betRaceGridItem.createMany({ data: gridItems });
      });

      applied++;
    }
  } else if (session.type === 'SPRINT') {
    const backups = await prisma.backupSprintBet.findMany({
      where: { gridIds: { isEmpty: false } },
    });

    for (const backup of backups) {
      const existing = await prisma.betSprint.findFirst({
        where: { userId: backup.userId, sessionId },
      });
      if (existing) continue;

      await prisma.$transaction(async (tx) => {
        const bet = await tx.betSprint.create({
          data: { userId: backup.userId, sessionId },
        });

        const gridItems = backup.gridIds.map((driverId, index) => ({
          betId: bet.id,
          driverId,
          predictedPosition: index + 1,
        }));

        await tx.betSprintGridItem.createMany({ data: gridItems });
      });

      applied++;
    }
  }

  return applied;
}

/**
 * Aplica backups para todas as sessões recentes (fallback sem worker).
 * Busca sessões RACE/SPRINT que começaram nas últimas 2h.
 */
export async function applyBackupsForRecentSessions(): Promise<{ sessionsChecked: number; applied: number }> {
  const now = new Date();

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) return { sessionsChecked: 0, applied: 0 };

  const recentSessions = await prisma.session.findMany({
    where: {
      seasonId: activeSeason.id,
      cancelled: false,
      type: { in: ['RACE', 'SPRINT'] },
      date: { lte: now, gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });

  let applied = 0;
  for (const s of recentSessions) {
    applied += await applyBackupsForSession(s.id);
  }

  return { sessionsChecked: recentSessions.length, applied };
}
