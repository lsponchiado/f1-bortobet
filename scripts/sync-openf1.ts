/**
 * Sincroniza pilotos, equipes, GPs e sessões com a Open F1 API.
 * Uso: npx tsx scripts/sync-openf1.ts [ano]
 * Exemplo: npx tsx scripts/sync-openf1.ts 2026
 */

import { SessionType } from '@prisma/client';
import { prisma } from './_client';
import * as isoCountries from 'i18n-iso-countries';

const BASE_URL = 'https://api.openf1.org/v1';

// ─── Tipos Open F1 ───────────────────────────────────────────────────────────

interface OF1Meeting {
  meeting_key: number;
  meeting_name: string;
  location: string;
  country_name: string;
  country_code: string;
  circuit_short_name: string;
  year: number;
  date_start: string;
}

interface OF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  meeting_key: number;
}

interface OF1Driver {
  driver_number: number;
  first_name: string;
  last_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  country_code: string;
  headshot_url: string | null;
  session_key: number;
  meeting_key: number;
}

// ─── CDN F1 ──────────────────────────────────────────────────────────────────

const CDN = 'https://media.formula1.com/image/upload/v1740000000/common/f1/2026';

// Slug usado no CDN da F1, indexado pelo team_name que a Open F1 retorna
const TEAM_SLUGS: Record<string, string> = {
  'McLaren':                    'mclaren',
  'Scuderia Ferrari':           'ferrari',
  'Red Bull Racing':            'redbullracing',
  'Audi F1 Team':               'audi',
  'Mercedes':                   'mercedes',
  'MoneyGram Haas F1 Team':    'haas',
  'Haas F1 Team':               'haas',
  'Aston Martin Aramco F1 Team':'astonmartin',
  'Williams Racing':            'williams',
  'BWT Alpine F1 Team':         'alpine',
  'Visa Cash App Racing Bulls': 'racingbulls',
  'Racing Bulls':               'racingbulls',
  'Cadillac F1 Team':           'cadillac',
};

// Slug usado no CDN da F1, indexado pelo meeting_name que a Open F1 retorna
const TRACK_SLUGS: Record<string, string> = {
  'Australian Grand Prix':   'melbourne',
  'Chinese Grand Prix':      'shanghai',
  'Japanese Grand Prix':     'suzuka',
  'Bahrain Grand Prix':      'sakhir',
  'Saudi Arabian Grand Prix':'jeddah',
  'Miami Grand Prix':        'miami',
  'Canadian Grand Prix':     'montreal',
  'Monaco Grand Prix':       'montecarlo',
  'Barcelona Grand Prix':    'catalunya',
  'Spanish Grand Prix':      'catalunya',
  'Austrian Grand Prix':     'spielberg',
  'British Grand Prix':      'silverstone',
  'Belgian Grand Prix':      'spafrancorchamps',
  'Hungarian Grand Prix':    'hungaroring',
  'Dutch Grand Prix':        'zandvoort',
  'Italian Grand Prix':      'monza',
  'Madrid Grand Prix':       'madrid',
  'Azerbaijan Grand Prix':   'baku',
  'Singapore Grand Prix':    'singapore',
  'United States Grand Prix':'austin',
  'Mexico City Grand Prix':  'mexicocity',
  'São Paulo Grand Prix':    'interlagos',
  'Las Vegas Grand Prix':    'lasvegas',
  'Qatar Grand Prix':        'lusail',
  'Abu Dhabi Grand Prix':    'yasmarina',
};

// Mapeamento completo do grid 2026 por acronym (estável e independente do nome da equipe na API)
// Para substitutos/pilotos desconhecidos, o script usa fallback algorítmico
const DRIVER_CDN: Record<string, { imgId: string; teamSlug: string; country: string }> = {
  'NOR': { imgId: 'lannor01', teamSlug: 'mclaren',       country: 'gb' },
  'PIA': { imgId: 'oscpia01', teamSlug: 'mclaren',       country: 'au' },
  'LEC': { imgId: 'chalec01', teamSlug: 'ferrari',       country: 'mc' },
  'HAM': { imgId: 'lewham01', teamSlug: 'ferrari',       country: 'gb' },
  'VER': { imgId: 'maxver01', teamSlug: 'redbullracing', country: 'nl' },
  'HAD': { imgId: 'isahad01', teamSlug: 'redbullracing', country: 'fr' },
  'BOR': { imgId: 'gabbor01', teamSlug: 'audi',          country: 'br' },
  'HUL': { imgId: 'nichul01', teamSlug: 'audi',          country: 'de' },
  'RUS': { imgId: 'georus01', teamSlug: 'mercedes',      country: 'gb' },
  'ANT': { imgId: 'andant01', teamSlug: 'mercedes',      country: 'it' },
  'PER': { imgId: 'serper01', teamSlug: 'cadillac',      country: 'mx' },
  'BOT': { imgId: 'valbot01', teamSlug: 'cadillac',      country: 'fi' },
  'ALO': { imgId: 'feralo01', teamSlug: 'astonmartin',   country: 'es' },
  'STR': { imgId: 'lanstr01', teamSlug: 'astonmartin',   country: 'ca' },
  'ALB': { imgId: 'alealb01', teamSlug: 'williams',      country: 'th' },
  'SAI': { imgId: 'carsai01', teamSlug: 'williams',      country: 'es' },
  'GAS': { imgId: 'piegas01', teamSlug: 'alpine',        country: 'fr' },
  'COL': { imgId: 'fracol01', teamSlug: 'alpine',        country: 'ar' },
  'OCO': { imgId: 'estoco01', teamSlug: 'haas',          country: 'fr' },
  'BEA': { imgId: 'olibea01', teamSlug: 'haas',          country: 'gb' },
  'LIN': { imgId: 'arvlin01', teamSlug: 'racingbulls',   country: 'gb' },
  'LAW': { imgId: 'lialaw01', teamSlug: 'racingbulls',   country: 'nz' },
};

// Converte country_code ISO-3 → ISO-2 (Open F1 retorna 3 letras para meetings)
function toIso2(code: string): string {
  if (!code) return '';
  return isoCountries.alpha3ToAlpha2(code.toUpperCase())?.toLowerCase() ?? code.toLowerCase().slice(0, 2);
}

// Fallback: gera imgId algoritmicamente para substitutos não mapeados
function driverImgIdFallback(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0].slice(0, 3).toLowerCase();
  const last = parts[parts.length - 1].slice(0, 3).toLowerCase();
  return `${first}${last}01`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJSON<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  console.log(`  → GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json() as Promise<T>;
}

function toHex(colour: string | null | undefined): string {
  if (!colour) return '#CCCCCC';
  return colour.startsWith('#') ? colour : `#${colour}`;
}

// A API 2026 retorna session_type incorreto para sessões de sprint
// (Sprint Qualifying → "Qualifying", Sprint → "Race"), então usamos session_name como chave primária
const SESSION_NAME_MAP: Record<string, SessionType> = {
  'Race':               SessionType.RACE,
  'Qualifying':         SessionType.QUALIFYING,
  'Sprint':             SessionType.SPRINT,
  'Sprint Qualifying':  SessionType.SPRINT_QUALIFYING,
  'Sprint Shootout':    SessionType.SPRINT_QUALIFYING,
  'Practice 1':         SessionType.PRACTICE_1,
  'Practice 2':         SessionType.PRACTICE_2,
  'Practice 3':         SessionType.PRACTICE_3,
};

function resolveSessionType(sessionName: string): SessionType | null {
  return SESSION_NAME_MAP[sessionName] ?? null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const year = parseInt(process.argv[2] ?? '2026', 10);
  if (isNaN(year)) {
    console.error('❌ Ano inválido. Uso: npx tsx scripts/sync-openf1.ts 2026');
    process.exit(1);
  }

  console.log(`\n🏁 Sincronizando Open F1 → ano ${year}\n`);

  // 1. Season
  const season = await prisma.season.upsert({
    where: { year },
    update: {},
    create: { year, isActive: true, description: `F1 World Championship ${year}` },
  });
  console.log(`✅ Season ${year} (id=${season.id})\n`);

  // 2. Meetings e sessions em paralelo
  const [meetings, sessions] = await Promise.all([
    fetchJSON<OF1Meeting[]>(`/meetings?year=${year}`),
    fetchJSON<OF1Session[]>(`/sessions?year=${year}`),
  ]);

  const gpMeetings = meetings.filter(
    (m) =>
      !m.meeting_name.toLowerCase().includes('pre-season') &&
      !m.meeting_name.toLowerCase().includes('testing')
  );

  console.log(`\n📋 ${gpMeetings.length} GPs / ${sessions.length} sessões encontrados\n`);

  if (gpMeetings.length === 0) {
    console.log('⚠️  Nenhum GP disponível para este ano ainda. Encerrando.');
    return;
  }

  // 3. Pilotos — busca da sessão de Qualifying mais recente com dados
  const qualifyings = sessions
    .filter((s) => s.session_type === 'Qualifying')
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());

  let drivers: OF1Driver[] = [];
  for (const qs of qualifyings.slice(0, 5)) {
    const result = await fetchJSON<OF1Driver[]>(`/drivers?session_key=${qs.session_key}`);
    if (result.length > 0) {
      drivers = result;
      console.log(`👥 Pilotos obtidos da sessão ${qs.session_key} (${qs.session_name} — ${qs.date_start.slice(0, 10)})\n`);
      break;
    }
  }

  if (drivers.length === 0) {
    console.log('⚠️  Sem dados de pilotos disponíveis ainda. Pulando pilotos/equipes.\n');
  } else {
    // Deduplica por número (mesmo piloto pode aparecer em múltiplas sessões)
    const uniqueDrivers = Object.values(
      Object.fromEntries(drivers.map((d) => [d.driver_number, d]))
    );

    // Agrupa por equipe
    const byTeam = new Map<string, OF1Driver[]>();
    for (const d of uniqueDrivers) {
      if (!d.team_name) continue;
      if (!byTeam.has(d.team_name)) byTeam.set(d.team_name, []);
      byTeam.get(d.team_name)!.push(d);
    }

    console.log(`🔧 Sincronizando ${byTeam.size} equipes e ${uniqueDrivers.length} pilotos...`);

    for (const [teamName, teamDrivers] of byTeam) {
      const color = toHex(teamDrivers[0].team_colour);

      // Slug da equipe: pega do primeiro piloto conhecido no DRIVER_CDN
      // (independe do nome que a Open F1 retorna para a equipe)
      const slug = teamDrivers.map((d) => DRIVER_CDN[d.name_acronym]?.teamSlug).find(Boolean)
        ?? TEAM_SLUGS[teamName];
      const logoUrl = slug ? `${CDN}/${slug}/2026${slug}logowhite.webp` : undefined;
      const carUrl  = slug ? `${CDN}/${slug}/2026${slug}carright.webp`  : undefined;

      const team = await prisma.team.upsert({
        where: { name: teamName },
        update: { color, ...(logoUrl ? { logoUrl, carUrl } : {}) },
        create: { name: teamName, color, country: '', logoUrl, carUrl },
      });

      for (const d of teamDrivers) {
        const cdn = DRIVER_CDN[d.name_acronym];
        const dSlug  = cdn?.teamSlug ?? slug;
        const imgId  = cdn?.imgId ?? driverImgIdFallback(d.full_name);
        const country = cdn?.country ?? (d.country_code ?? '').toLowerCase().slice(0, 2);
        const headshotUrl = dSlug
          ? `${CDN}/${dSlug}/${imgId}/2026${dSlug}${imgId}right.webp`
          : (d.headshot_url ?? undefined);

        await prisma.driver.upsert({
          where: { code: d.name_acronym },
          update: {
            firstName: d.first_name,
            lastName: d.last_name,
            number: d.driver_number,
            headshotUrl,
            teamId: team.id,
          },
          create: {
            firstName: d.first_name,
            lastName: d.last_name,
            code: d.name_acronym,
            number: d.driver_number,
            country,
            headshotUrl,
            teamId: team.id,
          },
        });
      }

      console.log(`  ✅ ${teamName} [${slug ?? '?'}]: ${teamDrivers.map((d) => d.name_acronym).join(', ')}`);
    }
  }

  // 4. GPs e sessões
  console.log(`\n📅 Sincronizando GPs e sessões...\n`);

  const sessionsByMeeting = new Map<number, OF1Session[]>();
  for (const s of sessions) {
    if (!sessionsByMeeting.has(s.meeting_key)) sessionsByMeeting.set(s.meeting_key, []);
    sessionsByMeeting.get(s.meeting_key)!.push(s);
  }

  const sortedMeetings = [...gpMeetings].sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  );

  for (let i = 0; i < sortedMeetings.length; i++) {
    const meeting = sortedMeetings[i];
    const round = i + 1;

    const trackSlug = TRACK_SLUGS[meeting.meeting_name];
    const trackMapUrl = trackSlug ? `${CDN}/track/2026track${trackSlug}detailed.webp` : undefined;

    const country = toIso2(meeting.country_code ?? '');

    const gp = await prisma.grandPrix.upsert({
      where: { name: meeting.meeting_name },
      update: { country, ...(trackMapUrl ? { trackMapUrl } : {}) },
      create: {
        name: meeting.meeting_name,
        country,
        trackName: meeting.circuit_short_name,
        trackMapUrl,
      },
    });

    const meetingSessions = sessionsByMeeting.get(meeting.meeting_key) ?? [];
    const created: string[] = [];

    for (const s of meetingSessions) {
      const type = resolveSessionType(s.session_name);
      if (!type) {
        console.log(`    ⚠️  Tipo desconhecido: "${s.session_type} / ${s.session_name}" — pulando`);
        continue;
      }

      const date = new Date(s.date_start);

      const existing = await prisma.session.findFirst({
        where: { seasonId: season.id, grandPrixId: gp.id, type },
      });

      if (existing) {
        await prisma.session.update({
          where: { id: existing.id },
          data: { openf1Key: s.session_key, date },
        });
        created.push(`${type}(updated)`);
      } else {
        await prisma.session.create({
          data: {
            type,
            round,
            date,
            seasonId: season.id,
            grandPrixId: gp.id,
            openf1Key: s.session_key,
            ...(type === SessionType.RACE ? { raceConfig: { create: {} } } : {}),
          },
        });
        created.push(type);
      }
    }

    const tag = created.length > 0 ? `[${created.join(', ')}]` : '[sem alterações]';
    console.log(`  R${String(round).padStart(2, '0')} ${meeting.meeting_name} ${tag}`);
  }

  console.log('\n🏁 Sincronização concluída!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
