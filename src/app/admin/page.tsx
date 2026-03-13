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

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar username={currentUsername} isAdmin />
      <main className="pt-6 pb-40 md:pb-12 px-6 lg:px-12 flex flex-col items-center">
        <div className="w-full max-w-5xl">
          <AdminClient configData={configData} />
        </div>
      </main>
    </div>
  );
}
