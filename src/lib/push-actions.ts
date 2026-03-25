'use server';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

async function getAuthUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return parseInt(session.user.id, 10);
}

export async function subscribePush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<{ success: boolean; error?: string }> {
  const userId = await getAuthUserId();

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    });

    // Ensure notification preferences exist
    await prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId, sessionReminder: false, betReminder: false },
    });

    return { success: true };
  } catch (e) {
    console.error('subscribePush error:', e);
    return { success: false, error: 'Erro ao registrar notificações.' };
  }
}

export async function unsubscribePush(endpoint: string): Promise<{ success: boolean }> {
  const userId = await getAuthUserId();

  try {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function getNotificationPreferences(): Promise<{
  sessionReminder: boolean;
  betReminder: boolean;
  hasSubscription: boolean;
}> {
  const userId = await getAuthUserId();

  const [pref, subCount] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.pushSubscription.count({ where: { userId } }),
  ]);

  return {
    sessionReminder: pref?.sessionReminder ?? false,
    betReminder: pref?.betReminder ?? false,
    hasSubscription: subCount > 0,
  };
}

export async function updateNotificationPreferences(prefs: {
  sessionReminder: boolean;
  betReminder: boolean;
}): Promise<{ success: boolean }> {
  const userId = await getAuthUserId();

  await prisma.notificationPreference.upsert({
    where: { userId },
    update: prefs,
    create: { userId, ...prefs },
  });

  return { success: true };
}

export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  const userId = await getAuthUserId();

  try {
    const { sendPushToUser } = await import('@/lib/push');
    const result = await sendPushToUser(userId, {
      title: 'Teste de Notificação',
      body: 'Se você está vendo isso, as notificações estão funcionando!',
      url: '/perfil',
    });
    return { success: result.sent > 0 };
  } catch (e) {
    console.error('sendTestNotification error:', e);
    return { success: false, error: 'Erro ao enviar notificação de teste.' };
  }
}
