// @ts-expect-error — web-push lacks type declarations
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@bortobet.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || '',
  );
  vapidConfigured = true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  ensureVapid();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendPushToUsers(userIds: number[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { sent: totalSent, failed: totalFailed };
}
