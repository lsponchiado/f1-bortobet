import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as nodeCrypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateInviteCode(): string {
  return nodeCrypto.randomBytes(4).toString('hex').toUpperCase();
}

async function main() {
  console.log('🏁 [SEED] Iniciando seed...');

  // 1. Temporada 2026
  await prisma.season.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      isActive: true,
      description: "Novo Regulamento Técnico 2026"
    }
  });
  console.log('✅ Temporada 2026 criada');
  //teste

  // 2. Geração de Convites
  console.log('🎲 Gerando lotes de convites...');
  const batches = [
    { category: "HAAS" as const, count: 20 },
    { category: "STROLL" as const, count: 20 }
  ];

  for (const batch of batches) {
    let created = 0;
    while (created < batch.count) {
      const code = generateInviteCode();
      try {
        await prisma.inviteCode.create({ data: { code, category: batch.category, used: false } });
        created++;
      } catch (e) { continue; }
    }
    console.log(`✅ ${batch.count} convites gerados para ${batch.category}`);
  }

  console.log('\n🏁 [SEED] Pronto! Rode agora: npm run sync:f1');
  console.log('   Isso vai importar equipes, pilotos, GPs e sessões da Open F1.\n');
}

/*
  ── DADOS LEGADOS (substituídos pelo sync:f1) ────────────────────────────────

  Os blocos abaixo criavam equipes, pilotos e calendário manualmente.
  Foram comentados porque agora tudo vem da Open F1 via `npm run sync:f1`.

  Para restaurar os dados hardcoded (ex: testes offline), descomente os blocos
  "2. Equipes e Pilotos" e "3. Calendário 2026" do commit anterior.

  ─────────────────────────────────────────────────────────────────────────────
*/

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
