/**
 * Seed Script — Popular PostgreSQL com dados históricos da API pública do OpenF1
 *
 * Uso: npx tsx seed.ts
 *
 * 1. Sincroniza pilotos e equipes
 * 2. Mapeia openf1Key nas sessões do Bortobet
 * 3. Busca resultados, tempos, stints, safety cars para cada sessão passada
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const API = 'https://api.openf1.org/v1';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchAPI(endpoint: string, params: Record<string, string | number> = {}, retries = 3): Promise<any[]> {
  const url = new URL(`${API}/${endpoint}`);
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, String(val));
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString());

    if (res.status === 429) {
      const wait = Math.pow(2, attempt + 1) * 5000; // 10s, 20s, 40s
      console.log(`  Rate limited, aguardando ${wait / 1000}s...`);
      await delay(wait);
      continue;
    }

    if (res.status === 404) return []; // endpoint sem dados pra essa sessão
    if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
    return res.json() as Promise<any[]>;
  }

  console.log(`  Rate limit persistente, pulando: ${endpoint}`);
  return [];
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseGap(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val === 'LAP' || val === '') return null;
    const parsed = parseFloat(val.replace('+', ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// ── Sync Drivers ─────────────────────────────────────────────────────────────

async function syncDrivers(sessionKey: number) {
  const drivers = await fetchAPI('drivers', { session_key: sessionKey });

  const driverMap = new Map<number, (typeof drivers)[0]>();
  for (const d of drivers) {
    if (!d.driver_number || !d.name_acronym) continue;
    driverMap.set(d.driver_number, d);
  }

  let synced = 0;
  for (const d of driverMap.values()) {
    const teamName = d.team_name || 'Unknown';
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: { color: `#${d.team_colour || 'FFFFFF'}` },
      create: { name: teamName, color: `#${d.team_colour || 'FFFFFF'}`, country: '' },
    });

    await prisma.driver.upsert({
      where: { code: d.name_acronym },
      update: {
        firstName: d.first_name || '',
        lastName: d.last_name || '',
        headshotUrl: d.headshot_url || null,
        teamId: team.id,
      },
      create: {
        code: d.name_acronym,
        number: d.driver_number,
        firstName: d.first_name || '',
        lastName: d.last_name || '',
        country: d.country_code || 'XX',
        headshotUrl: d.headshot_url || null,
        teamId: team.id,
      },
    });
    synced++;
  }

  console.log(`  Pilotos: ${synced} sincronizados`);
}

// ── Map openf1Keys ───────────────────────────────────────────────────────────

async function mapOpenF1Keys() {
  const unmapped = await prisma.session.findMany({
    where: { openf1Key: null },
    include: { grandPrix: true, season: true },
  });

  if (unmapped.length === 0) {
    console.log('[seed] Todas as sessões já têm openf1Key');
    return;
  }

  const years = [...new Set(unmapped.map(s => s.season.year))];
  let openf1Sessions: any[] = [];
  for (const year of years) {
    const sessions = await fetchAPI('sessions', { year });
    openf1Sessions.push(...sessions);
    await delay(300);
  }

  console.log(`[seed] ${openf1Sessions.length} sessões encontradas na API para anos: ${years.join(', ')}`);

  const openf1TypeMap: Record<string, string[]> = {
    RACE: ['Race'],
    SPRINT: ['Sprint'],
    QUALIFYING: ['Qualifying'],
    SPRINT_QUALIFYING: ['Sprint Qualifying', 'Sprint Shootout'],
    PRACTICE_1: ['Practice 1'],
    PRACTICE_2: ['Practice 2'],
    PRACTICE_3: ['Practice 3'],
  };

  let mapped = 0;
  for (const session of unmapped) {
    const gpName = session.grandPrix.name.toLowerCase();
    const validTypes = openf1TypeMap[session.type] || [];

    const match = openf1Sessions.find(o => {
      const oType = o.session_type || '';
      const oLocation = (o.location || '').toLowerCase();
      const oCountry = (o.country_name || '').toLowerCase();
      const oCircuit = (o.circuit_short_name || '').toLowerCase();
      return (
        o.year === session.season.year &&
        validTypes.includes(oType) &&
        (gpName.includes(oLocation) || oLocation.includes(gpName) ||
         gpName.includes(oCountry) || gpName.includes(oCircuit))
      );
    });

    if (match?.session_key) {
      const existing = await prisma.session.findUnique({
        where: { openf1Key: match.session_key },
      });
      if (!existing) {
        await prisma.session.update({
          where: { id: session.id },
          data: { openf1Key: match.session_key },
        });
        console.log(`  Mapeado: ${session.grandPrix.name} ${session.type} → ${match.session_key}`);
        mapped++;
      }
    }
  }

  console.log(`[seed] ${mapped}/${unmapped.length} sessões mapeadas`);
}

// ── Sync Session Results ─────────────────────────────────────────────────────

async function syncSessionResults(sessionKey: number, sessionId: number) {
  // Busca sequencialmente pra respeitar rate limit
  const positions = await fetchAPI('position', { session_key: sessionKey });
  await delay(2000);
  const lapsData = await fetchAPI('laps', { session_key: sessionKey });
  await delay(2000);
  const raceControlMsgs = await fetchAPI('race_control', { session_key: sessionKey });
  await delay(2000);
  const stintsData = await fetchAPI('stints', { session_key: sessionKey });
  await delay(2000);
  const intervalsData = await fetchAPI('intervals', { session_key: sessionKey });

  // Posições finais e iniciais
  const finalPosMap = new Map<number, number>();
  const startPosMap = new Map<number, number>();
  for (const p of positions) {
    if (!p.driver_number || !p.position) continue;
    if (!startPosMap.has(p.driver_number)) {
      startPosMap.set(p.driver_number, p.position);
    }
    finalPosMap.set(p.driver_number, p.position);
  }

  if (finalPosMap.size === 0) {
    console.log(`  Sem posições, pulando`);
    return;
  }

  // DNF/DSQ do race_control
  const dnfDrivers = new Set<number>();
  const dsqDrivers = new Set<number>();
  for (const msg of raceControlMsgs) {
    const message = (msg.message || '').toUpperCase();
    const driverNum = msg.driver_number;
    if (!driverNum) continue;
    if (message.includes('RETIRED') || message.includes('STOPPED')) dnfDrivers.add(driverNum);
    if (message.includes('DISQUALIFIED')) dsqDrivers.add(driverNum);
  }

  // Best lap por piloto + fastest lap geral
  const bestLapMap = new Map<number, number>();
  for (const l of lapsData) {
    if (!l.driver_number || !l.lap_duration) continue;
    const current = bestLapMap.get(l.driver_number);
    if (!current || l.lap_duration < current) {
      bestLapMap.set(l.driver_number, l.lap_duration);
    }
  }
  const validLaps = lapsData.filter((l: any) => l.lap_duration != null);
  validLaps.sort((a: any, b: any) => a.lap_duration - b.lap_duration);
  const fastestLapDriverNum = validLaps[0]?.driver_number || null;

  // Safety cars
  const scCount = raceControlMsgs.filter((m: any) =>
    (m.message || '').toLowerCase().includes('deployed') &&
    !(m.message || '').toLowerCase().includes('virtual')
  ).length;
  const vscCount = raceControlMsgs.filter((m: any) =>
    (m.message || '').toLowerCase().includes('virtual') &&
    (m.message || '').toLowerCase().includes('deployed')
  ).length;

  await prisma.session.update({
    where: { id: sessionId },
    data: { scCount, vscCount },
  });

  // Stints
  const stintMap = new Map<number, string[]>();
  const sortedStints = [...stintsData].sort((a: any, b: any) => (a.stint_number || 0) - (b.stint_number || 0));
  for (const s of sortedStints) {
    if (!s.driver_number || !s.compound) continue;
    if (!stintMap.has(s.driver_number)) stintMap.set(s.driver_number, []);
    const compound = (s.compound as string).toUpperCase();
    const lapStart = s.lap_start ?? 0;
    const lapEnd = s.lap_end ?? lapStart;
    const laps = lapEnd - lapStart + 1;
    stintMap.get(s.driver_number)!.push(`${compound}:${laps}`);
  }

  // Intervals (último por piloto)
  const intervalMap = new Map<number, { gap_to_leader: unknown; interval: unknown }>();
  for (let i = intervalsData.length - 1; i >= 0; i--) {
    const iv = intervalsData[i];
    if (iv.driver_number && !intervalMap.has(iv.driver_number)) {
      intervalMap.set(iv.driver_number, { gap_to_leader: iv.gap_to_leader, interval: iv.interval });
    }
  }

  // Upsert
  const allDrivers = await prisma.driver.findMany();
  const driverByNumber = new Map(allDrivers.map(d => [d.number, d]));

  let synced = 0;
  for (const [driverNum, position] of finalPosMap) {
    const driver = driverByNumber.get(driverNum);
    if (!driver) continue;

    const gaps = intervalMap.get(driverNum);
    const data = {
      startPosition: startPosMap.get(driverNum) ?? 99,
      finishPosition: position,
      points: 0,
      dnf: dnfDrivers.has(driverNum),
      dns: false,
      dsq: dsqDrivers.has(driverNum),
      fastestLap: driverNum === fastestLapDriverNum,
      bestLapTime: bestLapMap.get(driverNum) ?? null,
      gapToLeader: parseGap(gaps?.gap_to_leader),
      interval: parseGap(gaps?.interval),
      tireStints: stintMap.get(driverNum) ?? [],
      teamId: driver.teamId,
    };

    await prisma.sessionEntry.upsert({
      where: { sessionId_driverId: { sessionId, driverId: driver.id } },
      update: data,
      create: { sessionId, driverId: driver.id, ...data },
    });
    synced++;
  }

  console.log(`  ${synced} resultados, ${scCount} SC, ${vscCount} VSC`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed] Iniciando seed da API pública OpenF1...\n');

  // 1. Mapear openf1Keys
  console.log('[seed] Mapeando sessões...');
  await mapOpenF1Keys();

  // 2. Buscar sessões passadas com openf1Key
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: {
      openf1Key: { not: null },
      date: { lt: now },
      cancelled: false,
    },
    include: { grandPrix: true },
    orderBy: { date: 'asc' },
  });

  console.log(`\n[seed] ${sessions.length} sessões para sincronizar\n`);

  // 3. Sync drivers do session mais recente
  const latestKey = sessions[sessions.length - 1]?.openf1Key;
  if (latestKey) {
    console.log('[seed] Sincronizando pilotos...');
    await syncDrivers(latestKey);
    console.log('');
  }

  // 4. Sync cada sessão
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    console.log(`[seed] (${i + 1}/${sessions.length}) ${s.grandPrix.name} — ${s.type}`);

    try {
      await syncSessionResults(s.openf1Key!, s.id);
    } catch (err: any) {
      console.error(`  ERRO: ${err.message}`);
    }

    await delay(3000); // rate limiting entre sessões
  }

  console.log('\n[seed] Concluído!');
  await prisma.$disconnect();
  pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Erro fatal:', err);
  process.exit(1);
});
