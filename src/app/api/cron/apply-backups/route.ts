import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  // Valida token de autenticação
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
  }

  const now = new Date();

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) {
    return NextResponse.json({ message: 'Sem temporada ativa' });
  }

  const recentSessions = await prisma.session.findMany({
    where: {
      seasonId: activeSeason.id,
      cancelled: false,
      type: { in: ['RACE', 'SPRINT'] },
      date: { lte: now, gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    },
  });

  let applied = 0;

  for (const session of recentSessions) {
    const isRace = session.type === 'RACE';

    if (isRace) {
      const backups = await prisma.backupRaceBet.findMany({
        where: { gridIds: { isEmpty: false } },
      });

      for (const backup of backups) {
        const existing = await prisma.betRace.findFirst({
          where: { userId: backup.userId, sessionId: session.id },
        });
        if (existing) continue;

        await prisma.$transaction(async (tx) => {
          const bet = await tx.betRace.create({
            data: {
              userId: backup.userId,
              sessionId: session.id,
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
    } else {
      const backups = await prisma.backupSprintBet.findMany({
        where: { gridIds: { isEmpty: false } },
      });

      for (const backup of backups) {
        const existing = await prisma.betSprint.findFirst({
          where: { userId: backup.userId, sessionId: session.id },
        });
        if (existing) continue;

        await prisma.$transaction(async (tx) => {
          const bet = await tx.betSprint.create({
            data: { userId: backup.userId, sessionId: session.id },
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
  }

  return NextResponse.json({
    message: `Backup aplicado para ${applied} aposta(s)`,
    sessionsChecked: recentSessions.length,
    applied,
  });
}
