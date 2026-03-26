import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

export async function getAuthSession() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return session as Session & { user: Session['user'] & { id: string; role: string; username?: string | null } };
}

export async function getAuthUserId(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return parseInt(session.user.id, 10);
}

export function getDisplayUsername(session: { user?: { username?: string | null; name?: string | null } | null }) {
  return session?.user?.username || session?.user?.name || 'User';
}
