import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ProfileClient } from './ProfileClient';

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = parseInt(session.user.id, 10);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, username: true },
  });

  if (!user) redirect('/login');

  const displayUsername = (session.user as any).username || session.user.name || 'User';

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={displayUsername} isAdmin={(session.user as any).role === 'ADMIN'} />
      <main className="pt-6 pb-40 md:pb-12 px-6 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          <ProfileClient name={user.name} email={user.email} username={user.username} />
        </div>
      </main>
    </div>
  );
}
