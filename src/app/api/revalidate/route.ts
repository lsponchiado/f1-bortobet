import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  revalidateTag('results');
  revalidateTag('ranking');
  revalidateTag('gps');
  revalidateTag('drivers');

  return NextResponse.json({ revalidated: true });
}
