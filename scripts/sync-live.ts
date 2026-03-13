/**
 * Live sync com WebSocket (MQTT) durante sessões ativas:
 *
 *   UPCOMING      → ignora (sessão ainda não começou)
 *   ACTIVE        → WebSocket MQTT em tempo real (posições + FL + DNF + SC)
 *                   flush para o DB a cada 5s
 *   COOLING_DOWN  → poll REST 1x a cada 6h, por 3 dias (correções de stewards)
 *   ARCHIVED      → nunca mais
 *
 * Variáveis de ambiente:
 *   OPENF1_API_KEY   — API key / senha da conta OpenF1 (obrigatório)
 *   OPENF1_USERNAME  — e-mail da conta OpenF1 (opcional; habilita troca de token)
 *
 * Uso: npx tsx scripts/sync-live.ts
 */

import { prisma } from './_client';
import { SessionType } from '@prisma/client';
import mqtt from 'mqtt';

const BASE_URL = 'https://api.openf1.org/v1';
const MQTT_URL = 'wss://mqtt.openf1.org:8084/mqtt';

const API_KEY  = process.env.OPENF1_API_KEY;
const OPENF1_USERNAME = process.env.OPENF1_USERNAME ?? 'user';
const AUTH_HEADERS: HeadersInit = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};

// ─── Configuração de durações ─────────────────────────────────────────────────

const SESSION_DURATION_MS: Record<string, number> = {
  [SessionType.RACE]:              3 * 60 * 60 * 1000,
  [SessionType.SPRINT]:            2 * 60 * 60 * 1000,
  [SessionType.QUALIFYING]:        2 * 60 * 60 * 1000,
  [SessionType.SPRINT_QUALIFYING]: 1 * 60 * 60 * 1000,
  [SessionType.PRACTICE_1]:        2 * 60 * 60 * 1000,
  [SessionType.PRACTICE_2]:        2 * 60 * 60 * 1000,
  [SessionType.PRACTICE_3]:        2 * 60 * 60 * 1000,
};

const COOLING_DOWN_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias
const COOLING_DOWN_INTERVAL_MS = 6 * 60 * 60 * 1000;      // 6h entre polls
const DB_FLUSH_INTERVAL_MS     = 5_000;                    // flush ao DB a cada 5s
const LOOP_INTERVAL_MS         = 30_000;                   // checa estado das sessões a cada 30s

// ─── Estado por sessão ───────────────────────────────────────────────────────

type SessionState = 'upcoming' | 'active' | 'cooling_down' | 'archived';

const lastSync = new Map<number, Date>();

function getState(sessionDate: Date, sessionType: string, now: Date): SessionState {
  const duration    = SESSION_DURATION_MS[sessionType] ?? 3 * 60 * 60 * 1000;
  const activeEnd   = new Date(sessionDate.getTime() + duration);
  const archiveDate = new Date(sessionDate.getTime() + COOLING_DOWN_DURATION_MS);
  if (now < sessionDate)  return 'upcoming';
  if (now <= activeEnd)   return 'active';
  if (now <= archiveDate) return 'cooling_down';
  return 'archived';
}

function needsCoolingPoll(sessionId: number, now: Date): boolean {
  const last = lastSync.get(sessionId);
  if (!last) return true;
  return now.getTime() - last.getTime() >= COOLING_DOWN_INTERVAL_MS;
}

// ─── Tipos OpenF1 ────────────────────────────────────────────────────────────

interface OF1Position    { session_key: number; driver_number: number; date: string; position: number; }
interface OF1Lap         { session_key: number; driver_number: number; lap_duration: number | null; is_pit_out_lap: boolean; }
interface OF1RaceControl { session_key: number; category: string; message: string; lap_number: number | null; }

// ─── REST (cooling_down) ─────────────────────────────────────────────────────

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: AUTH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function syncSessionREST(sessionId: number, openf1Key: number, sessionType: string): Promise<number> {
  const raw = await fetchJSON<OF1Position[]>(`/position?session_key=${openf1Key}`);
  if (raw.length === 0) return 0;

  const firstPos = new Map<number, number>();
  const latest   = new Map<number, number>();
  for (const p of raw.sort((a, b) => a.date.localeCompare(b.date))) {
    if (!firstPos.has(p.driver_number)) firstPos.set(p.driver_number, p.position);
    latest.set(p.driver_number, p.position);
  }

  const isRaceOrSprint = sessionType === 'RACE' || sessionType === 'SPRINT';
  let fl: number | null = null;
  let dnf = new Set<number>();
  let scCount = 0, vscCount = 0;

  if (isRaceOrSprint) {
    const laps = await fetchJSON<OF1Lap[]>(`/laps?session_key=${openf1Key}`);
    if (laps.length > 0) {
      const valid = laps.filter(l => l.lap_duration !== null && !l.is_pit_out_lap);
      valid.sort((a, b) => a.lap_duration! - b.lap_duration!);
      fl = valid[0]?.driver_number ?? null;
      const lapCount = new Map<number, number>();
      for (const l of laps) lapCount.set(l.driver_number, (lapCount.get(l.driver_number) ?? 0) + 1);
      const maxLaps = Math.max(...lapCount.values());
      for (const [num, count] of lapCount) if (count < maxLaps * 0.9) dnf.add(num);
    }
    const events = await fetchJSON<OF1RaceControl[]>(`/race_control?session_key=${openf1Key}`);
    const deployed = events.filter(e => e.message.includes('DEPLOYED') && (e.lap_number === null || e.lap_number > 1));
    scCount  = deployed.filter(e => e.message === 'SAFETY CAR DEPLOYED').length;
    vscCount = deployed.filter(e => e.message === 'VSC DEPLOYED').length;
  }

  const drivers = await prisma.driver.findMany({
    where:  { number: { in: [...latest.keys()] } },
    select: { id: true, number: true, teamId: true },
  });

  let updated = 0;
  for (const d of drivers) {
    const position = latest.get(d.number);
    if (position === undefined) continue;
    await prisma.sessionEntry.upsert({
      where:  { sessionId_driverId: { sessionId, driverId: d.id } },
      update: { finishPosition: position, startPosition: firstPos.get(d.number) ?? 99, fastestLap: d.number === fl, dnf: dnf.has(d.number) },
      create: { sessionId, driverId: d.id, teamId: d.teamId, finishPosition: position, startPosition: firstPos.get(d.number) ?? 99, fastestLap: d.number === fl, dnf: dnf.has(d.number) },
    });
    updated++;
  }

  if (isRaceOrSprint) {
    await prisma.session.update({ where: { id: sessionId }, data: { scCount, vscCount } });
  }

  return updated;
}

// ─── WebSocket / MQTT (sessões ativas) ───────────────────────────────────────

interface LiveState {
  sessionId:    number;
  openf1Key:    number;
  sessionType:  string;
  firstPos:     Map<number, number>;
  latestPos:    Map<number, number>;
  lapsByDriver: Map<number, OF1Lap[]>;
  scCount:      number;
  vscCount:     number;
  dirty:        boolean;
}

const activeSockets = new Map<number, mqtt.MqttClient>();
const liveStates    = new Map<number, LiveState>();

function computeFlDnf(state: LiveState): { fl: number | null; dnf: Set<number> } {
  const allLaps: OF1Lap[] = [];
  for (const laps of state.lapsByDriver.values()) allLaps.push(...laps);

  const valid = allLaps.filter(l => l.lap_duration !== null && !l.is_pit_out_lap);
  valid.sort((a, b) => a.lap_duration! - b.lap_duration!);
  const fl = valid[0]?.driver_number ?? null;

  const lapCount = new Map<number, number>();
  for (const l of allLaps) lapCount.set(l.driver_number, (lapCount.get(l.driver_number) ?? 0) + 1);
  const maxLaps = lapCount.size > 0 ? Math.max(...lapCount.values()) : 0;
  const dnf = new Set<number>();
  for (const [num, count] of lapCount) if (count < maxLaps * 0.9) dnf.add(num);

  return { fl, dnf };
}

async function flushLiveState(state: LiveState) {
  if (!state.dirty || state.latestPos.size === 0) return;
  state.dirty = false;

  const isRaceOrSprint = state.sessionType === 'RACE' || state.sessionType === 'SPRINT';
  let fl: number | null = null;
  let dnf = new Set<number>();
  if (isRaceOrSprint) ({ fl, dnf } = computeFlDnf(state));

  const drivers = await prisma.driver.findMany({
    where:  { number: { in: [...state.latestPos.keys()] } },
    select: { id: true, number: true, teamId: true },
  });

  for (const d of drivers) {
    const position = state.latestPos.get(d.number);
    if (position === undefined) continue;
    await prisma.sessionEntry.upsert({
      where:  { sessionId_driverId: { sessionId: state.sessionId, driverId: d.id } },
      update: { finishPosition: position, startPosition: state.firstPos.get(d.number) ?? 99, fastestLap: d.number === fl, dnf: dnf.has(d.number) },
      create: { sessionId: state.sessionId, driverId: d.id, teamId: d.teamId, finishPosition: position, startPosition: state.firstPos.get(d.number) ?? 99, fastestLap: d.number === fl, dnf: dnf.has(d.number) },
    });
  }

  if (isRaceOrSprint) {
    await prisma.session.update({
      where: { id: state.sessionId },
      data:  { scCount: state.scCount, vscCount: state.vscCount },
    });
  }
}

async function getToken(): Promise<string> {
  if (!API_KEY) throw new Error('OPENF1_API_KEY não definida');
  if (process.env.OPENF1_USERNAME) {
    try {
      const res = await fetch('https://api.openf1.org/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: process.env.OPENF1_USERNAME, password: API_KEY }),
      });
      if (res.ok) {
        const data = await res.json() as { access_token: string };
        return data.access_token;
      }
    } catch { /* fall through */ }
  }
  return API_KEY; // usa API key diretamente como senha MQTT
}

function startWebSocket(sessionId: number, openf1Key: number, sessionType: string, token: string) {
  const state: LiveState = {
    sessionId, openf1Key, sessionType,
    firstPos: new Map(), latestPos: new Map(),
    lapsByDriver: new Map(),
    scCount: 0, vscCount: 0,
    dirty: false,
  };
  liveStates.set(sessionId, state);

  const client = mqtt.connect(MQTT_URL, {
    username:        OPENF1_USERNAME,
    password:        token,
    reconnectPeriod: 5_000,
    clean:           true,
  });

  client.on('connect', () => {
    console.log(`\n🟢 WS conectado: ${sessionType} (key=${openf1Key})`);
    client.subscribe('v1/position', { qos: 0 });
    if (sessionType === 'RACE' || sessionType === 'SPRINT') {
      client.subscribe('v1/laps', { qos: 0 });
      client.subscribe('v1/race_control_events', { qos: 0 });
    }
  });

  client.on('message', (topic, payload) => {
    try {
      const msg = JSON.parse(payload.toString());
      if (msg.session_key !== openf1Key) return;

      if (topic === 'v1/position') {
        const p = msg as OF1Position;
        if (!state.firstPos.has(p.driver_number)) state.firstPos.set(p.driver_number, p.position);
        state.latestPos.set(p.driver_number, p.position);
        state.dirty = true;
      } else if (topic === 'v1/laps') {
        const l = msg as OF1Lap;
        if (!state.lapsByDriver.has(l.driver_number)) state.lapsByDriver.set(l.driver_number, []);
        state.lapsByDriver.get(l.driver_number)!.push(l);
        state.dirty = true;
      } else if (topic === 'v1/race_control_events') {
        const e = msg as OF1RaceControl;
        if (!e.message.includes('DEPLOYED')) return;
        if (e.lap_number !== null && e.lap_number <= 1) return;
        if (e.message === 'SAFETY CAR DEPLOYED')   state.scCount++;
        else if (e.message === 'VSC DEPLOYED')      state.vscCount++;
        state.dirty = true;
      }
    } catch { /* ignora mensagens malformadas */ }
  });

  client.on('error', (err) => {
    process.stderr.write(`\n⚠️  WS erro (${sessionType}): ${err.message}\n`);
  });

  // Flush para o DB a cada 5s
  const flushTimer = setInterval(async () => {
    try { await flushLiveState(state); } catch (e) {
      process.stderr.write(`\n⚠️  Flush erro: ${(e as Error).message}\n`);
    }
  }, DB_FLUSH_INTERVAL_MS);

  client.on('close', () => {
    clearInterval(flushTimer);
    liveStates.delete(sessionId);
  });

  return client;
}

function stopWebSocket(sessionId: number) {
  const client = activeSockets.get(sessionId);
  if (!client) return;
  client.end(true);
  activeSockets.delete(sessionId);
  console.log(`\n🔴 WS encerrado: sessionId=${sessionId}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
  console.log('🔴 Live sync iniciado (WebSocket + REST)\n');

  if (!API_KEY) { console.error('❌ OPENF1_API_KEY não definida no .env'); process.exit(1); }

  let token = await getToken();

  // Renova token a cada 50 minutos (válido por 1h)
  setInterval(async () => {
    try { token = await getToken(); } catch { /* mantém o atual */ }
  }, 50 * 60 * 1000);

  while (true) {
    const now    = new Date();
    const cutoff = new Date(now.getTime() - COOLING_DOWN_DURATION_MS);

    const sessions = await prisma.session.findMany({
      where:   { openf1Key: { not: null }, cancelled: false, date: { gte: cutoff } },
      include: { grandPrix: true },
      orderBy: { date: 'asc' },
    });

    const activeSess   = sessions.filter(s => getState(s.date, s.type, now) === 'active');
    const coolingDown  = sessions.filter(s =>
      getState(s.date, s.type, now) === 'cooling_down' && needsCoolingPoll(s.id, now)
    );

    // ── Conectar WebSocket para novas sessões ativas ───────────────────────────
    for (const s of activeSess) {
      if (!activeSockets.has(s.id)) {
        const client = startWebSocket(s.id, s.openf1Key!, s.type, token);
        activeSockets.set(s.id, client);
      }
    }

    // ── Desconectar WebSocket de sessões que não são mais ativas ──────────────
    for (const [sid] of activeSockets) {
      if (!activeSess.find(s => s.id === sid)) stopWebSocket(sid);
    }

    // ── Status das conexões ativas ─────────────────────────────────────────────
    if (activeSockets.size > 0) {
      const labels = activeSess.map(s => `${s.type} ${s.grandPrix.name}`).join(', ');
      process.stdout.write(`\r🟢 WS ativo: ${labels}    `);
    }

    // ── Cooling down: poll REST ───────────────────────────────────────────────
    for (const s of coolingDown) {
      const daysLeft = Math.ceil((s.date.getTime() + COOLING_DOWN_DURATION_MS - now.getTime()) / 86_400_000);
      try {
        const n = await syncSessionREST(s.id, s.openf1Key!, s.type);
        lastSync.set(s.id, now);
        console.log(`\n[${now.toISOString().slice(0, 19)}] cooling_down ${s.type} ${s.grandPrix.name} — ${n} atualizações (${daysLeft}d restante(s))`);
      } catch (e) {
        console.error(`\n⚠️  cooling_down ${s.id}: ${(e as Error).message}`);
      }
    }

    // ── Idle ──────────────────────────────────────────────────────────────────
    if (activeSockets.size === 0 && coolingDown.length === 0) {
      const next = sessions.find(s => getState(s.date, s.type, now) === 'upcoming');
      if (next) {
        const mins = Math.round((next.date.getTime() - now.getTime()) / 60_000);
        process.stdout.write(`\r⏳ Próxima: ${next.type} ${next.grandPrix.name} em ${mins}min    `);
      } else {
        process.stdout.write(`\r💤 Sem sessões no radar    `);
      }
    }

    await sleep(LOOP_INTERVAL_MS);
  }
}

main()
  .catch((e) => { console.error('❌ Erro fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect() as Promise<void>);
