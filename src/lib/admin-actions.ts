'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';

const execAsync = promisify(exec);
const CWD = process.cwd();
const TIMEOUT = 120_000; // 2 min

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if ((session.user as any).role !== 'ADMIN') redirect('/');
}

async function runScript(script: string): Promise<{ success: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(`npx tsx scripts/${script}`, {
      cwd: CWD,
      timeout: TIMEOUT,
    });
    return { success: true, output: (stdout + stderr).trim() };
  } catch (e: any) {
    const msg = (e.stderr || e.stdout || e.message || 'Erro desconhecido').trim();
    return { success: false, output: msg };
  }
}

export async function syncPaddock() {
  await requireAdmin();
  return runScript('sync-paddock.ts');
}

export async function syncResults() {
  await requireAdmin();
  return runScript('sync-results.ts');
}

export async function syncOpenF1() {
  await requireAdmin();
  return runScript('sync-openf1.ts');
}

// ── Config actions ────────────────────────────────────────────────────────────

export async function getConfigData() {
  await requireAdmin();

  const season = await prisma.season.findFirst({
    where: { isActive: true },
    include: { config: true },
  });

  const raceSessions = await prisma.session.findMany({
    where: { type: 'RACE', seasonId: season?.id },
    include: { raceConfig: true, grandPrix: true },
    orderBy: { round: 'asc' },
  });

  return { season, raceSessions };
}

export type SeasonConfigInput = {
  ptsP1: number; ptsP2: number; ptsP3: number; ptsP4: number; ptsP5: number;
  ptsP6: number; ptsP7: number; ptsP8: number; ptsP9: number; ptsP10: number;
  ptsHailMary: number; ptsUnderdog: number; ptsFreefall: number;
  ptsFastestLap: number; ptsSafetyCar: number; ptsDNF: number;
  sprintPtsP1: number; sprintPtsP2: number; sprintPtsP3: number; sprintPtsP4: number;
  sprintPtsP5: number; sprintPtsP6: number; sprintPtsP7: number; sprintPtsP8: number;
  doublePointsTokens: number;
};

export async function saveSeasonConfig(data: SeasonConfigInput) {
  await requireAdmin();
  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) return { success: false, error: 'Temporada ativa não encontrada' };

  await prisma.seasonConfig.upsert({
    where: { seasonId: season.id },
    create: { seasonId: season.id, ...data },
    update: data,
  });

  return { success: true };
}

export type RaceConfigInput = {
  allowHailMary: boolean; allowUnderdog: boolean; allowFreefall: boolean;
  allowAllIn: boolean; allowFastestLap: boolean; allowSafetyCar: boolean;
  allowDNF: boolean; allowDoublePoints: boolean;
};

export async function saveRaceConfig(sessionId: number, data: RaceConfigInput) {
  await requireAdmin();

  await prisma.raceConfig.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });

  return { success: true };
}
