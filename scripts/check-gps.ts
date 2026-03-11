import { prisma } from './_client';

async function main() {
  const gps = await prisma.grandPrix.findMany({ orderBy: { name: 'asc' } });
  console.log('--- Grand Prix ---');
  gps.forEach((g) => console.log(`  id=${g.id} ${g.name} (${g.country})`));

  const upcoming = await prisma.session.findMany({
    where: { type: 'QUALIFYING', season: { isActive: true } },
    include: { grandPrix: true },
    orderBy: { date: 'asc' },
  });
  console.log('\n--- Qualifying sessions ---');
  upcoming.forEach((s) => console.log(`  id=${s.id} gpId=${s.grandPrixId} ${s.grandPrix.name} date=${s.date.toISOString().slice(0, 10)}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
