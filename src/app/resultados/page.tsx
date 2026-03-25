import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth-utils';

export default async function ResultadosIndexPage() {
  await getAuthSession();

  // Último GP que tem resultados (entries)
  const lastWithResults = await prisma.session.findFirst({
    where: {
      type: 'RACE',
      cancelled: false,
      grandPrix: { cancelled: false },
      entries: { some: {} },
    },
    orderBy: { date: 'desc' },
    select: { grandPrixId: true },
  });

  if (lastWithResults) redirect(`/resultados/${lastWithResults.grandPrixId}`);

  // Fallback: próximo GP (mesmo sem resultados)
  const nextRace = await prisma.session.findFirst({
    where: { type: 'RACE', date: { gte: new Date() }, cancelled: false, grandPrix: { cancelled: false } },
    orderBy: { date: 'asc' },
    select: { grandPrixId: true },
  });

  if (nextRace) redirect(`/resultados/${nextRace.grandPrixId}`);

  redirect('/');
}
