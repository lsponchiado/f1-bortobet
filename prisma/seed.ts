import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

// 1. Configuração do Driver Adapter (Necessário para o Prisma 7)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não encontrada no .env");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🏁 [SEED] Iniciando motor F1 2026 no padrão absoluto...');

  // 2. Garante a Temporada
  const season = await prisma.season.upsert({
    where: { year: 2026 },
    update: {},
    create: { year: 2026, isActive: true, description: "Regulamento 2026" }
  });

  const baseCDN = "https://media.formula1.com/image/upload/v1740000000/common/f1/2026";

  // 3. Dados das Equipes e Pilotos (11 Equipes)
  const teamsData = [
    { name: 'McLaren', color: '#FF8000', country: 'gb', slug: 'mclaren', drivers: [
      { name: 'Lando Norris', code: 'NOR', number: 1, country: 'gb', id: 'lannor01' },
      { name: 'Oscar Piastri', code: 'PIA', number: 81, country: 'au', id: 'oscpia01' }
    ]},
    { name: 'Scuderia Ferrari', color: '#F10B1D', country: 'it', slug: 'ferrari', drivers: [
      { name: 'Charles Leclerc', code: 'LEC', number: 16, country: 'mc', id: 'chalec01' },
      { name: 'Lewis Hamilton', code: 'HAM', number: 44, country: 'gb', id: 'lewham01' }
    ]},
    { name: 'Red Bull Racing', color: '#3671C6', country: 'at', slug: 'redbullracing', drivers: [
      { name: 'Max Verstappen', code: 'VER', number: 3, country: 'nl', id: 'maxver01' },
      { name: 'Isack Hadjar', code: 'HAD', number: 6, country: 'fr', id: 'isahad01' }
    ]},
    { name: 'Audi', color: '#F30D2E', country: 'de', slug: 'audi', drivers: [
      { name: 'Gabriel Bortoleto', code: 'BOR', number: 5, country: 'br', id: 'gabbor01' },
      { name: 'Nico Hulkenberg', code: 'HUL', number: 27, country: 'de', id: 'nichul01' }
    ]},
    { name: 'Mercedes', color: '#27F4D2', country: 'de', slug: 'mercedes', drivers: [
      { name: 'George Russell', code: 'RUS', number: 63, country: 'gb', id: 'georus01' },
      { name: 'Kimi Antonelli', code: 'ANT', number: 12, country: 'it', id: 'andant01' }
    ]},
    { name: 'Cadillac', color: '#FFFFFF', country: 'us', slug: 'cadillac', drivers: [
      { name: 'Sergio Perez', code: 'PER', number: 11, country: 'mx', id: 'serper01' },
      { name: 'Valtteri Bottas', code: 'BOT', number: 77, country: 'fi', id: 'valbot01' }
    ]},
    { name: 'Aston Martin', color: '#229971', country: 'gb', slug: 'astonmartin', drivers: [
      { name: 'Fernando Alonso', code: 'ALO', number: 14, country: 'es', id: 'feralo01' },
      { name: 'Lance Stroll', code: 'STR', number: 18, country: 'ca', id: 'lanstr01' }
    ]},
    { name: 'Williams Racing', color: '#00A0DE', country: 'gb', slug: 'williams', drivers: [
      { name: 'Alexander Albon', code: 'ALB', number: 23, country: 'th', id: 'alealb01' },
      { name: 'Carlos Sainz', code: 'SAI', number: 55, country: 'es', id: 'carsai01' }
    ]},
    { name: 'Alpine', color: '#0093CC', country: 'fr', slug: 'alpine', drivers: [
      { name: 'Pierre Gasly', code: 'GAS', number: 10, country: 'fr', id: 'piegas01' },
      { name: 'Franco Colapinto', code: 'COL', number: 43, country: 'ar', id: 'fracol01' }
    ]},
    { name: 'Haas', color: '#B6BABD', country: 'us', slug: 'haas', drivers: [
      { name: 'Esteban Ocon', code: 'OCO', number: 31, country: 'fr', id: 'estoco01' },
      { name: 'Oliver Bearman', code: 'BEA', number: 87, country: 'gb', id: 'olibea01' }
    ]},
    { name: 'Racing Bulls', color: '#6692FF', country: 'it', slug: 'racingbulls', drivers: [
      { name: 'Arvid Lindblad', code: 'LIN', number: 41, country: 'gb', id: 'arvlin01' },
      { name: 'Liam Lawson', code: 'LAW', number: 30, country: 'nz', id: 'lialaw01' }
    ]}
  ];

  for (const t of teamsData) {
    const team = await prisma.team.upsert({
      where: { name: t.name },
      update: { color: t.color },
      create: { 
        name: t.name, color: t.color, country: t.country,
        logoUrl: `${baseCDN}/${t.slug}/2026${t.slug}logowhite.webp`,
        carUrl: `${baseCDN}/${t.slug}/2026${t.slug}carright.webp`
      }
    });

    for (const d of t.drivers) {
      await prisma.driver.upsert({
        where: { code: d.code },
        update: { headshotUrl: `${baseCDN}/${t.slug}/${d.id}/2026${t.slug}${d.id}right.webp` },
        create: {
          name: d.name, code: d.code, number: d.number, country: d.country,
          headshotUrl: `${baseCDN}/${t.slug}/${d.id}/2026${t.slug}${d.id}right.webp`,
          teamId: team.id
        }
      });
    }
  }

  // 4. Calendário Completo (24 Rounds)
  const calendar = [
    { r: 1, n: "Australian GP", c: "au", track: "Albert Park", slug: "melbourne", q: "2026-03-07T06:00:00Z", race: "2026-03-08T05:00:00Z" },
    { r: 2, n: "Chinese GP", c: "cn", track: "Shanghai", slug: "shanghai", q: "2026-03-13T07:00:00Z", sprint: "2026-03-14T06:00:00Z", race: "2026-03-15T07:00:00Z" },
    { r: 3, n: "Japanese GP", c: "jp", track: "Suzuka", slug: "suzuka", q: "2026-03-28T06:00:00Z", race: "2026-03-29T05:00:00Z" },
    { r: 4, n: "Bahrain GP", c: "bh", track: "Sakhir", slug: "sakhir", q: "2026-04-11T16:00:00Z", race: "2026-04-12T15:00:00Z" },
    { r: 5, n: "Saudi Arabian GP", c: "sa", track: "Jeddah Corniche", slug: "jeddah", q: "2026-04-18T17:00:00Z", race: "2026-04-19T17:00:00Z" },
    { r: 6, n: "Miami GP", c: "us", track: "Miami International", slug: "miami", q: "2026-05-01T20:30:00Z", sprint: "2026-05-02T16:00:00Z", race: "2026-05-03T20:30:00Z" },
    { r: 7, n: "Canadian GP", c: "ca", track: "Gilles-Villeneuve", slug: "montreal", q: "2026-05-23T18:00:00Z", race: "2026-05-24T18:00:00Z" },
    { r: 8, n: "Monaco GP", c: "mc", track: "Circuit de Monaco", slug: "montecarlo", q: "2026-06-06T14:00:00Z", race: "2026-06-07T13:00:00Z" },
    { r: 9, n: "Spanish GP", c: "es", track: "Barcelona-Catalunya", slug: "catalunya", q: "2026-06-13T14:00:00Z", race: "2026-06-14T13:00:00Z" },
    { r: 10, n: "Austrian GP", c: "at", track: "Red Bull Ring", slug: "spielberg", q: "2026-06-26T14:00:00Z", sprint: "2026-06-27T10:00:00Z", race: "2026-06-28T13:00:00Z" },
    { r: 11, n: "British GP", c: "gb", track: "Silverstone", slug: "silverstone", q: "2026-07-04T14:00:00Z", race: "2026-07-05T14:00:00Z" },
    { r: 12, n: "Belgian GP", c: "be", track: "Spa-Francorchamps", slug: "spafrancorchamps", q: "2026-07-17T13:00:00Z", sprint: "2026-07-18T11:00:00Z", race: "2026-07-19T13:00:00Z" },
    { r: 13, n: "Hungarian GP", c: "hu", track: "Hungaroring", slug: "hungaroring", q: "2026-07-25T14:00:00Z", race: "2026-07-26T13:00:00Z" },
    { r: 14, n: "Dutch GP", c: "nl", track: "Zandvoort", slug: "zandvoort", q: "2026-08-22T13:00:00Z", race: "2026-08-23T13:00:00Z" },
    { r: 15, n: "Italian GP", c: "it", track: "Monza", slug: "monza", q: "2026-09-05T14:00:00Z", race: "2026-09-06T13:00:00Z" },
    { r: 16, n: "Spanish GP (Madrid)", c: "es", track: "IFEMA Madrid", slug: "madrid", q: "2026-09-12T14:00:00Z", race: "2026-09-13T13:00:00Z" },
    { r: 17, n: "Azerbaijan GP", c: "az", track: "Baku City", slug: "baku", q: "2026-09-25T13:00:00Z", race: "2026-09-26T11:00:00Z" },
    { r: 18, n: "Singapore GP", c: "sg", track: "Marina Bay", slug: "singapore", q: "2026-10-10T13:00:00Z", race: "2026-10-11T12:00:00Z" },
    { r: 19, n: "United States GP", c: "us", track: "COTA", slug: "austin", q: "2026-10-23T19:00:00Z", sprint: "2026-10-24T18:00:00Z", race: "2026-10-25T19:00:00Z" },
    { r: 20, n: "Mexico City GP", c: "mx", track: "Hermanos Rodríguez", slug: "mexicocity", q: "2026-10-31T20:00:00Z", race: "2026-11-01T20:00:00Z" },
    { r: 21, n: "São Paulo GP", c: "br", track: "Interlagos", slug: "interlagos", q: "2026-11-06T18:00:00Z", sprint: "2026-11-07T14:30:00Z", race: "2026-11-08T17:00:00Z" },
    { r: 22, n: "Las Vegas GP", c: "us", track: "Las Vegas Strip", slug: "lasvegas", q: "2026-11-20T07:00:00Z", race: "2026-11-21T06:00:00Z" },
    { r: 23, n: "Qatar GP", c: "qa", track: "Lusail", slug: "lusail", q: "2026-11-28T17:00:00Z", race: "2026-11-29T17:00:00Z" },
    { r: 24, n: "Abu Dhabi GP", c: "ae", track: "Yas Marina", slug: "yasmarina", q: "2026-12-05T14:00:00Z", race: "2026-12-06T13:00:00Z" }
  ];

  for (const cal of calendar) {
    const gp = await prisma.grandPrix.upsert({
      where: { name: cal.n },
      update: { trackMapUrl: `${baseCDN}/track/2026track${cal.slug}detailed.webp` },
      create: { 
        name: cal.n, country: cal.c, trackName: cal.track,
        trackMapUrl: `${baseCDN}/track/2026track${cal.slug}detailed.webp`
      }
    });

    // Cria Qualify
    await prisma.qualify.create({
      data: { round: cal.r, date: new Date(cal.q), seasonId: season.id, grandPrixId: gp.id }
    });

    // Cria Race
    await prisma.race.create({
      data: { round: cal.r, date: new Date(cal.race), seasonId: season.id, grandPrixId: gp.id }
    });

    // Se tiver Sprint, cria
    if (cal.sprint) {
      await prisma.sprint.create({
        data: { round: cal.r, date: new Date(cal.sprint), seasonId: season.id, grandPrixId: gp.id }
      });
    }
  }

  console.log('✅ [SEED] Tudo pronto no padrão absoluto TypeScript!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Importante para o processo não ficar pendurado
  });