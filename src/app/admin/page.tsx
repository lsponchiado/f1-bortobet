import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AdminClient } from './AdminClient';
import { getConfigData } from '@/lib/admin-actions';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if ((session.user as any).role !== 'ADMIN') redirect('/');

  const currentUsername = (session.user as any).username || session.user.name || 'User';
  const configData = await getConfigData();
  const allUsers = await (await import('@/lib/prisma')).prisma.user.findMany({
    select: { id: true, username: true, name: true },
    orderBy: { username: 'asc' },
  });

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={currentUsername} isAdmin />
      <main className="pt-6 pb-40 md:pb-12 px-6 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-5xl">
          <AdminClient configData={configData} allUsers={allUsers} />
        </div>
      </main>
    </div>
  );
}
