import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import crypto from 'crypto';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("❌ DATABASE_URL não encontrada");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function createBatch(category: string, count: number) {
  console.log(`⏳ Gerando ${count} códigos para: ${category}...`);
  let created = 0;

  while (created < count) {
    const code = generateInviteCode();
    try {
      await prisma.inviteCode.create({
        data: {
          code,
          category,
          used: false
        }
      });
      created++;
    } catch (e) {
      // Se der conflito de código repetido (raro), ele apenas tenta de novo
      continue;
    }
  }
}

async function main() {
  console.log('🎲 Iniciando geração de convites para 2026...');
  
  await createBatch("Haas", 20);
  await createBatch("Lance Stroll", 20);

  console.log('✅ Todos os códigos foram salvos com sucesso!');
}

main()
  .catch((e) => { console.error("❌ Erro no seed:", e); process.exit(1); })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });