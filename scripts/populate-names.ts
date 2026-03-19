/**
 * Popula firstName e lastName dos pilotos a partir da Open F1 API.
 * Uso: npx tsx scripts/populate-names.ts
 */

import { prisma } from './_client';

const BASE_URL = 'https://api.openf1.org/v1';

interface OF1Driver {
  first_name: string;
  last_name: string;
  full_name: string;
  name_acronym: string;
  driver_number: number;
}

async function main() {
  // Busca pilotos da sessão mais recente
  const res = await fetch(`${BASE_URL}/drivers?session_key=latest`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const apiDrivers: OF1Driver[] = await res.json();

  console.log(`\n📡 ${apiDrivers.length} pilotos obtidos da Open F1\n`);

  // Deduplica por acronym
  const byCode = new Map<string, OF1Driver>();
  for (const d of apiDrivers) {
    byCode.set(d.name_acronym, d);
  }

  const dbDrivers = await prisma.driver.findMany();
  let updated = 0;

  for (const driver of dbDrivers) {
    const api = byCode.get(driver.code);
    if (api) {
      await prisma.driver.update({
        where: { id: driver.id },
        data: { firstName: api.first_name, lastName: api.last_name },
      });
      console.log(`  ${driver.code} → ${api.first_name} ${api.last_name}`);
      updated++;
    } else {
      console.log(`  ${driver.code} → não encontrado na API, ignorado`);
    }
  }

  console.log(`\n✅ ${updated} pilotos atualizados.\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
