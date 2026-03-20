/**
 * fetch-activites.mjs
 * Récupère les événements de la semaine à Québec via Ticketmaster Discovery API
 * et met à jour src/data/activites.json + src/data/meta.json
 *
 * Requis : variable d'env TICKETMASTER_API_KEY
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

// ── Dates de la semaine courante (lundi → dimanche) ────────────────────────
function getSemaine() {
  const today = new Date();
  const day = today.getDay(); // 0=dim, 1=lun...
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diffToMonday);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);

  const fmt = d => d.toISOString().split('T')[0];
  return { debut: fmt(lundi), fin: fmt(dimanche) };
}

// ── Fetch Ticketmaster ─────────────────────────────────────────────────────
async function fetchEvenements(apiKey) {
  const { debut, fin } = getSemaine();

  const params = new URLSearchParams({
    apikey: apiKey,
    city: 'Quebec',
    stateCode: 'QC',
    countryCode: 'CA',
    startDateTime: `${debut}T00:00:00Z`,
    endDateTime: `${fin}T23:59:59Z`,
    size: 60,
    sort: 'date,asc',
  });

  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;
  console.log(`\nFetch: ${url.replace(apiKey, '***')}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const events = data?._embedded?.events ?? [];
  console.log(`→ ${events.length} événements trouvés (${debut} → ${fin})`);
  return { events, debut, fin };
}

// ── Transformation → format activites.json ────────────────────────────────
function transformerEvenements(events) {
  const typeMap = {
    'Music': 'musique',
    'Sports': 'sport',
    'Arts & Theatre': 'culturel',
    'Film': 'cinéma',
    'Miscellaneous': 'événement',
    'Family': 'famille',
  };

  return events.map(e => {
    const venue = e._embedded?.venues?.[0];
    const classification = e.classifications?.[0];
    const segment = classification?.segment?.name ?? 'Miscellaneous';
    const priceMin = e.priceRanges?.[0]?.min ?? 0;
    const date = e.dates?.start?.localDate ?? '';

    return {
      nom: e.name,
      lieu: venue?.name ?? 'Québec',
      duree: 120,
      cout: Math.round(priceMin),
      saison: 'toute',
      type: typeMap[segment] ?? 'événement',
      origine: 'Québec',
      exemple_claude: 1,
      date,
      url: e.url ?? '',
    };
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.TICKETMASTER_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  TICKETMASTER_API_KEY non définie — données existantes conservées.');
    process.exit(0);
  }

  // Charger les anciennes données (fallback si erreur API)
  const ancienFichier = join(DATA_DIR, 'activites.json');
  const anciennesActivites = JSON.parse(readFileSync(ancienFichier, 'utf-8'));

  try {
    const { events, debut, fin } = await fetchEvenements(apiKey);

    let activites;

    if (events.length === 0) {
      console.log('Aucun événement Ticketmaster — données statiques conservées.');
      activites = anciennesActivites;
    } else {
      activites = transformerEvenements(events);
      console.log(`✅ ${activites.length} activités transformées.`);
    }

    // Écrire activites.json
    writeFileSync(ancienFichier, JSON.stringify(activites, null, 2) + '\n');

    // Écrire meta.json
    const meta = {
      lastUpdated: new Date().toISOString().split('T')[0],
      semaine: { debut, fin },
      source: events.length > 0 ? 'Ticketmaster' : 'statique',
      count: activites.length,
    };
    writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

    console.log('✅ activites.json et meta.json mis à jour.');

  } catch (err) {
    console.error('❌ Erreur fetch:', err.message);
    console.log('→ Données existantes conservées.');

    // Toujours mettre à jour meta.json avec statut d'erreur
    const { debut, fin } = getSemaine();
    const meta = {
      lastUpdated: new Date().toISOString().split('T')[0],
      semaine: { debut, fin },
      source: 'statique',
      count: anciennesActivites.length,
      error: err.message,
    };
    writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
    process.exit(1);
  }
}

main();
