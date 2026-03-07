import { headers } from 'next/headers';
import { prisma } from "@/lib/prisma";
import { DriverCard } from "@/components/DriverCard";

export default async function TestDriversPage() {
  const driver = await prisma.driver.findFirst({ include: { team: true } });
  
  // A MUDANÇA ESTÁ AQUI: Adicione o 'await' antes de headers()
  const headersList = await headers(); 
  const deviceType = headersList.get('x-device-type');
  const isMobile = deviceType === 'mobile';

  if (!driver) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
      <DriverCard driver={driver} isMobile={isMobile} />
    </main>
  );
}