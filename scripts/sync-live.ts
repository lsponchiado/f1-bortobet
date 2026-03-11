/**
 * Polling de posições ao vivo com frequência adaptativa por estado da sessão:
 *
 *   UPCOMING      → ignora (sessão ainda não começou)
 *   ACTIVE        → poll a cada 10s
 *   COOLING_DOWN  → poll 1x por hora, por 7 dias (resultados finais / correções de stewards)
 *   ARCHIVED      → nunca mais
 *
 * Uso: npx tsx scripts/sync-live.ts
 */

import 'dotenv/config';
import { PrismaClient, SessionType } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'https://api.openf1.org/v1';

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

const COOLING_DOWN_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const COOLING_DOWN_INTERVAL_MS = 60 * 60 * 1000;           // 1h entre polls

// ─── Estado por sessão ───────────────────────────────────────────────────────

type SessionState = 'upcoming' | 'active' | 'cooling_down' | 'archived';

// lastSync por sessionId — em memória (reseta no restart, o que é intencional)
const lastSync = new Map<number, Date>();

function getState(sessionDate: Date, sessionType: string, now: Date): SessionState {
  const duration = SESSION_DURATION_MS[sessionType] ?? 3 * 60 * 60 * 1000;
  const activeEnd   = new Date(sessionDate.getTime() + duration);
  const archiveDate = new Date(sessionDate.getTime() + COOLING_DOWN_DURATION_MS);

  if (now < sessionDate) return 'upcoming';
  if (now <= activeEnd)  return 'active';
  if (now <= archiveDate) return 'cooling_down';
  return 'archived';
}

function needsCoolingPoll(sessionId: number, now: Date): boolean {
  const last = lastSync.get(sessionId);
  if (!last) return true; // nunca sincronizado → poll imediato
  return now.getTime() - last.getTime() >= COOLING_DOWN_INTERVAL_MS;
}

// ─── Open F1 ─────────────────────────────────────────────────────────────────

interface OF1Position {
  session_key: number;
  driver_number: number;
  date: string;
  position: number;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function syncPositions(
  sessionId: number,
  openf1Key: number,
  since: Date
): Promise<number> {
  const sinceIso = encodeURIComponent(since.toISOString());
  const raw = await fetchJSON<OF1Position[]>(
    `/position?session_key=${openf1Key}&date%3E=${sinceIso}`
  );

  if (raw.length === 0) return 0;

  // Última posição por piloto
  const latest = new Map<number, number>();
  for (const p of raw.sort((a, b) => a.date.localeCompare(b.date))) {
    latest.set(p.driver_number, p.position);
  }

  const drivers = await prisma.driver.findMany({
    where: { number: { in: [...latest.keys()] } },
    select: { id: true, number: true, teamId: true },
  });

  let updated = 0;
  for (const d of drivers) {
    const position = latest.get(d.number);
    if (position === undefined) continue;
    await prisma.sessionEntry.upsert({
      where: { sessionId_driverId: { sessionId, driverId: d.id } },
      update: { finishPosition: position },
      create: { sessionId, driverId: d.id, teamId: d.teamId, finishPosition: position },
    });
    updated++;
  }

  return updated;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('🔴 Live sync iniciado\n');

  while (true) {
    const now = new Date();

    // Busca sessões com openf1Key que ainda não foram arquivadas
    const cutoff = new Date(now.getTime() - COOLING_DOWN_DURATION_MS);
    const sessions = await prisma.session.findMany({
      where: { openf1Key: { not: null }, cancelled: false, date: { gte: cutoff } },
      include: { grandPrix: true },
      orderBy: { date: 'asc' },
    });

    const active       = sessions.filter(s => getState(s.date, s.type, now) === 'active');
    const coolingDown  = sessions.filter(s =>
      getState(s.date, s.type, now) === 'cooling_down' && needsCoolingPoll(s.id, now)
    );

    // ── ACTIVE: poll a cada 10s ───────────────────────────────────────────────
    if (active.length > 0) {
      for (const s of active) {
        const since = lastSync.get(s.id) ?? new Date(0);
        try {
          const n = await syncPositions(s.id, s.openf1Key!, since);
          lastSync.set(s.id, now);
          process.stdout.write(
            `\r[${now.toISOString().slice(11, 19)}] ${s.type} ${s.grandPrix.name} — ${n} atualizações    `
          );
        } catch (e) {
          process.stdout.write(`\r⚠️  Erro: ${(e as Error).message}                          `);
        }
      }
      await sleep(10_000);
      continue;
    }

    // ── COOLING DOWN: 1x por hora ─────────────────────────────────────────────
    if (coolingDown.length > 0) {
      for (const s of coolingDown) {
        const since = lastSync.get(s.id) ?? new Date(0);
        const daysLeft = Math.ceil(
          (s.date.getTime() + COOLING_DOWN_DURATION_MS - now.getTime()) / 86_400_000
        );
        try {
          const n = await syncPositions(s.id, s.openf1Key!, since);
          lastSync.set(s.id, now);
          console.log(
            `[${now.toISOString().slice(0, 19)}] cooling_down ${s.type} ${s.grandPrix.name}` +
            ` — ${n} atualizações (${daysLeft}d restante(s))`
          );
        } catch (e) {
          console.error(`⚠️  Erro cooling_down ${s.id}: ${(e as Error).message}`);
        }
      }
      await sleep(60_000);
      continue;
    }

    // ── IDLE: sem nada a fazer ────────────────────────────────────────────────
    const nextActive = sessions.find(s => getState(s.date, s.type, now) === 'upcoming');
    if (nextActive) {
      const minsUntil = Math.round((nextActive.date.getTime() - now.getTime()) / 60_000);
      process.stdout.write(`\r⏳ Próxima sessão: ${nextActive.type} ${nextActive.grandPrix.name} em ${minsUntil}min    `);
    } else {
      process.stdout.write(`\r💤 Sem sessões ativas ou futuras no radar                         `);
    }
    await sleep(60_000);
  }
}

main()
  .catch((e) => { console.error('❌ Erro fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
