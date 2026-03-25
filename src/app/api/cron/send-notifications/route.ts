import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

const SESSION_LABELS: Record<string, string> = {
  PRACTICE_1: 'Treino Livre 1',
  PRACTICE_2: 'Treino Livre 2',
  PRACTICE_3: 'Treino Livre 3',
  SPRINT_QUALIFYING: 'Classificação Sprint',
  QUALIFYING: 'Classificação',
  SPRINT: 'Sprint',
  RACE: 'Corrida',
};

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const now = new Date();
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) return NextResponse.json({ sent: 0, message: 'No active season' });

  let totalSent = 0;

  // ── 5-minute session reminder (all session types) ────────────────────────
  const fiveMinFrom = new Date(now.getTime() + 4 * 60_000);
  const fiveMinTo = new Date(now.getTime() + 6 * 60_000);

  const sessionsIn5 = await prisma.session.findMany({
    where: {
      seasonId: activeSeason.id,
      cancelled: false,
      date: { gte: fiveMinFrom, lte: fiveMinTo },
    },
    include: { grandPrix: { select: { name: true } } },
  });

  for (const session of sessionsIn5) {
    const label = SESSION_LABELS[session.type] || session.type;

    // Get users with sessionReminder enabled
    const prefs = await prisma.notificationPreference.findMany({
      where: { sessionReminder: true },
      select: { userId: true },
    });

    for (const pref of prefs) {
      await sendPushToUser(pref.userId, {
        title: `${label} em 5 minutos`,
        body: `${session.grandPrix.name} — ${label} começa em breve!`,
        url: '/',
      });
      totalSent++;
    }
  }

  // ── 30-minute bet reminder (RACE/SPRINT only) ───────────────────────────
  const thirtyMinFrom = new Date(now.getTime() + 29 * 60_000);
  const thirtyMinTo = new Date(now.getTime() + 31 * 60_000);

  const sessionsIn30 = await prisma.session.findMany({
    where: {
      seasonId: activeSeason.id,
      cancelled: false,
      type: { in: ['RACE', 'SPRINT'] },
      date: { gte: thirtyMinFrom, lte: thirtyMinTo },
    },
    include: { grandPrix: { select: { name: true, id: true } } },
  });

  for (const session of sessionsIn30) {
    const label = SESSION_LABELS[session.type] || session.type;

    // Get users with betReminder enabled who DON'T have a bet for this session
    const prefs = await prisma.notificationPreference.findMany({
      where: { betReminder: true },
      select: { userId: true },
    });

    for (const pref of prefs) {
      const hasBet = session.type === 'RACE'
        ? await prisma.betRace.findFirst({ where: { userId: pref.userId, sessionId: session.id } })
        : await prisma.betSprint.findFirst({ where: { userId: pref.userId, sessionId: session.id } });

      if (!hasBet) {
        await sendPushToUser(pref.userId, {
          title: 'Aposta pendente!',
          body: `${session.grandPrix.name} — ${label} começa em 30 minutos e você ainda não apostou.`,
          url: `/apostas/${session.grandPrix.id}`,
        });
        totalSent++;
      }
    }
  }

  return NextResponse.json({ sent: totalSent, sessions5min: sessionsIn5.length, sessions30min: sessionsIn30.length });
}
