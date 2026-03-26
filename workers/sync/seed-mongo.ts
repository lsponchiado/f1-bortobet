/**
 * Seed MongoDB — Popula o MongoDB local com dados da API pública do OpenF1.
 *
 * Uso:
 *   npx tsx seed-mongo.ts              # sincroniza 2025 e 2026
 *   npx tsx seed-mongo.ts 2026         # só 2026
 *   npx tsx seed-mongo.ts 2025 2026    # ambos
 *
 * Deve rodar no servidor onde o MongoDB está acessível em localhost:27017.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PUBLIC_API = 'https://api.openf1.org/v1';
const MONGO_URI = process.env.OPENF1_MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.OPENF1_MONGO_DB || 'openf1';

// Coleções buscadas por sessão
const SESSION_ENDPOINTS = [
  'drivers',
  'position',
  'laps',
  'stints',
  'intervals',
  'race_control',
];

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchAPI(endpoint: string, params: Record<string, string | number> = {}): Promise<any[]> {
  const url = new URL(`${PUBLIC_API}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url.toString());

      if (res.status === 429) {
        const wait = Math.pow(2, attempt + 1) * 5000;
        console.log(`    ⏳ Rate limited, aguardando ${wait / 1000}s...`);
        await delay(wait);
        continue;
      }

      if (res.status === 404) return [];
      if (!res.ok) {
        console.warn(`    ⚠ ${endpoint}: HTTP ${res.status}`);
        return [];
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      console.warn(`    ⚠ ${endpoint}: ${err.message}`);
      if (attempt < 4) await delay(3000);
    }
  }
  return [];
}

async function main() {
  const years = process.argv.slice(2).map(Number).filter(n => !isNaN(n) && n >= 2023 && n <= 2030);
  if (years.length === 0) {
    years.push(2025, 2026);
  }

  console.log(`\n🏎  seed-mongo — Anos: ${years.join(', ')}`);
  console.log(`   MongoDB: ${MONGO_URI}/${MONGO_DB}\n`);

  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db(MONGO_DB);

  let totalSessions = 0;
  let totalDocs = 0;

  for (const year of years) {
    console.log(`━━━ ${year} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // 1. Buscar lista de sessões do ano
    const sessions = await fetchAPI('sessions', { year });
    if (sessions.length === 0) {
      console.log(`  Nenhuma sessão encontrada para ${year}\n`);
      continue;
    }

    // Salvar sessões no MongoDB
    const sessionsCol = db.collection('sessions');
    for (const s of sessions) {
      await sessionsCol.updateOne(
        { session_key: s.session_key },
        { $set: s },
        { upsert: true },
      );
    }
    console.log(`  📋 ${sessions.length} sessões encontradas\n`);
    await delay(1000);

    // 2. Para cada sessão, buscar todos os endpoints
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const sk = session.session_key;
      const label = `${session.location || '???'} — ${session.session_type || session.session_name || '???'}`;

      console.log(`  [${i + 1}/${sessions.length}] ${label} (key: ${sk})`);

      let sessionDocs = 0;

      for (const endpoint of SESSION_ENDPOINTS) {
        const data = await fetchAPI(endpoint, { session_key: sk });

        if (data.length === 0) {
          await delay(500);
          continue;
        }

        const col = db.collection(endpoint);

        // Remove dados antigos desta sessão e insere os novos
        await col.deleteMany({ session_key: sk });
        // Insert em batches de 5000 para não estourar memória
        for (let j = 0; j < data.length; j += 5000) {
          const batch = data.slice(j, j + 5000);
          await col.insertMany(batch);
        }

        console.log(`    ${endpoint}: ${data.length}`);
        sessionDocs += data.length;
        totalDocs += data.length;

        await delay(2000); // Rate limiting entre endpoints
      }

      totalSessions++;

      if (sessionDocs === 0) {
        console.log(`    (sem dados disponíveis)`);
      }

      await delay(3000); // Rate limiting entre sessões
    }

    console.log('');
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Concluído! ${totalSessions} sessões, ${totalDocs} documentos inseridos`);

  // Criar índices para performance
  console.log(`\n🔧 Criando índices...`);
  for (const col of SESSION_ENDPOINTS) {
    await db.collection(col).createIndex({ session_key: 1 });
  }
  await db.collection('sessions').createIndex({ year: 1 });
  await db.collection('sessions').createIndex({ session_key: 1 }, { unique: true });
  await db.collection('drivers').createIndex({ session_key: 1, driver_number: 1 });
  await db.collection('position').createIndex({ session_key: 1, driver_number: 1 });
  await db.collection('laps').createIndex({ session_key: 1, driver_number: 1 });
  console.log(`   Índices criados.`);

  await mongo.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err);
  process.exit(1);
});
