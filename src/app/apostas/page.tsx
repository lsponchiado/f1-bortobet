import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export default async function ApostasIndexPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

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
