import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🏁 [SEED] Iniciando seed...');

  // 1. Temporada 2026
  await prisma.season.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      isActive: true,
      description: "Novo Regulamento Técnico 2026"
    }
  });
  console.log('✅ Temporada 2026 criada');

  // 2. Pilotos e Equipes via OpenF1
  console.log('🏎️  Buscando pilotos na OpenF1...');
  const res = await fetch('https://api.openf1.org/v1/drivers?session_key=latest');

  if (!res.ok) {
    throw new Error(`OpenF1 respondeu com status ${res.status}`);
  }

  interface OpenF1Driver {
    driver_number: number;
    first_name: string;
    last_name: string;
    name_acronym: string;
    country_code: string;
    headshot_url: string | null;
    team_name: string;
    team_colour: string;
  }

  const data: OpenF1Driver[] = await res.json();

  // Deduplica por driver_number
  const uniqueDrivers = new Map<number, OpenF1Driver>();
  for (const d of data) {
    uniqueDrivers.set(d.driver_number, d);
  }

  const drivers = Array.from(uniqueDrivers.values());
  console.log(`📋 ${drivers.length} pilotos encontrados`);

  for (const d of drivers) {
    const team = await prisma.team.upsert({
      where: { name: d.team_name },
      update: { color: `#${d.team_colour}` },
      create: {
        name: d.team_name,
        color: `#${d.team_colour}`,
        country: '',
      },
    });

    await prisma.driver.upsert({
      where: { code: d.name_acronym },
      update: {
        firstName: d.first_name,
        lastName: d.last_name,
        number: d.driver_number,
        country: d.country_code ?? '',
        headshotUrl: d.headshot_url,
        teamId: team.id,
      },
      create: {
        firstName: d.first_name,
        lastName: d.last_name,
        code: d.name_acronym,
        number: d.driver_number,
        country: d.country_code ?? '',
        headshotUrl: d.headshot_url,
        teamId: team.id,
      },
    });

    console.log(`  ✅ ${d.first_name} ${d.last_name} (${d.name_acronym} #${d.driver_number}) → ${d.team_name}`);
  }

  console.log('\n🏁 [SEED] Pronto!');
}

/*
  ── DADOS LEGADOS (substituídos pelo sync:f1) ────────────────────────────────

  Os blocos abaixo criavam equipes, pilotos e calendário manualmente.
  Foram comentados porque agora tudo vem da Open F1 via `npm run sync:f1`.

  Para restaurar os dados hardcoded (ex: testes offline), descomente os blocos
  "2. Equipes e Pilotos" e "3. Calendário 2026" do commit anterior.

  ─────────────────────────────────────────────────────────────────────────────
*/

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
