import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Sync Worker
 *
 * Traduz dados consolidados do OpenF1 (MongoDB) para o Bortobet (PostgreSQL).
 *
 * 1. Escuta MQTT para saber quando sessões iniciam/terminam (tempo real)
 * 2. A cada 6h, confere se o PostgreSQL bate com o MongoDB e corrige (periódico)
 *
 * Eventos MQTT:
 *   - Sessão iniciada  → aplica apostas backup
 *   - Sessão finalizada → sincroniza resultados, safety cars, fastest lap
 *   - Drivers atualizado → sincroniza pilotos e equipes
 *
 * Uso:
 *   npm run dev   (watch mode)
 *   npm run start (produção)
 */

import { MongoClient, type Db } from 'mongodb';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import mqtt from 'mqtt';
import { applyBackupsForSession } from './backups.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MONGO_URI = process.env.OPENF1_MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.OPENF1_MONGO_DB || 'openf1-livetiming';
const MQTT_BROKER = process.env.OPENF1_MQTT_BROKER || 'mqtt://localhost:1883';
const MQTT_USER = process.env.OPENF1_MQTT_USER || 'openf1';
const MQTT_PASS = process.env.OPENF1_MQTT_PASS || 'openf1';

let db: Db;

// ── Mapear SessionType do OpenF1 → Bortobet ──────────────────────────────────

const SESSION_TYPE_MAP: Record<string, string> = {
  'Race': 'RACE',
  'Sprint': 'SPRINT',
  'Qualifying': 'QUALIFYING',
  'Sprint Qualifying': 'SPRINT_QUALIFYING',
  'Sprint Shootout': 'SPRINT_QUALIFYING',
  'Practice 1': 'PRACTICE_1',
  'Practice 2': 'PRACTICE_2',
  'Practice 3': 'PRACTICE_3',
};

// ── Sincronização de pilotos e equipes ───────────────────────────────────────

async function syncDrivers(sessionKey?: number) {
  const filter = sessionKey ? { session_key: sessionKey } : {};
  const drivers = await db.collection('drivers').find(filter).toArray();

  // Deduplica por driver_number (pega o mais recente)
  const driverMap = new Map<number, typeof drivers[0]>();
  for (const d of drivers) {
    if (!d.driver_number || !d.name_acronym) continue;
    driverMap.set(d.driver_number, d);
  }

  let synced = 0;
  for (const d of driverMap.values()) {
    // Upsert equipe pelo nome
    const teamName = d.team_name || 'Unknown';
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: { color: `#${d.team_colour || 'FFFFFF'}` },
      create: {
        name: teamName,
        color: `#${d.team_colour || 'FFFFFF'}`,
        country: '',
      },
    });

    // Upsert piloto
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

  console.log(`[sync] ${synced} pilotos sincronizados`);
}

// ── Sincronização de resultados de sessão ────────────────────────────────────

async function syncSessionResults(sessionKey: number) {
  // Buscar sessão no Bortobet pelo openf1Key
  const session = await prisma.session.findUnique({
    where: { openf1Key: sessionKey },
    include: { season: true },
  });

  if (!session) {
    console.log(`[sync] Sessão ${sessionKey} não mapeada no Bortobet, ignorando`);
    return;
  }

  // Buscar resultados finais no MongoDB
  const results = await db.collection('session_result')
    .find({ session_key: sessionKey })
    .toArray();

  if (results.length === 0) {
    console.log(`[sync] Sem resultados para sessão ${sessionKey}`);
    return;
  }

  // Buscar starting grid — para corrida/sprint, buscar na qualifying correspondente
  const startPositionMap = new Map<number, number>();

  // Primeiro tenta o próprio session_key
  let startingGrid = await db.collection('starting_grid')
    .find({ session_key: sessionKey })
    .toArray();

  // Se não encontrou e é corrida/sprint, buscar a qualifying do mesmo meeting
  if (startingGrid.length === 0) {
    const thisSession = await db.collection('sessions')
      .findOne({ session_key: sessionKey });

    if (thisSession?.meeting_key) {
      const qualType = session.type === 'SPRINT' ? 'Sprint Qualifying' : 'Qualifying';
      const qualSession = await db.collection('sessions')
        .findOne({ meeting_key: thisSession.meeting_key, session_name: qualType });

      if (qualSession) {
        startingGrid = await db.collection('starting_grid')
          .find({ session_key: qualSession.session_key })
          .toArray();
      }
    }
  }

  for (const g of startingGrid) {
    if (g.driver_number && g.position) {
      startPositionMap.set(g.driver_number, g.position);
    }
  }

  // Buscar todas as voltas com tempo válido
  const laps = await db.collection('laps')
    .find({ session_key: sessionKey, lap_duration: { $ne: null } })
    .toArray();

  // Melhor volta de cada piloto
  const bestLapMap = new Map<number, number>();
  for (const l of laps) {
    if (!l.driver_number || !l.lap_duration) continue;
    const current = bestLapMap.get(l.driver_number);
    if (!current || l.lap_duration < current) {
      bestLapMap.set(l.driver_number, l.lap_duration);
    }
  }

  // Fastest lap geral (quem fez a volta mais rápida da sessão)
  const sortedLaps = [...laps].sort((a, b) => (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity));
  const fastestLapDriverNumber = sortedLaps[0]?.driver_number || null;

  // Buscar safety cars do race_control
  const raceControlMsgs = await db.collection('race_control')
    .find({
      session_key: sessionKey,
      category: 'SafetyCar',
    })
    .toArray();

  let scCount = 0;
  let vscCount = 0;
  for (const msg of raceControlMsgs) {
    const message = (msg.message || '').toLowerCase();
    if (message.includes('virtual safety car')) {
      vscCount++;
    } else if (message.includes('safety car')) {
      scCount++;
    }
  }

  // Contar apenas deploys (não ends)
  // SC messages come in pairs: "SAFETY CAR DEPLOYED" + "SAFETY CAR IN THIS LAP"
  scCount = raceControlMsgs.filter(m =>
    (m.message || '').toLowerCase().includes('deployed') &&
    !(m.message || '').toLowerCase().includes('virtual')
  ).length;

  vscCount = raceControlMsgs.filter(m =>
    (m.message || '').toLowerCase().includes('virtual') &&
    (m.message || '').toLowerCase().includes('deployed')
  ).length;

  // Atualizar contadores de SC na sessão
  await prisma.session.update({
    where: { id: session.id },
    data: { scCount, vscCount },
  });

  // Buscar stints (pneus) por piloto
  const stints = await db.collection('stints')
    .find({ session_key: sessionKey })
    .sort({ stint_number: 1 })
    .toArray();

  // Formato: "COMPOUND:LAPS" (ex: "MEDIUM:18")
  const stintMap = new Map<number, string[]>();
  for (const s of stints) {
    if (!s.driver_number || !s.compound) continue;
    if (!stintMap.has(s.driver_number)) {
      stintMap.set(s.driver_number, []);
    }
    const compound = (s.compound as string).toUpperCase();
    const lapStart = s.lap_start ?? 0;
    const lapEnd = s.lap_end ?? lapStart;
    const laps = lapEnd - lapStart + 1;
    stintMap.get(s.driver_number)!.push(`${compound}:${laps}`);
  }

  // Buscar intervals finais (último registro por piloto)
  const intervals = await db.collection('intervals')
    .find({ session_key: sessionKey })
    .sort({ date: -1 })
    .toArray();

  // Deduplica: pega o mais recente por driver_number
  const intervalMap = new Map<number, { gap_to_leader: unknown; interval: unknown }>();
  for (const i of intervals) {
    if (i.driver_number && !intervalMap.has(i.driver_number)) {
      intervalMap.set(i.driver_number, { gap_to_leader: i.gap_to_leader, interval: i.interval });
    }
  }

  // Mapear driver_number → Driver do Bortobet
  const allDrivers = await prisma.driver.findMany();
  const driverByNumber = new Map(allDrivers.map(d => [d.number, d]));

  // Upsert cada resultado
  let synced = 0;
  for (const r of results) {
    const driver = driverByNumber.get(r.driver_number);
    if (!driver) {
      console.warn(`[sync] Piloto #${r.driver_number} não encontrado no Bortobet`);
      continue;
    }

    const isFastestLap = r.driver_number === fastestLapDriverNumber;
    const startPos = startPositionMap.get(r.driver_number) ?? 99;

    // Parsear gaps — podem ser number ou string tipo "+1:23.456" ou "LAP"
    const gaps = intervalMap.get(r.driver_number);
    const parseGap = (val: unknown): number | null => {
      if (val == null) return null;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        if (val === 'LAP' || val === '') return null;
        const cleaned = val.replace('+', '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    const gapToLeader = parseGap(gaps?.gap_to_leader);
    const interval = parseGap(gaps?.interval);
    const bestLapTime = bestLapMap.get(r.driver_number) ?? null;
    const tireStints = stintMap.get(r.driver_number) ?? [];

    await prisma.sessionEntry.upsert({
      where: {
        sessionId_driverId: {
          sessionId: session.id,
          driverId: driver.id,
        },
      },
      update: {
        startPosition: startPos,
        finishPosition: r.position ?? 99,
        points: r.points ?? 0,
        dnf: r.dnf === true,
        dns: r.dns === true,
        dsq: r.dsq === true,
        fastestLap: isFastestLap,
        bestLapTime,
        teamId: driver.teamId,
        gapToLeader,
        interval,
        tireStints,
      },
      create: {
        sessionId: session.id,
        driverId: driver.id,
        teamId: driver.teamId,
        startPosition: startPos,
        finishPosition: r.position ?? 99,
        points: r.points ?? 0,
        dnf: r.dnf === true,
        dns: r.dns === true,
        dsq: r.dsq === true,
        fastestLap: isFastestLap,
        bestLapTime,
        gapToLeader,
        interval,
        tireStints,
      },
    });

    synced++;
  }

  console.log(`[sync] Sessão ${sessionKey}: ${synced} resultados, ${scCount} SC, ${vscCount} VSC`);
}

// ── Mapeamento automático de openf1Key ───────────────────────────────────────

async function syncOpenF1Keys() {
  // Buscar sessões do Bortobet sem openf1Key
  const unmapped = await prisma.session.findMany({
    where: { openf1Key: null },
    include: { grandPrix: true, season: true },
  });

  if (unmapped.length === 0) {
    console.log('[sync] Todas as sessões já têm openf1Key');
    return;
  }

  // Buscar sessões do OpenF1 do ano correspondente
  const years = [...new Set(unmapped.map(s => s.season.year))];
  const openf1Sessions = await db.collection('sessions')
    .find({ year: { $in: years } })
    .toArray();

  let mapped = 0;
  for (const session of unmapped) {
    const bortobetType = session.type;
    const gpName = session.grandPrix.name.toLowerCase();

    // Mapear tipo do Bortobet → session_name do OpenF1 (após normalização)
    // O schedule.py normaliza: Sprint→(type:Race,name:Sprint), Sprint Qualifying→(type:Qualifying,name:Sprint Qualifying)
    const openf1NameMap: Record<string, string[]> = {
      'RACE': ['Race'],
      'SPRINT': ['Sprint'],
      'QUALIFYING': ['Qualifying'],
      'SPRINT_QUALIFYING': ['Sprint Qualifying', 'Sprint Shootout'],
      'PRACTICE_1': ['Practice 1'],
      'PRACTICE_2': ['Practice 2'],
      'PRACTICE_3': ['Practice 3'],
    };

    const validNames = openf1NameMap[bortobetType] || [];

    // Encontrar match por nome do GP (parcial) + session_name + ano
    const match = openf1Sessions.find(o => {
      const oSessionName = o.session_name || '';
      const oLocation = (o.location || '').toLowerCase();
      return (
        o.year === session.season.year &&
        validNames.includes(oSessionName) &&
        (gpName.includes(oLocation) || oLocation.includes(gpName))
      );
    });

    if (match && match.session_key) {
      // Verificar se o session_key já não está usado por outra sessão
      const existing = await prisma.session.findUnique({
        where: { openf1Key: match.session_key },
      });

      if (!existing) {
        await prisma.session.update({
          where: { id: session.id },
          data: { openf1Key: match.session_key },
        });
        console.log(`[sync] Mapeado: ${session.grandPrix.name} ${bortobetType} → openf1Key ${match.session_key}`);
        mapped++;
      }
    }
  }

  console.log(`[sync] ${mapped}/${unmapped.length} sessões mapeadas com openf1Key`);
}

// ── Handlers de eventos MQTT ─────────────────────────────────────────────────

async function onSessionStarted(sessionKey: number) {
  console.log(`[sync] Sessão iniciada: ${sessionKey}`);

  const session = await prisma.session.findUnique({
    where: { openf1Key: sessionKey },
  });

  if (!session) {
    console.log(`[sync] Sessão ${sessionKey} não mapeada, ignorando backups`);
    return;
  }

  const applied = await applyBackupsForSession(session.id);
  console.log(`[sync] ${applied} backup(s) aplicado(s) para sessão ${session.id}`);
}

async function onSessionEnded(sessionKey: number) {
  console.log(`[sync] Sessão encerrada: ${sessionKey}`);

  // Aguarda 30s para garantir que os dados finais estejam no MongoDB
  await new Promise(resolve => setTimeout(resolve, 30_000));

  await syncSessionResults(sessionKey);
}

// ── MQTT ─────────────────────────────────────────────────────────────────────

const mqttClient = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USER,
  password: MQTT_PASS,
});

mqttClient.on('connect', () => {
  console.log(`[sync] Conectado ao MQTT broker: ${MQTT_BROKER}`);

  const topics = ['v1/session', 'v1/drivers', 'v1/race_control'];
  mqttClient.subscribe(topics, (err) => {
    if (err) {
      console.error('[sync] Erro ao inscrever:', err);
    } else {
      console.log(`[sync] Inscrito em: ${topics.join(', ')}`);
    }
  });
});

mqttClient.on('message', async (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());

    if (topic === 'v1/session') {
      const sessionKey = data.session_key;
      if (!sessionKey) return;

      // SessionData status: Started, Finalised, Ends
      const status = (data.status || data.session_status || '').toLowerCase();

      if (status === 'started') {
        await onSessionStarted(sessionKey);
      } else if (status === 'finalised' || status === 'ends') {
        await onSessionEnded(sessionKey);
      }
    }

    if (topic === 'v1/drivers') {
      const sessionKey = data.session_key;
      await syncDrivers(sessionKey);
    }
  } catch (err) {
    console.error('[sync] Erro ao processar mensagem:', err);
  }
});

mqttClient.on('error', (err) => {
  console.error('[sync] Erro MQTT:', err);
});

mqttClient.on('offline', () => {
  console.warn('[sync] MQTT desconectado, reconectando...');
});

// ── Sync periódico (a cada 6h) ───────────────────────────────────────────────

const PERIODIC_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas

async function periodicSync() {
  console.log('[sync] ═══ Sync periódico iniciado ═══');

  try {
    // 1. Mapear openf1Keys de sessões novas
    await syncOpenF1Keys();

    // 2. Sync pilotos/equipes
    await syncDrivers();

    // 3. Buscar sessões passadas que precisam de verificação
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
    if (!activeSeason) {
      console.log('[sync] Nenhuma temporada ativa');
      return;
    }

    // Sessões recentes (14 dias) ou sem resultado nenhum
    const sessions = await prisma.session.findMany({
      where: {
        seasonId: activeSeason.id,
        cancelled: false,
        openf1Key: { not: null },
        date: { lt: now },
        OR: [
          { date: { gte: fourteenDaysAgo } },
          { entries: { none: {} } },
        ],
      },
      include: { grandPrix: true },
      orderBy: { date: 'asc' },
    });

    if (sessions.length === 0) {
      console.log('[sync] Nenhuma sessão para sincronizar');
      return;
    }

    console.log(`[sync] ${sessions.length} sessões para verificar`);

    let synced = 0;
    let noData = 0;
    let errors = 0;

    for (const s of sessions) {
      try {
        const hasResults = await db.collection('session_result')
          .find({ session_key: s.openf1Key }).limit(1).toArray();

        if (hasResults.length > 0) {
          await syncSessionResults(s.openf1Key!);
          synced++;
        } else {
          noData++;
          console.log(`[sync] Sessão ${s.openf1Key} (${s.grandPrix.name} ${s.type}): sem session_result no MongoDB`);
        }
      } catch (err) {
        errors++;
        console.error(`[sync] Erro na sessão ${s.openf1Key}:`, err);
      }
    }

    console.log(`[sync] ═══ Periódico: ${synced} sincronizadas, ${noData} sem dados, ${errors} erros ═══`);

    // Revalidar cache do Next.js se houve sincronização
    if (synced > 0) {
      try {
        const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          await fetch(`${appUrl}/api/revalidate`, {
            method: 'POST',
            headers: { 'x-cron-secret': cronSecret },
          });
          console.log('[sync] Cache do Next.js revalidado');
        }
      } catch (err) {
        console.warn('[sync] Falha ao revalidar cache:', err);
      }
    }
  } catch (err) {
    console.error('[sync] Erro no sync periódico:', err);
  }
}

// ── Inicialização ────────────────────────────────────────────────────────────

async function run() {
  console.log('[sync] Conectando ao MongoDB...');
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  db = mongo.db(MONGO_DB);
  console.log('[sync] Conectado ao MongoDB.');

  // Sync inicial
  await syncDrivers();
  await syncOpenF1Keys();

  // Sync periódico a cada 6 horas
  console.log('[sync] Sync periódico configurado: a cada 6h');
  await periodicSync(); // roda uma vez na inicialização
  setInterval(periodicSync, PERIODIC_INTERVAL);

  console.log('[sync] Aguardando eventos MQTT...');
}

run().catch(console.error);
