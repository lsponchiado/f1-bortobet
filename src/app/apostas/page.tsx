import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth-utils';

export default async function ApostasIndexPage() {
  await getAuthSession();

  const now = new Date();

  const nextRace = await prisma.session.findFirst({
    where: { type: 'RACE', date: { gte: now }, cancelled: false, grandPrix: { cancelled: false } },
    orderBy: { date: 'asc' },
    select: { grandPrixId: true },
  });

  if (nextRace) redirect(`/apostas/${nextRace.grandPrixId}`);

  const lastRace = await prisma.session.findFirst({
    where: { type: 'RACE', cancelled: false, grandPrix: { cancelled: false } },
    orderBy: { date: 'desc' },
    select: { grandPrixId: true },
  });

  if (lastRace) redirect(`/apostas/${lastRace.grandPrixId}`);

  redirect('/');
}
