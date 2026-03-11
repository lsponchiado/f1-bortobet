import 'dotenv/config';

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Esta é a linha que estava faltando:
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};