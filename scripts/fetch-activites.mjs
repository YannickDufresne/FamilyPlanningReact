/**
 * fetch-activites.mjs
 * Sources :
 *   1. Ticketmaster Discovery API — événements ticketés à Québec (avec dates précises)
 *   2. Claude API — suggestions IA personnalisées pour la famille (sans date = fallback)
 *
 * Variables d'environnement :
 *   TICKETMASTER_API_KEY  — optionnel, active Ticketmaster
 *   ANTHROPIC_API_KEY     — optionnel, active les suggestions Claude
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

// ── Profils de la famille (préférences et émojis) ─────────────────────────────
const FAMILLE = [
  { prenom: 'Patricia', emoji: '💚', gouts: 'culture, arts, gastronomie, sorties calmes et élégantes, musées, théâtre' },
  { prenom: 'Yannick',  emoji: '🦉', gouts: 'histoire, architecture, gastronomie, randonnée, découvertes intellectuelles' },
  { prenom: 'Joseph',   emoji: '🐤', gouts: 'sport, plein air, aventure, animaux, activités physiques énergiques, enfant actif' },
  { prenom: 'Mika',     emoji: '🍒', gouts: 'créativité, arts, jeux, activités amusantes et colorées, enfant curieux' },
  { prenom: 'Luce',     emoji: '🍒', gouts: 'activités douces, nature, famille, jeux simples, tout-petit' },
];

// ── Dates de la semaine courante ──────────────────────────────────────────────
function getSemaine() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diff);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  const fmt = d => d.toISOString().split('T')[0];
  const fmtLisible = d => d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    debut: fmt(lundi),
    fin: fmt(dimanche),
    debutLisible: fmtLisible(lundi),
    finLisible: fmtLisible(dimanche),
  };
}

// ── 1. Ticketmaster ───────────────────────────────────────────────────────────
async function fetchTicketmaster(apiKey, semaine) {
  const params = new URLSearchParams({
    apikey: apiKey,
    city: 'Quebec',
    stateCode: 'QC',
    countryCode: 'CA',
    startDateTime: `${semaine.debut}T00:00:00Z`,
    endDateTime: `${semaine.fin}T23:59:59Z`,
    size: 60,
    sort: 'date,asc',
  });

  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;
  console.log('→ Ticketmaster:', url.replace(apiKey, '***'));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`);
  const data = await res.json();
  const events = data?._embedded?.events ?? [];
  console.log(`  ${events.length} événements trouvés`);

  const typeMap = { 'Music': 'musique', 'Sports': 'sport', 'Arts & Theatre': 'culturel', 'Film': 'cinéma', 'Family': 'famille' };

  return events.map(e => ({
    nom: e.name,
    lieu: e._embedded?.venues?.[0]?.name ?? 'Québec',
    duree: 120,
    cout: Math.round(e.priceRanges?.[0]?.min ?? 0),
    saison: 'toute',
    type: typeMap[e.classifications?.[0]?.segment?.name] ?? 'événement',
    origine: 'Québec',
    exemple_claude: 1,
    date: e.dates?.start?.localDate ?? '',
    url: e.url ?? '',
    source: 'ticketmaster',
  })).filter(e => e.date); // garder seulement ceux avec une date précise
}

// ── 2. Claude — suggestions personnalisées ────────────────────────────────────
async function fetchSuggestionsIA(anthropicKey, semaine, evenementsExistants) {
  const client = new Anthropic({ apiKey: anthropicKey });

  const dejaListes = evenementsExistants.map(e => `- ${e.nom} (${e.date})`).join('\n') || '(aucun)';
  const profilsFamille = FAMILLE.map(m => `  • ${m.prenom} ${m.emoji} : ${m.gouts}`).join('\n');

  const prompt = `Tu es un expert de la ville de Québec et des sorties familiales.

Génère exactement 8 suggestions d'activités pour la famille Dufresne pour la semaine du ${semaine.debutLisible} au ${semaine.finLisible} à Québec (ville).

Profils de la famille :
${profilsFamille}

Événements Ticketmaster déjà trouvés pour cette semaine (ne pas dupliquer) :
${dejaListes}

Contraintes :
- Activités réelles et réalisables à Québec (ville), pas inventées
- Mix : plein air, culturel, gastronomique, sportif, familial
- Variété de coûts : certaines gratuites, certaines payantes
- Saison actuelle : ${getSaisonActuelle()}
- Certaines pour toute la famille, certaines pour adultes seulement, certaines pour enfants

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après :
[
  {
    "nom": "Nom de l'activité",
    "lieu": "Nom du lieu précis à Québec",
    "duree": 90,
    "cout": 0,
    "saison": "toute",
    "type": "plein air",
    "origine": "Québec",
    "exemple_claude": 1,
    "date": "",
    "url": "",
    "source": "claude",
    "pourQui": "famille",
    "description": "Courte description enthousiaste"
  }
]

Types valides : plein air, culturel, gastronomique, sport, famille, musique, apprentissage, festival, social`;

  console.log('→ Claude : génération des suggestions IA...');
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const texte = message.content[0].text.trim();

  // Extraire le JSON même si Claude ajoute du texte autour
  const match = texte.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude n\'a pas retourné de JSON valide');

  const suggestions = JSON.parse(match[0]);
  console.log(`  ${suggestions.length} suggestions Claude générées`);
  return suggestions;
}

function getSaisonActuelle() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'printemps';
  if (m >= 6 && m <= 8) return 'été';
  if (m >= 9 && m <= 11) return 'automne';
  return 'hiver';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const semaine = getSemaine();
  console.log(`\nSemaine : ${semaine.debut} → ${semaine.fin}`);

  const ancienFichier = join(DATA_DIR, 'activites.json');
  const anciennes = JSON.parse(readFileSync(ancienFichier, 'utf-8'));

  const resultats = [];
  let sourceLabel = 'statique';

  // 1. Ticketmaster
  const tmKey = process.env.TICKETMASTER_API_KEY;
  if (tmKey) {
    try {
      const tmEvents = await fetchTicketmaster(tmKey, semaine);
      resultats.push(...tmEvents);
      sourceLabel = 'ticketmaster';
    } catch (err) {
      console.warn('  ⚠️  Ticketmaster échoué:', err.message);
    }
  } else {
    console.log('  ℹ️  TICKETMASTER_API_KEY absente — étape ignorée');
  }

  // 2. Claude
  const anthKey = process.env.ANTHROPIC_API_KEY;
  if (anthKey) {
    try {
      const suggestions = await fetchSuggestionsIA(anthKey, semaine, resultats);
      resultats.push(...suggestions);
      sourceLabel = tmKey ? 'ticketmaster+claude' : 'claude';
    } catch (err) {
      console.warn('  ⚠️  Claude échoué:', err.message);
    }
  } else {
    console.log('  ℹ️  ANTHROPIC_API_KEY absente — suggestions IA ignorées');
  }

  // Fallback : garder les anciennes données statiques (sans date) si rien de nouveau
  const activitesFinales = resultats.length > 0 ? resultats : anciennes;

  // Écrire
  writeFileSync(ancienFichier, JSON.stringify(activitesFinales, null, 2) + '\n');

  const meta = {
    lastUpdated: new Date().toISOString().split('T')[0],
    semaine: { debut: semaine.debut, fin: semaine.fin },
    source: sourceLabel,
    count: activitesFinales.length,
    ticketmaster: resultats.filter(e => e.source === 'ticketmaster').length,
    claude: resultats.filter(e => e.source === 'claude').length,
  };
  writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  console.log(`\n✅ ${activitesFinales.length} activités sauvegardées (${sourceLabel})`);
  console.log('   meta.json :', meta);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
