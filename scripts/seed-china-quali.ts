/**
 * Seed de teste: classificação fictícia do GP da China 2026
 *
 * Grid pensado para testar as mecânicas automáticas:
 *   Hail Mary  → Bottas sai de P22 (último)  — aposte-o em P1-P5
 *   Underdog   → Lawson sai de P15            — aposte-o em P1-P3 (delta ≥ 10)
 *   Freefall   → Verstappen sai de P1         — aposte-o em P6+ (delta ≥ 5)
 *
 * Uso: npx tsx scripts/seed-china-quali.ts
 */

import { prisma } from './_client';

// Qualifying session id para China 2026 (id=3)
const QUALIFYING_SESSION_ID = 3;

// Grid: [finishPosition, driverNumber]
const QUALI_GRID: [number, number][] = [
  [1,  3],   // Verstappen    — Freefall se apostado P6+
  [2,  1],   // Norris
  [3,  2],   // Piastri
  [4,  16],  // Leclerc
  [5,  44],  // Hamilton
  [6,  63],  // Russell
  [7,  12],  // Antonelli
  [8,  5],   // Bortoleto
  [9,  6],   // Hadjar
  [10, 14],  // Alonso
  [11, 55],  // Sainz
  [12, 23],  // Albon
  [13, 10],  // Gasly
  [14, 27],  // Hulkenberg
  [15, 30],  // Lawson        — Underdog se apostado P1-P3
  [16, 31],  // Ocon
  [17, 43],  // Colapinto
  [18, 18],  // Stroll
  [19, 87],  // Bearman
  [20, 41],  // Lindblad
  [21, 11],  // Perez
  [22, 77],  // Bottas        — Hail Mary se apostado P1-P5
];

async function main() {
  const drivers = await prisma.driver.findMany({
    where: { enabled: true },
    select: { id: true, number: true, teamId: true, name: true },
  });

  const byNumber = new Map(drivers.map((d) => [d.number, d]));

  let created = 0;
  for (const [pos, num] of QUALI_GRID) {
    const driver = byNumber.get(num);
    if (!driver) { console.warn(`⚠️  Piloto #${num} não encontrado`); continue; }

    await prisma.sessionEntry.upsert({
      where: { sessionId_driverId: { sessionId: QUALIFYING_SESSION_ID, driverId: driver.id } },
      update: { finishPosition: pos, startPosition: pos },
      create: {
        sessionId: QUALIFYING_SESSION_ID,
        driverId: driver.id,
        teamId: driver.teamId,
        finishPosition: pos,
        startPosition: pos,
      },
    });

    console.log(`  P${String(pos).padStart(2, '0')}  #${String(num).padStart(2, ' ')}  ${driver.name}`);
    created++;
  }

  console.log(`\n✅ ${created} entradas criadas para a classificação do GP da China 2026`);
  console.log('\nMecânicas disponíveis para testar:');
  console.log('  🎯 Hail Mary  → aposte Bottas (#77) em P1–P5');
  console.log('  🐉 Underdog   → aposte Lawson (#30) em P1–P3');
  console.log('  ⬇️  Freefall   → aposte Verstappen (#3) em P6+');
}

main().catch(console.error).finally(() => prisma.$disconnect());
