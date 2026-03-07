import { prisma } from '@/lib/prisma';
import TestClient from './TestClient';

export default async function TestPage() {
  // Busca todos os pilotos habilitados e inclui os dados da equipe
  const drivers = await prisma.driver.findMany({
    where: { enabled: true },
    include: { 
      team: true // Traz a cor, nome e logo da equipe para o card
    },
    orderBy: [
      { team: { name: 'asc' } },
      { name: 'asc' }
    ]
  });

  return <TestClient initialDrivers={drivers} />;
}