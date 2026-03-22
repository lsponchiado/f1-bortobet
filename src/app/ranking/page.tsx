import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { RankingClient, type ScoreRow, type EarningRow } from './RankingClient';
import type { RankingGpOption } from './RankingFilterBar';

export default async function RankingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) redirect('/');

  const rawScores = await prisma.$queryRaw<ScoreRow[]>`
    SELECT "userId", username, name, category, "grandPrixId", "grandPrixName", "sessionId", "sessionType", points, "totalPoints"
    FROM user_scores_view
    WHERE "seasonId" = ${activeSeason.id}
  `;

  const serializedScores: ScoreRow[] = rawScores.map(s => ({
    ...s,
    points: Number(s.points),
    totalPoints: Number(s.totalPoints),
  }));

  // GP options + earnings in parallel
  const [gpOptionsRaw, rawEarnings] = await Promise.all([
    prisma.$queryRaw<{ id: number; name: string }[]>`
      SELECT DISTINCT ON (gp.id) gp.id, gp.name
      FROM "GrandPrix" gp
      JOIN "Session" s ON s."grandPrixId" = gp.id
      JOIN "SessionEntry" se ON se."sessionId" = s.id
      WHERE s."seasonId" = ${activeSeason.id}
        AND NOT gp.cancelled
      ORDER BY gp.id, s.date ASC
    `,
    prisma.$queryRaw<EarningRow[]>`
      SELECT "userId", "grandPrixId", "gpEarning", "seasonEarning", "totalEarning"
      FROM user_earnings_view
      WHERE "seasonId" = ${activeSeason.id}
    `,
  ]);

  const earnings: EarningRow[] = rawEarnings.map(e => ({
    userId: Number(e.userId),
    grandPrixId: Number(e.grandPrixId),
    gpEarning: Number(e.gpEarning),
    seasonEarning: Number(e.seasonEarning),
    totalEarning: Number(e.totalEarning),
  }));

  // Order GPs by earliest session date
  const gpSessionDates = await prisma.$queryRaw<{ id: number; minDate: Date }[]>`
    SELECT gp.id, MIN(s.date) AS "minDate"
    FROM "GrandPrix" gp
    JOIN "Session" s ON s."grandPrixId" = gp.id
    WHERE s."seasonId" = ${activeSeason.id}
    GROUP BY gp.id
    ORDER BY "minDate" ASC
  `;
  const gpOrder = new Map(gpSessionDates.map((g, i) => [Number(g.id), i]));

  const gpOptions: RankingGpOption[] = gpOptionsRaw
    .map(g => ({ id: Number(g.id), name: g.name }))
    .sort((a, b) => (gpOrder.get(a.id) ?? 0) - (gpOrder.get(b.id) ?? 0));

  const displayUsername = session.user.username || session.user.name || 'User';
  const isAdmin = session.user.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={isAdmin} />
      <main className="pt-6 p-6 pb-40 md:pb-6 lg:p-12 flex flex-col items-center">
        <div className="w-full max-w-xl">
          <RankingClient scores={serializedScores} gpOptions={gpOptions} earnings={earnings} />
        </div>
      </main>
    </div>
  );
}
