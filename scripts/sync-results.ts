/**
 * Sincronização manual e completa dos resultados de todas as sessões passadas.
 * Busca as posições finais do OpenF1 e popula SessionEntry no banco.
 *
 * Uso:
 *   npx tsx scripts/sync-results.ts           → todas as sessões passadas
 *   npx tsx scripts/sync-results.ts 9870      → sessão específica por openf1Key
 */

import { prisma } from './_client';
const BASE_URL = 'https://api.openf1.org/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OF1Position {
  session_key: number;
  driver_number: number;
  date: string;
  position: number;
}

interface OF1Lap {
  session_key: number;
  driver_number: number;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
}

interface OF1RaceControl {
  session_key: number;
  category: string;
  message: string;
  lap_number: number | null;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json() as Promise<T>;
}

async function getLapInfo(openf1Key: number): Promise<{ fastestLapDriver: number | null; dnfDrivers: Set<number> }> {
  console.log(`  → GET /laps?session_key=${openf1Key}`);
  await sleep(1500);
  const laps = await fetchJSON<OF1Lap[]>(`/laps?session_key=${openf1Key}`);

  if (laps.length === 0) return { fastestLapDriver: null, dnfDrivers: new Set() };

  // Volta mais rápida
  const validLaps = laps.filter((l) => l.lap_duration !== null && !l.is_pit_out_lap);
  validLaps.sort((a, b) => a.lap_duration! - b.lap_duration!);
  const fastestLapDriver = validLaps[0]?.driver_number ?? null;

  // DNF: conta voltas por piloto; quem completou < 90% das voltas do líder é DNF
  const lapCount = new Map<number, number>();
  for (const l of laps) {
    lapCount.set(l.driver_number, (lapCount.get(l.driver_number) ?? 0) + 1);
  }
  const maxLaps = Math.max(...lapCount.values());
  const dnfDrivers = new Set<number>();
  for (const [driverNum, count] of lapCount) {
    if (count < maxLaps * 0.9) dnfDrivers.add(driverNum);
  }

  if (dnfDrivers.size > 0) {
    console.log(`  🔴 DNFs detectados: ${[...dnfDrivers].join(', ')}`);
  }

  return { fastestLapDriver, dnfDrivers };
}

async function getSafetyCarCounts(openf1Key: number): Promise<{ scCount: number; vscCount: number }> {
  console.log(`  → GET /race_control?session_key=${openf1Key}`);
  await sleep(1500);
  const events = await fetchJSON<OF1RaceControl[]>(`/race_control?session_key=${openf1Key}`);

  // Count deployments only (lap 1 excluded to skip formation-lap SC starts)
  const deployed = events.filter(
    (e) => e.message.includes('DEPLOYED') && (e.lap_number === null || e.lap_number > 1),
  );
  const scCount  = deployed.filter((e) => e.message === 'SAFETY CAR DEPLOYED').length;
  const vscCount = deployed.filter((e) => e.message === 'VSC DEPLOYED').length;

  console.log(`  🚗 SC: ${scCount}, VSC: ${vscCount}`);
  return { scCount, vscCount };
}

async function syncSession(sessionId: number, openf1Key: number, label: string, syncFastestLap: boolean): Promise<number> {
  console.log(`  → GET /position?session_key=${openf1Key}`);
  const raw = await fetchJSON<OF1Position[]>(`/position?session_key=${openf1Key}`);

  if (raw.length === 0) {
    console.log(`  ⚠️  Sem dados de posição para ${label}`);
    return 0;
  }

  // Primeira e última posição por piloto (grid de largada e resultado final)
  const firstPos = new Map<number, number>();
  const latest   = new Map<number, number>();
  for (const p of raw.sort((a, b) => a.date.localeCompare(b.date))) {
    if (!firstPos.has(p.driver_number)) firstPos.set(p.driver_number, p.position);
    latest.set(p.driver_number, p.position);
  }

  // Volta mais rápida, DNFs e Safety Cars (apenas para corridas)
  let fastestLapDriverNumber: number | null = null;
  let dnfDrivers = new Set<number>();
  let scCount = 0;
  let vscCount = 0;
  if (syncFastestLap) {
    const info = await getLapInfo(openf1Key);
    fastestLapDriverNumber = info.fastestLapDriver;
    dnfDrivers = info.dnfDrivers;
    if (fastestLapDriverNumber !== null) {
      console.log(`  🟣 Volta mais rápida: piloto #${fastestLapDriverNumber}`);
    }
    ({ scCount, vscCount } = await getSafetyCarCounts(openf1Key));
  }

  const drivers = await prisma.driver.findMany({
    where: { number: { in: [...latest.keys()] } },
    select: { id: true, number: true, teamId: true },
  });

  let updated = 0;
  for (const d of drivers) {
    const position = latest.get(d.number);
    if (position === undefined) continue;
    const fastestLap = d.number === fastestLapDriverNumber;
    const dnf = dnfDrivers.has(d.number);
    const startPosition = firstPos.get(d.number) ?? 99;
    await prisma.sessionEntry.upsert({
      where: { sessionId_driverId: { sessionId, driverId: d.id } },
      update: { finishPosition: position, startPosition, fastestLap, dnf },
      create: { sessionId, driverId: d.id, teamId: d.teamId, finishPosition: position, startPosition, fastestLap, dnf },
    });
    updated++;
  }

  // Persist SC/VSC counts on the session
  if (syncFastestLap) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { scCount, vscCount },
    });
  }

  return updated;
}

async function main() {
  const targetKey = process.argv[2] ? parseInt(process.argv[2], 10) : null;

  const now = new Date();

  const sessions = await prisma.session.findMany({
    where: {
      openf1Key: targetKey ? { equals: targetKey } : { not: null },
      cancelled: false,
      date: { lt: now }, // apenas sessões que já ocorreram
    },
    include: { grandPrix: true },
    orderBy: { date: 'asc' },
  });

  if (sessions.length === 0) {
    console.log('Nenhuma sessão encontrada.');
    return;
  }

  console.log(`\n🏁 Sincronizando resultados de ${sessions.length} sessão(ões)...\n`);

  let total = 0;
  for (const s of sessions) {
    const label = `${s.type} — ${s.grandPrix.name} (${s.date.toISOString().slice(0, 10)})`;
    console.log(`\n📋 ${label}`);
    try {
      const syncFastestLap = s.type === 'RACE' || s.type === 'SPRINT';
      const n = await syncSession(s.id, s.openf1Key!, label, syncFastestLap);
      console.log(`  ✅ ${n} piloto(s) atualizados`);
      total += n;
    } catch (e) {
      console.error(`  ❌ Erro: ${(e as Error).message}`);
    }
    await sleep(2000);
  }

  console.log(`\n🏁 Concluído. ${total} entrada(s) atualizadas no total.\n`);
}

main()
  .catch((e) => { console.error('❌ Erro fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
