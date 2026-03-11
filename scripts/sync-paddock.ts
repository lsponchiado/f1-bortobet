/**
 * Consulta o paddock para sessões próximas: identifica pilotos participantes,
 * detecta substitutos e cria/atualiza SessionEntry.
 *
 * Uso: npx tsx scripts/sync-paddock.ts [horas]
 * Exemplo: npx tsx scripts/sync-paddock.ts 24   (padrão: 24h)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'https://api.openf1.org/v1';

interface OF1Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  country_code: string;
  headshot_url: string | null;
  session_key: number;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json() as Promise<T>;
}

function toHex(colour: string | null | undefined): string {
  if (!colour) return '#CCCCCC';
  return colour.startsWith('#') ? colour : `#${colour}`;
}

async function syncSessionPaddock(session: {
  id: number;
  type: string;
  openf1Key: number;
  grandPrix: { name: string };
  date: Date;
}) {
  console.log(`\n  🔍 ${session.type} — ${session.grandPrix.name} (${session.date.toISOString().slice(0, 16)} UTC)`);

  const raw = await fetchJSON<OF1Driver[]>(`/drivers?session_key=${session.openf1Key}`);

  if (raw.length === 0) {
    console.log(`     ⚠️  Open F1 ainda sem dados para session_key=${session.openf1Key}`);
    return;
  }

  // Deduplica por número do carro
  const drivers = Object.values(Object.fromEntries(raw.map((d) => [d.driver_number, d])));
  console.log(`     👥 ${drivers.length} pilotos na API`);

  // Busca o lineup atual esperado (Driver.teamId) para detectar substitutos
  const expectedDrivers = await prisma.driver.findMany({
    where: { enabled: true },
    select: { id: true, code: true, teamId: true, name: true },
  });
  const expectedByCode = new Map(expectedDrivers.map((d) => [d.code, d]));

  const results = { created: 0, updated: 0, substitutes: [] as string[] };

  for (const d of drivers) {
    if (!d.team_name || !d.name_acronym) continue;

    // Garante equipe
    const team = await prisma.team.upsert({
      where: { name: d.team_name },
      update: { color: toHex(d.team_colour) },
      create: { name: d.team_name, color: toHex(d.team_colour), country: '' },
    });

    // Garante piloto — atualiza teamId para refletir equipe atual
    const driver = await prisma.driver.upsert({
      where: { code: d.name_acronym },
      update: {
        name: d.full_name,
        number: d.driver_number,
        headshotUrl: d.headshot_url ?? undefined,
        teamId: team.id,
      },
      create: {
        name: d.full_name,
        code: d.name_acronym,
        number: d.driver_number,
        country: (d.country_code ?? '').toLowerCase(),
        headshotUrl: d.headshot_url ?? undefined,
        teamId: team.id,
      },
    });

    // Detecta substituto: piloto que não está no lineup esperado para esta equipe
    const expected = expectedByCode.get(d.name_acronym);
    if (!expected) {
      results.substitutes.push(`${d.name_acronym} (NOVO piloto em ${d.team_name})`);
    } else if (expected.teamId !== team.id) {
      results.substitutes.push(`${d.name_acronym} correrá pela ${d.team_name} (equipe habitual: diferente)`);
    }

    // Cria ou atualiza SessionEntry para esta sessão
    const existing = await prisma.sessionEntry.findUnique({
      where: { sessionId_driverId: { sessionId: session.id, driverId: driver.id } },
    });

    if (!existing) {
      await prisma.sessionEntry.create({
        data: { sessionId: session.id, driverId: driver.id, teamId: team.id },
      });
      results.created++;
    } else if (existing.teamId !== team.id) {
      await prisma.sessionEntry.update({
        where: { id: existing.id },
        data: { teamId: team.id },
      });
      results.updated++;
    }
  }

  console.log(`     ✅ ${results.created} criado(s), ${results.updated} atualizado(s)`);

  if (results.substitutes.length > 0) {
    console.log(`     🚨 Substitutos/mudanças detectados:`);
    results.substitutes.forEach((s) => console.log(`        — ${s}`));
  }
}

async function main() {
  const hoursAhead = parseInt(process.argv[2] ?? '24', 10);
  if (isNaN(hoursAhead) || hoursAhead <= 0) {
    console.error('❌ Uso: npx tsx scripts/sync-paddock.ts [horas]');
    process.exit(1);
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  console.log(`\n🏁 Sync paddock — janela: próximas ${hoursAhead}h (até ${windowEnd.toISOString().slice(0, 16)} UTC)\n`);

  const upcomingSessions = await prisma.session.findMany({
    where: {
      openf1Key: { not: null },
      date: { gte: now, lte: windowEnd },
      cancelled: false,
    },
    include: { grandPrix: true },
    orderBy: { date: 'asc' },
  });

  if (upcomingSessions.length === 0) {
    console.log(`ℹ️  Nenhuma sessão sincronizada com Open F1 nas próximas ${hoursAhead}h.`);
    console.log('   (Rode sync:f1 primeiro para importar o calendário com openf1Key)\n');
    return;
  }

  console.log(`📋 ${upcomingSessions.length} sessão(ões) encontrada(s)`);

  for (const session of upcomingSessions) {
    await syncSessionPaddock(session as any);
  }

  console.log('\n🏁 Sync paddock concluído!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
