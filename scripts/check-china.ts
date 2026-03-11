import { prisma } from './_client';

async function main() {
  const drivers = await prisma.driver.findMany({
    where: { enabled: true },
    include: { team: true },
    orderBy: { number: 'asc' },
  });
  console.log('\n--- Drivers ---');
  drivers.forEach((d) => console.log(`  id=${d.id} #${d.number} ${d.name} (${d.team.name})`));

  const sessions = await prisma.session.findMany({
    where: { grandPrix: { name: { contains: 'China' } } },
    include: { grandPrix: true },
    orderBy: { type: 'asc' },
  });
  console.log('\n--- China sessions ---');
  sessions.forEach((s) => console.log(`  id=${s.id} type=${s.type} openf1Key=${s.openf1Key} date=${s.date.toISOString().slice(0, 10)}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
