import { NextRequest, NextResponse } from 'next/server';
import { applyBackupsForSession, applyBackupsForRecentSessions } from '@/lib/backups';

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId as number | undefined;

  // Modo worker: recebe sessionId específico (ex: via MQTT)
  if (sessionId) {
    const applied = await applyBackupsForSession(sessionId);
    return NextResponse.json({ sessionId, applied });
  }

  // Modo fallback: aplica para sessões recentes
  const result = await applyBackupsForRecentSessions();
  return NextResponse.json(result);
}

// Mantém GET para compatibilidade com cron existente
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET não configurado' }, { status: 500 });

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const result = await applyBackupsForRecentSessions();
  return NextResponse.json(result);
}
