/**
 * Sincroniza status e horários das sessões com a Open F1 API.
 *
 * A API retorna todas as sessões do ano em uma única chamada — sem paginação.
 * Por isso: 1 request por execução, roda 1x por dia.
 *
 * Escopo: apenas sessões FUTURAS (date > now) que já têm openf1Key.
 * Detecta: mudança de horário, cancelamentos (dentro de 14 dias).
 *
 * Uso: npx tsx scripts/sync-sessions.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'https://api.openf1.org/v1';

interface OF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  year: number;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json() as Promise<T>;
}

function dateChanged(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) > 2 * 60 * 1000; // > 2 minutos
}

async function main() {
  const now = new Date();

  // Usa o ano da temporada ativa, senão o ano atual
  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  const year = activeSeason?.year ?? now.getFullYear();

  console.log(`\n🏁 Sync sessions ${year} — 1 request, sessões futuras\n`);

  // ── 1 request para o ano inteiro ────────────────────────────────────────────

  const apiSessions = await fetchJSON<OF1Session[]>(`/sessions?year=${year}`);
  const apiByKey = new Map(apiSessions.map((s) => [s.session_key, s]));

  console.log(`  API retornou ${apiSessions.length} sessões para ${year}\n`);

  // ── Sessões futuras no DB com openf1Key ──────────────────────────────────────

  const dbSessions = await prisma.session.findMany({
    where: {
      openf1Key: { not: null },
      date: { gt: now },
    },
    include: { grandPrix: true },
    orderBy: { date: 'asc' },
  });

  console.log(`  ${dbSessions.length} sessão(ões) futuras com openf1Key no banco\n`);

  let updated = 0;
  let cancelled = 0;
  let unchanged = 0;

  for (const session of dbSessions) {
    const api = apiByKey.get(session.openf1Key!);

    if (!api) {
      // Não encontrada na API
      const daysUntil = (session.date.getTime() - now.getTime()) / 86_400_000;

      if (daysUntil <= 14 && !session.cancelled) {
        // Dentro de 14 dias e ausente da API → cancelada
        await prisma.session.update({
          where: { id: session.id },
          data: { cancelled: true },
        });
        console.log(`  ❌ CANCELADA: ${session.type} — ${session.grandPrix.name}`);
        cancelled++;
      } else {
        // Mais de 14 dias → API pode não ter publicado ainda, sem ação
        console.log(`  ⚠️  Sem dados ainda: ${session.type} — ${session.grandPrix.name} (em ${Math.round(daysUntil)}d)`);
      }
      continue;
    }

    const newDate = new Date(api.date_start);
    const changes: string[] = [];

    if (dateChanged(session.date, newDate)) {
      changes.push(
        `horário: ${session.date.toISOString().slice(11, 16)} → ${newDate.toISOString().slice(11, 16)} UTC`
      );
    }

    if (session.cancelled) {
      changes.push('cancelamento revertido');
    }

    if (changes.length > 0) {
      await prisma.session.update({
        where: { id: session.id },
        data: { date: newDate, cancelled: false },
      });
      console.log(`  ✏️  ${session.type} — ${session.grandPrix.name}: ${changes.join(', ')}`);
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(`\n✅ ${updated} atualizada(s), ${cancelled} cancelada(s), ${unchanged} sem alterações\n`);
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
