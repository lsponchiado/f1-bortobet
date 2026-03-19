/**
 * Sincroniza resultados usando session_result da Open F1 API.
 * Busca todas as sessões de 2026, filtra as já realizadas, e para cada uma
 * chama /session_result para obter posição final, dnf, dns, dsq.
 *
 * Uso:
 *   npx tsx scripts/sync-results.ts           → todas as sessões passadas de 2026
 *   npx tsx scripts/sync-results.ts 11245     → sessão específica por openf1Key
 */

import { prisma } from './_client';

const BASE_URL = 'https://api.openf1.org/v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface OF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  meeting_key: number;
  circuit_short_name: string;
}

interface OF1SessionResult {
  session_key: number;
  driver_number: number;
  position: number | null;
  number_of_laps: number;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}

interface OF1Position {
  driver_number: number;
  date: string;
  position: number;
}

interface OF1Lap {
  driver_number: number;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
}

interface OF1RaceControl {
  message: string;
  lap_number: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  console.log(`  → GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json() as Promise<T>;
}

// ─── Sync de uma sessão ──────────────────────────────────────────────────────

async function syncSession(sessionId: number, openf1Key: number, isRace: boolean): Promise<number> {
  // 1. Resultados finais
  const results = await fetchJSON<OF1SessionResult[]>(`${BASE_URL}/session_result?session_key=${openf1Key}`);
  if (results.length === 0) {
    console.log(`  ⚠️  Sem resultados`);
    return 0;
  }

  // 2. Grid de largada (primeiro registro de /position por piloto)
  await sleep(1000);
  const positions = await fetchJSON<OF1Position[]>(`${BASE_URL}/position?session_key=${openf1Key}`);
  const startGrid = new Map<number, number>();
  for (const p of positions.sort((a, b) => a.date.localeCompare(b.date))) {
    if (!startGrid.has(p.driver_number)) startGrid.set(p.driver_number, p.position);
  }

  // 3. Fastest lap e SC/VSC (apenas corridas)
  let fastestLapDriverNum: number | null = null;
  let scCount = 0;
  let vscCount = 0;

  if (isRace) {
    await sleep(1000);
    const laps = await fetchJSON<OF1Lap[]>(`${BASE_URL}/laps?session_key=${openf1Key}`);
    const valid = laps.filter((l) => l.lap_duration !== null && !l.is_pit_out_lap);
    valid.sort((a, b) => a.lap_duration! - b.lap_duration!);
    fastestLapDriverNum = valid[0]?.driver_number ?? null;
    if (fastestLapDriverNum) console.log(`  🟣 Volta mais rápida: #${fastestLapDriverNum}`);

    await sleep(1000);
    const events = await fetchJSON<OF1RaceControl[]>(`${BASE_URL}/race_control?session_key=${openf1Key}`);
    const deployed = events.filter(
      (e) => e.message.includes('DEPLOYED') && (e.lap_number === null || e.lap_number > 1),
    );
    scCount = deployed.filter((e) => e.message === 'SAFETY CAR DEPLOYED').length;
    vscCount = deployed.filter((e) => e.message === 'VSC DEPLOYED').length;
    if (scCount || vscCount) console.log(`  🚗 SC: ${scCount}, VSC: ${vscCount}`);
  }

  // 4. Mapeia driver_number → driver do banco
  const driverNumbers = results.map((r) => r.driver_number);
  const drivers = await prisma.driver.findMany({
    where: { number: { in: driverNumbers } },
    select: { id: true, number: true, teamId: true },
  });
  const driverMap = new Map(drivers.map((d) => [d.number, d]));

  // 5. Ordena: classificados primeiro, depois DNF/DNS/DSQ por voltas
  const classified = results.filter((r) => r.position !== null).sort((a, b) => a.position! - b.position!);
  const unclassified = results.filter((r) => r.position === null).sort((a, b) => b.number_of_laps - a.number_of_laps);
  const sorted = [...classified, ...unclassified];

  let updated = 0;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const d = driverMap.get(r.driver_number);
    if (!d) continue;

    const finishPosition = r.position ?? (classified.length + (i - classified.length) + 1);
    const startPosition = startGrid.get(r.driver_number) ?? 99;

    await prisma.sessionEntry.upsert({
      where: { sessionId_driverId: { sessionId, driverId: d.id } },
      update: {
        finishPosition,
        startPosition,
        dnf: r.dnf,
        dns: r.dns,
        dsq: r.dsq,
        fastestLap: d.number === fastestLapDriverNum,
      },
      create: {
        sessionId,
        driverId: d.id,
        teamId: d.teamId,
        finishPosition,
        startPosition,
        dnf: r.dnf,
        dns: r.dns,
        dsq: r.dsq,
        fastestLap: d.number === fastestLapDriverNum,
      },
    });
    updated++;
  }

  if (isRace) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { scCount, vscCount },
    });
  }

  const dnfs = sorted.filter((r) => r.dnf).length;
  const dnss = sorted.filter((r) => r.dns).length;
  const dsqs = sorted.filter((r) => r.dsq).length;
  if (dnfs) console.log(`  🔴 DNF: ${dnfs}`);
  if (dnss) console.log(`  ⚪ DNS: ${dnss}`);
  if (dsqs) console.log(`  🟠 DSQ: ${dsqs}`);

  return updated;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const targetKey = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  const now = new Date();

  if (targetKey) {
    // Sessão específica
    const session = await prisma.session.findFirst({
      where: { openf1Key: targetKey },
      include: { grandPrix: true },
    });
    if (!session) {
      console.log(`Sessão com openf1Key ${targetKey} não encontrada no banco.`);
      return;
    }
    console.log(`\n📋 ${session.type} — ${session.grandPrix.name}`);
    const isRace = session.type === 'RACE' || session.type === 'SPRINT';
    const n = await syncSession(session.id, targetKey, isRace);
    console.log(`  ✅ ${n} piloto(s) atualizados\n`);
    return;
  }

  // Busca sessões de 2026 da OpenF1 para saber quais existem
  console.log('\n🏁 Buscando sessões de 2026 na Open F1...\n');
  const of1Sessions = await fetchJSON<OF1Session[]>(`${BASE_URL}/sessions?year=2026`);

  // Filtra: só GPs (ignora testes/pre-season), só sessões já realizadas
  const gpSessions = of1Sessions.filter(
    (s) => !s.session_name.startsWith('Day ') && new Date(s.date_start) < now,
  );

  console.log(`  ${gpSessions.length} sessões passadas de GP encontradas\n`);

  let total = 0;
  for (const of1 of gpSessions) {
    // Encontra sessão correspondente no banco pelo openf1Key
    const dbSession = await prisma.session.findFirst({
      where: { openf1Key: of1.session_key },
      include: { grandPrix: true },
    });

    if (!dbSession) {
      console.log(`  ⚠️  ${of1.session_name} @ ${of1.circuit_short_name} (key=${of1.session_key}) — não encontrada no banco, pulando`);
      continue;
    }

    console.log(`\n📋 ${dbSession.type} — ${dbSession.grandPrix.name}`);

    try {
      const isRace = dbSession.type === 'RACE' || dbSession.type === 'SPRINT';
      const n = await syncSession(dbSession.id, of1.session_key, isRace);
      console.log(`  ✅ ${n} piloto(s) atualizados`);
      total += n;
    } catch (e) {
      console.error(`  ❌ Erro: ${(e as Error).message}`);
    }

    await sleep(1500);
  }

  console.log(`\n🏁 Concluído. ${total} entrada(s) atualizadas no total.\n`);
}

main()
  .catch((e) => { console.error('❌ Erro fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
