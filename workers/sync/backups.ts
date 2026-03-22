import 'dotenv/config';

/**
 * Lógica de backup auto-aplicada — cópia standalone para o worker.
 * Não depende de imports do app Next.js.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

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
