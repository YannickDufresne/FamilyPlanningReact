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

// ── Profils de la famille (avec dates de naissance pour calcul d'âge réel) ──
const FAMILLE = [
  { prenom: 'Patricia', emoji: '💚', naissance: '1993-05-29', gouts: 'culture, arts, gastronomie, sorties calmes et élégantes, musées, théâtre' },
  { prenom: 'Yannick',  emoji: '🦉', naissance: '1981-01-23', gouts: 'histoire, architecture, gastronomie, randonnée, découvertes intellectuelles' },
  { prenom: 'Joseph',   emoji: '🐤', naissance: '2012-07-07', gouts: 'sport, plein air, aventure, animaux, activités physiques énergiques, adolescent actif' },
  { prenom: 'Mika',     emoji: '🍒', naissance: '2024-08-25', gouts: 'créativité, arts, jeux, activités amusantes et colorées, tout-petit curieux' },
  { prenom: 'Luce',     emoji: '🍒', naissance: '2024-08-25', gouts: 'activités douces, nature, famille, jeux simples, jumelle de Mika, tout-petite' },
];

function calculerAge(naissance, dateRef = new Date()) {
  const n = new Date(naissance + 'T12:00:00');
  let age = dateRef.getFullYear() - n.getFullYear();
  const dm = dateRef.getMonth() - n.getMonth();
  if (dm < 0 || (dm === 0 && dateRef.getDate() < n.getDate())) age--;
  return age;
}

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

// ── Extrait les tarifs depuis les priceRanges Ticketmaster ───────────────────
// TM retourne parfois plusieurs types : "standard", "standard including fees",
// "platinum", "vip"... Rarement "child" ou "family" mais on vérifie quand même.
function extraireTarifs(priceRanges) {
  if (!priceRanges || priceRanges.length === 0) {
    return { cout_adulte: 0, cout_enfant: null, cout_bebe: 0 };
  }

  const find = (...types) =>
    priceRanges.find(p => types.some(t => p.type?.toLowerCase().includes(t)));

  const adulte  = find('standard', 'adult', 'general') ?? priceRanges[0];
  const enfant  = find('child', 'children', 'youth', 'junior');
  const famille = find('family');

  return {
    cout_adulte: Math.round(adulte.min ?? 0),
    cout_enfant: enfant  ? Math.round(enfant.min)  : (famille ? Math.round(famille.min / 4) : null),
    cout_bebe:   0, // les bébés n'ont généralement pas besoin de billet
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

  const typeMap = {
    'Music': 'musique', 'Sports': 'sport',
    'Arts & Theatre': 'culturel', 'Film': 'cinéma', 'Family': 'famille',
  };

  return events.map(e => {
    const tarifs = extraireTarifs(e.priceRanges);
    return {
      nom: e.name,
      lieu: e._embedded?.venues?.[0]?.name ?? 'Québec',
      duree: 120,
      cout: tarifs.cout_adulte,          // compat rétroactive
      cout_adulte: tarifs.cout_adulte,
      cout_enfant: tarifs.cout_enfant,   // null si inconnu
      cout_bebe:   tarifs.cout_bebe,
      saison: 'toute',
      type: typeMap[e.classifications?.[0]?.segment?.name] ?? 'événement',
      origine: 'Québec',
      exemple_claude: 1,
      date: e.dates?.start?.localDate ?? '',
      url: e.url ?? '',
      source: 'ticketmaster',
    };
  }).filter(e => e.date);
}

// ── 2a. Claude — 3 activités 100 % gratuites garanties ───────────────────────
async function fetchActivitesGratuites(anthropicKey, semaine, existantes) {
  const client = new Anthropic({ apiKey: anthropicKey });

  const dejaListes = existantes.map(e => `- ${e.nom}`).join('\n') || '(aucun)';
  const profilsFamille = FAMILLE.map(m => {
    const age = calculerAge(m.naissance);
    const cat = age < 5 ? 'bébé' : age < 13 ? 'enfant' : age < 18 ? 'ado' : 'adulte';
    return `  • ${m.prenom} ${m.emoji} (${age} ans, ${cat}) : ${m.gouts}`;
  }).join('\n');

  const prompt = `Tu es un expert des sorties familiales gratuites à Québec (ville).

Génère exactement 3 activités ENTIÈREMENT GRATUITES pour la famille Dufresne, semaine du ${semaine.debutLisible} au ${semaine.finLisible}.

Famille :
${profilsFamille}

Déjà listées (ne pas dupliquer) :
${dejaListes}

CONTRAINTES STRICTES :
- 100 % gratuites : entrée, stationnement, matériel — tout compris
- Activités réelles existant à Québec (ville)
- Variées : nature, patrimoine, communautaire, marché, parc, bibliothèque…
- Saison : ${getSaisonActuelle()}
- Conviennent à la famille avec des tout-petits (Mika et Luce, 1 an)

Réponds UNIQUEMENT avec un tableau JSON valide :
[{
  "nom": "Nom précis",
  "lieu": "Lieu exact avec adresse si possible",
  "duree": 90,
  "cout": 0, "cout_adulte": 0, "cout_enfant": 0, "cout_bebe": 0,
  "saison": "toute",
  "type": "plein air",
  "origine": "Québec",
  "exemple_claude": 1,
  "date": "",
  "url": "",
  "source": "claude",
  "gratuit": true,
  "pourQui": "famille",
  "description": "Description enthousiaste avec émojis des membres concernés"
}]`;

  console.log('→ Claude : génération des activités gratuites...');
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const texte = message.content[0].text.trim();
  const match = texte.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Pas de JSON valide pour les activités gratuites');

  const suggestions = JSON.parse(match[0]);
  // Sécurité : forcer cout = 0 quoi qu'il arrive
  suggestions.forEach(s => {
    s.cout = 0; s.cout_adulte = 0; s.cout_enfant = 0; s.cout_bebe = 0; s.gratuit = true;
  });
  console.log(`  ${suggestions.length} activités gratuites générées`);
  return suggestions;
}

// ── 2b. Claude — suggestions avec vrais tarifs par tranche d'âge ───────────────
async function fetchSuggestionsIA(anthropicKey, semaine, evenementsExistants) {
  const client = new Anthropic({ apiKey: anthropicKey });

  const dejaListes = evenementsExistants.map(e => `- ${e.nom} (${e.date})`).join('\n') || '(aucun)';

  // Calcul des âges actuels pour le prompt
  const profilsFamille = FAMILLE.map(m => {
    const age = calculerAge(m.naissance);
    const categorie = age < 5 ? 'bébé' : age < 13 ? 'enfant' : age < 18 ? 'adolescent' : 'adulte';
    return `  • ${m.prenom} ${m.emoji} (${age} ans, ${categorie}) : ${m.gouts}`;
  }).join('\n');

  const prompt = `Tu es un expert de la ville de Québec et des sorties familiales. Tu connais les tarifs réels des lieux culturels, sportifs et de loisirs de la région de Québec.

Génère exactement 8 suggestions d'activités pour la famille Dufresne pour la semaine du ${semaine.debutLisible} au ${semaine.finLisible} à Québec (ville).

Composition de la famille avec âges actuels :
${profilsFamille}

Événements Ticketmaster déjà trouvés pour cette semaine (ne pas dupliquer) :
${dejaListes}

Contraintes :
- Activités réelles et réalisables à Québec (ville), pas inventées
- Mix : plein air, culturel, gastronomique, sportif, familial
- Variété de coûts : certaines gratuites, certaines payantes
- Saison actuelle : ${getSaisonActuelle()}
- Certaines pour toute la famille, certaines pour adultes seulement, certaines pour enfants
- IMPORTANT : Pour cout_adulte, cout_enfant (5-12 ans), cout_bebe (0-4 ans), indique les VRAIS tarifs du lieu en dollars canadiens (ex. Aquarium : adulte 23$, enfant 15$, bébé 0$). Si l'activité est gratuite, mets 0. Si les tarifs enfant/bébé sont inconnus pour une activité payante, mets null.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après :
[
  {
    "nom": "Nom de l'activité",
    "lieu": "Nom du lieu précis à Québec",
    "duree": 90,
    "cout": 0,
    "cout_adulte": 0,
    "cout_enfant": 0,
    "cout_bebe": 0,
    "saison": "toute",
    "type": "plein air",
    "origine": "Québec",
    "exemple_claude": 1,
    "date": "",
    "url": "",
    "source": "claude",
    "pourQui": "famille",
    "description": "Courte description enthousiaste avec émojis des membres concernés"
  }
]

Types valides : plein air, culturel, gastronomique, sport, famille, musique, apprentissage, festival, social`;

  console.log('→ Claude : génération des suggestions IA avec tarifs réels...');
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const texte = message.content[0].text.trim();
  const match = texte.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude n\'a pas retourné de JSON valide');

  const suggestions = JSON.parse(match[0]);
  // Assurer rétrocompatibilité : cout = cout_adulte si non défini
  suggestions.forEach(s => {
    if (s.cout_adulte !== undefined && s.cout === undefined) s.cout = s.cout_adulte;
    if (s.cout !== undefined && s.cout_adulte === undefined) s.cout_adulte = s.cout;
  });

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

  // 2. Claude — suggestions générales + activités gratuites garanties
  const anthKey = process.env.ANTHROPIC_API_KEY;
  if (anthKey) {
    try {
      const suggestions = await fetchSuggestionsIA(anthKey, semaine, resultats);
      resultats.push(...suggestions);
      sourceLabel = tmKey ? 'ticketmaster+claude' : 'claude';
    } catch (err) {
      console.warn('  ⚠️  Claude (suggestions) échoué:', err.message);
    }
    try {
      const gratuites = await fetchActivitesGratuites(anthKey, semaine, resultats);
      resultats.push(...gratuites);
    } catch (err) {
      console.warn('  ⚠️  Claude (gratuites) échoué:', err.message);
    }
  } else {
    console.log('  ℹ️  ANTHROPIC_API_KEY absente — suggestions IA ignorées');
  }

  const activitesFinales = resultats.length > 0 ? resultats : anciennes;

  writeFileSync(ancienFichier, JSON.stringify(activitesFinales, null, 2) + '\n');

  const meta = {
    lastUpdated: new Date().toISOString().split('T')[0],
    semaine: { debut: semaine.debut, fin: semaine.fin },
    source: sourceLabel,
    count: activitesFinales.length,
    ticketmaster: resultats.filter(e => e.source === 'ticketmaster').length,
    claude: resultats.filter(e => e.source === 'claude').length,
    gratuites: resultats.filter(e => e.gratuit === true).length,
  };
  writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  console.log(`\n✅ ${activitesFinales.length} activités sauvegardées (${sourceLabel})`);
  console.log('   meta.json :', meta);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
