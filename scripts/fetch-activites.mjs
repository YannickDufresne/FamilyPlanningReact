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
  const diff = day === 0 ? 1 : 1 - day;  // dimanche → prochain lundi
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

// ── Période élargie (N semaines à partir du lundi courant) ───────────────────
function getPeriodeElargie(semaine, nbSemaines = 4) {
  const finElargie = new Date(semaine.fin + 'T12:00:00');
  finElargie.setDate(finElargie.getDate() + (nbSemaines - 1) * 7);
  const fmt = d => d.toISOString().split('T')[0];
  return { debut: semaine.debut, fin: fmt(finElargie) };
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
  const periode = getPeriodeElargie(semaine, 4); // 4 semaines de visibilité
  const params = new URLSearchParams({
    apikey: apiKey,
    city: 'Quebec',
    stateCode: 'QC',
    countryCode: 'CA',
    startDateTime: `${periode.debut}T00:00:00Z`,
    endDateTime: `${periode.fin}T23:59:59Z`,
    size: 100,
    sort: 'date,asc',
  });

  const urlSansClef = `https://app.ticketmaster.com/discovery/v2/events.json?city=Quebec&stateCode=QC&countryCode=CA&startDateTime=${periode.debut}T00:00:00Z&endDateTime=${periode.fin}T23:59:59Z&size=100&sort=date,asc`;
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;
  console.log('→ Ticketmaster:', urlSansClef);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`);
  const data = await res.json();
  const events = data?._embedded?.events ?? [];
  console.log(`  ${events.length} événements trouvés`);

  const typeMap = {
    'Music': 'musique', 'Sports': 'sport',
    'Arts & Theatre': 'culturel', 'Film': 'cinéma', 'Family': 'famille',
  };

  const resultats = events.map(e => {
    const tarifs = extraireTarifs(e.priceRanges);
    return {
      nom: e.name,
      lieu: e._embedded?.venues?.[0]?.name ?? 'Québec',
      duree: 120,
      cout: tarifs.cout_adulte,
      cout_adulte: tarifs.cout_adulte,
      cout_enfant: tarifs.cout_enfant,
      cout_bebe:   tarifs.cout_bebe,
      saison: 'toute',
      type: typeMap[e.classifications?.[0]?.segment?.name] ?? 'événement',
      origine: 'Québec',
      exemple_claude: 1,
      date: e.dates?.start?.localDate ?? '',
      url: e.url ?? '',
      source: 'ticketmaster',
      pourQui: detecterAudience(e.name, e.info ?? ''),
    };
  }).filter(e => e.date);

  return { resultats, urlSansClef };
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
  return { resultats: suggestions, prompt, modele: 'claude-opus-4-5' };
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
- Activités réelles et réalisables à Québec (ville) et villes proches (Lévis, Charlesbourg, Sainte-Foy), pas inventées
- Mix varié : plein air, culturel, gastronomique, sportif, communautaire, familial
- PRIORITÉ aux activités GRATUITES ou peu coûteuses : fêtes de quartier, bibliothèques, parcs, événements communautaires, marchés, concerts en plein air, vernissages
- Inclure aussi : événements dans les bibliothèques (BAnQ, bibliothèques de quartier), événements religieux/culturels ouverts au public (concerts en église, etc.), fêtes de rue et de quartier
- Variété de coûts : minimum 3 sur 8 entièrement gratuites
- Saison actuelle : ${getSaisonActuelle()}
- Mix pourQui : minimum 2 "adultes" (soirées, restaurants, spectacles), le reste "famille"
- Pour pourQui adultes : soirées, restos, spectacles, événements nocturnes (18h+) — pas de bébés
- IMPORTANT : Pour cout_adulte, cout_enfant (5-12 ans), cout_bebe (0-4 ans), indique les VRAIS tarifs du lieu. Si l'activité est gratuite, mets 0. Si les tarifs enfant/bébé sont inconnus pour une activité payante, mets null.

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
  return { resultats: suggestions, prompt, modele: 'claude-opus-4-5' };
}

// ── 3. Recherche web autonome — événements underground et petites salles ─────
// Utilise l'outil web_search d'Anthropic (claude-opus-4-5 avec accès web).
// Si l'outil n'est pas disponible sur le compte, la fonction retourne [] sans planter.
async function fetchEvenementsWebSearch(anthropicKey, semaine, existantes) {
  const client = new Anthropic({ apiKey: anthropicKey });

  const dejaListes = existantes.map(e => `- ${e.nom}`).join('\n') || '(aucun)';

  const prompt = `Tu es un agent de découverte d'événements locaux à Québec (ville), Canada.

Utilise l'outil de recherche web pour trouver des événements RÉELS de la semaine du ${semaine.debutLisible} au ${semaine.finLisible} à Québec.

Ratisse LARGE — cherche autant les événements communautaires gratuits que les sorties culturelles de niche :

ÉVÉNEMENTS COMMUNAUTAIRES ET GRATUITS (priorité haute) :
- Fêtes de quartier, fêtes de rue, événements de quartier
- Activités dans les bibliothèques (BAnQ Grande Bibliothèque succursale Québec, bibliothèques Saint-Jean-Baptiste, Neufchâtel, etc.)
- Marchés publics spéciaux, marchés de producteurs
- Concerts gratuits, musique en plein air
- Événements religieux culturels ouverts (concerts en église, etc.)
- Activités dans les centres communautaires

PETITES SALLES ET CULTURE DE NICHE :
- Shows et concerts : Le Pantoum, Le Vegas 3.0, L'Anti Bar & Spectacles, Le Scanner Bistro-Bar, Le Knock-Out, Le Bal du Lézard, La Foulocratie, Chez Rioux & Pettigrew
- Pop quiz, soirées trivia, escape game
- Conférences, causeries, TEDx, talks politiques ou intellectuels
- Vernissages et expositions dans les galeries indépendantes
- Soirées thématiques (jeux de société, karaoké, comédie, impro)

SITES À CONSULTER :
- macommunaute.ca/evenements/?ville=quebec
- quoifaire.com/quebec
- "événements gratuits Québec ${semaine.debutLisible}"
- "bibliothèque activité Québec ${semaine.debut.substring(0, 7)}"
- "fête quartier Québec ${semaine.debut.substring(0, 7)}"
- "Le Pantoum programmation ${semaine.debut.substring(0, 7)}"

Déjà listés (ne pas dupliquer) :
${dejaListes}

Après tes recherches, retourne UNIQUEMENT un tableau JSON des événements réels trouvés.
Si une date précise est connue, indique-la. Laisse "date": "" si tu n'es pas sûr.
Retourne [] si rien de concret trouvé pour cette semaine.

[{
  "nom": "Titre exact de l'événement",
  "lieu": "Nom de la salle / lieu",
  "duree": 120,
  "cout": 15,
  "cout_adulte": 15,
  "cout_enfant": null,
  "cout_bebe": 0,
  "saison": "toute",
  "type": "musique",
  "origine": "Québec",
  "exemple_claude": 1,
  "date": "2026-03-22",
  "url": "https://...",
  "source": "web_search",
  "pourQui": "adultes",
  "description": "Description de l'événement"
}]

IMPORTANT pour pourQui : utilise "adultes" pour les événements nocturnes/bars/spectacles réservés aux adultes, "famille" pour tout ce qui convient aux enfants et bébés.`;

  console.log('→ Claude (web_search) : chasse aux événements underground...');

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extraire le JSON de la réponse texte finale (après les tool_use blocks)
  const texte = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const match = texte.match(/\[[\s\S]*\]/);
  if (!match) {
    console.log('  Aucun événement structuré retourné');
    return [];
  }

  const events = JSON.parse(match[0]);
  events.forEach(e => { e.source = 'web_search'; });
  console.log(`  ${events.length} événements trouvés via web_search`);

  // Extraire les requêtes et sites visités depuis les blocs de contenu
  const recherches = message.content
    .filter(b => b.type === 'tool_use' && b.name === 'web_search')
    .map(b => b.input?.query)
    .filter(Boolean);

  const sitesVisites = [];
  message.content
    .filter(b => b.type === 'tool_result')
    .forEach(b => {
      const content = Array.isArray(b.content) ? b.content : [];
      content.forEach(c => { if (c.url) sitesVisites.push(c.url); });
    });

  return { resultats: events, prompt, modele: 'claude-opus-4-5', recherches, sitesVisites };
}

// ── 3b. Recherche web — grands événements incontournables ──────────────────
// Parades, festivals majeurs, événements annuels récurrents à ne pas manquer.
async function fetchIncontournables(anthropicKey, semaine, existantes) {
  const client = new Anthropic({ apiKey: anthropicKey });
  const dejaListes = existantes.map(e => `- ${e.nom}`).join('\n') || '(aucun)';

  const prompt = `Tu es un expert des grands événements de Québec (ville), Canada.

Utilise l'outil de recherche web pour trouver les événements INCONTOURNABLES et MAJEURS de la semaine du ${semaine.debutLisible} au ${semaine.finLisible} à Québec.

RECHERCHES OBLIGATOIRES À FAIRE (dans cet ordre) :
1. Cherche "événements Québec ${semaine.debut} ${semaine.fin} incontournable"
2. Consulte https://macommunaute.ca/evenements/?ville=quebec pour la semaine concernée
3. Cherche "${semaine.debut.substring(0, 7)} Québec festival parade défilé"
4. Cherche des événements annuels spécifiques si la période s'y prête :
   - Mars : "défilé Saint-Patrick Québec 2026" → Le défilé de Québec est habituellement le DERNIER samedi de mars (pas le 17 mars), cherche la date exacte sur qcpatrick.com
   - Juin : "Festival d'été Québec 2026"
   - Juillet : "FEQ Festival d'été de Québec 2026"
   - Hiver : "Carnaval de Québec 2026"
5. Consulte https://quoifaire.com/quebec pour la semaine

CRITÈRES pour qu'un événement soit "incontournable" :
- Parade ou défilé annuel (Saint-Patrick, Carnaval, etc.)
- Festival reconnu (Jazz, Films, FEQ, etc.)
- Événement unique ou rare cette semaine
- Plus de 500 personnes attendues
- Événement familial ou culturel majeur de la région

IMPORTANT : Vérifie que la date de l'événement tombe BIEN entre ${semaine.debut} et ${semaine.fin}. Sinon, ne l'inclus pas.

Déjà listés (ne pas dupliquer) :
${dejaListes}

Retourne UNIQUEMENT un tableau JSON ([] si rien d'incontournable cette semaine précise) :
[{
  "nom": "Titre exact",
  "lieu": "Lieu précis",
  "duree": 180,
  "cout": 0,
  "cout_adulte": 0,
  "cout_enfant": 0,
  "cout_bebe": 0,
  "saison": "toute",
  "type": "festival",
  "origine": "Québec",
  "exemple_claude": 1,
  "date": "2026-03-23",
  "url": "https://...",
  "source": "web_search",
  "incontournable": true,
  "pourQui": "famille",
  "description": "Pourquoi c'est incontournable cette semaine"
}]`;

  console.log('→ Claude (web_search) : chasse aux événements incontournables...');

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

  const texte = message.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const match = texte.match(/\[[\s\S]*\]/);
  if (!match) {
    console.log('  Aucun incontournable trouvé cette semaine');
    return { resultats: [], prompt, modele: 'claude-opus-4-5', recherches: [], sitesVisites: [] };
  }

  const events = JSON.parse(match[0]);
  events.forEach(e => { e.source = 'web_search'; e.incontournable = true; });
  console.log(`  ${events.length} incontournable(s) trouvé(s)`);

  const recherches = message.content
    .filter(b => b.type === 'tool_use' && b.name === 'web_search')
    .map(b => b.input?.query).filter(Boolean);

  const sitesVisites = [];
  message.content.filter(b => b.type === 'tool_result').forEach(b => {
    const content = Array.isArray(b.content) ? b.content : [];
    content.forEach(c => { if (c.url) sitesVisites.push(c.url); });
  });

  return { resultats: events, prompt, modele: 'claude-opus-4-5', recherches, sitesVisites };
}

// ── 0b. Eventbrite — événements Quebec via JSON embarqué dans le HTML ─────────
// Eventbrite expose window.__SERVER_DATA__ dans le HTML — pas d'API key requise.
async function fetchEventbrite(semaine) {
  const periode = getPeriodeElargie(semaine, 4);
  const pages = [
    { url: 'https://www.eventbrite.ca/d/canada--qu%C3%A9bec/free--events/', isFree: true },
    { url: 'https://www.eventbrite.ca/d/canada--qu%C3%A9bec/events--this-week/', isFree: false },
    { url: 'https://www.eventbrite.ca/d/canada--qu%C3%A9bec/events--next-week/', isFree: false },
    { url: 'https://www.eventbrite.ca/d/canada--qu%C3%A9bec/events--this-month/', isFree: false },
  ];

  const vus = new Set();
  const resultats = [];

  for (const { url, isFree } of pages) {
    try {
      const html = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      }).then(r => r.text());

      const marker = 'window.__SERVER_DATA__ = ';
      const markerIdx = html.indexOf(marker);
      if (markerIdx === -1) {
        console.log(`  Eventbrite: __SERVER_DATA__ non trouvé sur ${url}`);
        continue;
      }

      // Extraction robuste : compter les accolades pour trouver la fin du JSON
      // (évite le bug où </script> apparaît dans une URL à l'intérieur du JSON)
      const jsonStart = html.indexOf('{', markerIdx + marker.length);
      if (jsonStart === -1) continue;

      let depth = 0, inString = false, escaped = false, jsonEnd = -1;
      for (let i = jsonStart; i < Math.min(jsonStart + 2_000_000, html.length); i++) {
        const ch = html[i];
        if (escaped)      { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"')   { inString = !inString; continue; }
        if (inString)     continue;
        if (ch === '{')   depth++;
        else if (ch === '}') { if (--depth === 0) { jsonEnd = i; break; } }
      }
      if (jsonEnd === -1) { console.log(`  Eventbrite: JSON non délimité sur ${url}`); continue; }

      const data = JSON.parse(html.slice(jsonStart, jsonEnd + 1));
      const events = data?.search_data?.events?.results ?? [];
      console.log(`  Eventbrite (${isFree ? 'gratuit' : 'général'}): ${events.length} résultats`);

      for (const e of events) {
        // Filtre: ville Québec seulement (pas Montréal, etc.)
        const city = (e.primary_venue?.address?.city ?? '').toLowerCase();
        const isQC = city.includes('québec') || city.includes('quebec');
        if (!isQC) continue;

        // Filtre: dans la période de 4 semaines
        if (!e.start_date || e.start_date < periode.debut || e.start_date > periode.fin) continue;

        // Déduplique par ID ou nom+date
        const key = e.eid ?? (e.name + '|' + e.start_date);
        if (vus.has(key)) continue;
        vus.add(key);

        const lieu = [e.primary_venue?.name, e.primary_venue?.address?.address_1]
          .filter(Boolean).join(', ');

        resultats.push({
          nom: e.name,
          lieu,
          duree: 120,
          cout: isFree ? 0 : null,
          cout_adulte: isFree ? 0 : null,
          cout_enfant: isFree ? 0 : null,
          cout_bebe: 0,
          saison: 'toute',
          type: 'culturel',
          origine: 'Québec',
          exemple_claude: 0,
          date: e.start_date,
          url: e.url ?? '',
          source: 'eventbrite',
          gratuit: isFree,
          pourQui: detecterAudience(e.name, e.summary ?? ''),
          description: e.summary ?? '',
        });
      }
    } catch (err) {
      console.warn(`  Eventbrite ${url} : ${err.message}`);
    }
  }

  console.log(`  → ${resultats.length} événements Eventbrite retenus pour ${semaine.debut}→${periode.fin}`);
  return resultats;
}

// ── 5. Analyse IA de toutes les activités — scores + explications ─────────────
// Passe chaque activité à Claude pour obtenir :
//   score_famille (0-100), score_adultes (0-100),
//   explication_famille, explication_adultes, scores_membres
async function scorerEtExpliquer(anthropicKey, activites) {
  const client = new Anthropic({ apiKey: anthropicKey });

  const profilsFamille = FAMILLE.map(m => {
    const age = calculerAge(m.naissance);
    const cat = age < 5 ? 'bébé' : age < 13 ? 'enfant' : age < 18 ? 'ado' : 'adulte';
    return `${m.prenom} ${m.emoji} (${age} ans, ${cat}): ${m.gouts}`;
  }).join('\n');

  const BATCH = 25; // activités par appel Claude
  const scored = activites.map(a => ({ ...a }));

  for (let i = 0; i < activites.length; i += BATCH) {
    const batch = activites.slice(i, i + BATCH);
    const liste = batch.map((a, j) =>
      `${j + 1}. "${a.nom}" | ${a.lieu ?? ''} | audience: ${a.pourQui ?? 'famille'} | ${a.description ?? ''}`
    ).join('\n');

    const prompt = `Famille Dufresne, Québec — évalue la pertinence de ces activités :

MEMBRES DE LA FAMILLE :
${profilsFamille}

ACTIVITÉS À ÉVALUER (${batch.length}) :
${liste}

Pour chaque activité (dans le même ordre), retourne :
- score_famille : 0-100 (pertinence pour sortie en famille complète)
- score_adultes : 0-100 (pertinence pour sortie Patricia + Yannick seulement, sans enfants)
- explication_famille : max 90 car., style «Pour 💚 Patricia et 🐤 Joseph · arts, aventure» — explique le match avec les préférences
- explication_adultes : max 90 car., style «Soirée idéale pour 🦉 Yannick · histoire, gastronomie»
- scores_membres : { "Patricia": 0-100, "Yannick": 0-100, "Joseph": 0-100, "Mika": 0-100, "Luce": 0-100 }

Règles : score 0 si l'activité est vraiment inadaptée, 100 si parfaite. Les bébés (Mika, Luce) ont des scores élevés pour parcs, nature, marchés, zoos, fêtes en plein air. Joseph aime le sport et l'aventure. Patricia et Yannick apprécient la culture et la gastronomie.

Réponds UNIQUEMENT avec un tableau JSON (${batch.length} éléments, même ordre) :
[{ "score_famille": 85, "score_adultes": 60, "explication_famille": "...", "explication_adultes": "...", "scores_membres": { "Patricia": 90, "Yannick": 80, "Joseph": 70, "Mika": 50, "Luce": 50 } }]`;

    try {
      console.log(`  Scoring batch ${i + 1}–${Math.min(i + BATCH, activites.length)} / ${activites.length}...`);
      const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const texte = message.content[0].text.trim();
      const match = texte.match(/\[[\s\S]*\]/);
      if (!match) { console.warn('  Scoring: réponse JSON invalide'); continue; }

      const batchScores = JSON.parse(match[0]);
      batchScores.forEach((s, j) => {
        const idx = i + j;
        if (idx < scored.length) {
          scored[idx].score_famille    = s.score_famille    ?? null;
          scored[idx].score_adultes    = s.score_adultes    ?? null;
          scored[idx].explication_famille  = s.explication_famille  ?? null;
          scored[idx].explication_adultes  = s.explication_adultes  ?? null;
          scored[idx].scores_membres   = s.scores_membres   ?? null;
        }
      });
    } catch (err) {
      console.warn(`  ⚠️  Scoring batch ${i}–${i + BATCH}: ${err.message}`);
    }
  }

  const ok = scored.filter(a => a.score_famille != null).length;
  console.log(`  ${ok} / ${activites.length} activités scorées`);
  return scored;
}

// ── Détecte automatiquement l'audience d'un événement ────────────────────────
// Retourne 'adultes' si les mots-clés indiquent un événement inadapté aux familles,
// 'famille' sinon. Utilisé pour Ticketmaster et Eventbrite.
const KEYWORDS_ADULTES_ONLY = [
  'speed dating', 'speed-dating', 'speedating', 'speeddating',
  'célibataires', 'celibataires', 'célibataire', 'celibataire',
  'singles night', 'singles event', 'singles party',
  'dating event', 'dating night', 'rencontre adulte',
  'soirée pour adultes', 'soirée adultes', 'soirée adulte',
  'adults only', 'adultes seulement', 'réservé aux adultes',
  '18 ans et plus', '18+ seulement', '18+', '19+', '21+',
  'strip-tease', 'striptease', 'cabaret adulte', 'burlesque',
  'bachelorette', 'bachelor party', 'bachelorette party',
  'hen night', 'hen party', 'stag night',
  'séduction', 'hookup', 'rencontre romantique',
  'lapdance', 'gentlemen club', 'night club exclusif',
];

function detecterAudience(nom, description = '') {
  const texte = `${nom} ${description}`.toLowerCase();
  return KEYWORDS_ADULTES_ONLY.some(k => texte.includes(k)) ? 'adultes' : 'famille';
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

  // Suivi détaillé par source pour le journal de mise à jour
  const sourcesLog = {
    ticketmaster:     { statut: 'absent', count: 0, url: null, erreur: null },
    eventbrite:       { statut: 'absent', count: 0, urls: [], erreur: null },
    claude:           { statut: 'absent', count: 0, modele: null, prompt: null, erreur: null },
    claude_gratuites: { statut: 'absent', count: 0, modele: null, prompt: null, erreur: null },
    incontournables:  { statut: 'absent', count: 0, modele: null, prompt: null, recherches: [], sitesVisites: [], erreur: null },
    web_search:       { statut: 'absent', count: 0, modele: null, prompt: null, recherches: [], sitesVisites: [], erreur: null },
  };

  // 1. Ticketmaster
  const tmKey = process.env.TICKETMASTER_API_KEY;
  if (tmKey) {
    try {
      const { resultats: tmEvents, urlSansClef } = await fetchTicketmaster(tmKey, semaine);
      resultats.push(...tmEvents);
      sourceLabel = 'ticketmaster';
      sourcesLog.ticketmaster = { statut: 'ok', count: tmEvents.length, url: urlSansClef, erreur: null };
    } catch (err) {
      console.warn('  ⚠️  Ticketmaster échoué:', err.message);
      sourcesLog.ticketmaster = { statut: 'erreur', count: 0, url: null, erreur: err.message };
    }
  }

  // 1b. Eventbrite — événements Québec (JSON embarqué dans HTML, sans API key)
  try {
    const ebEvents = await fetchEventbrite(semaine);
    if (ebEvents.length > 0) {
      resultats.push(...ebEvents);
      sourceLabel = sourceLabel ? sourceLabel + '+eventbrite' : 'eventbrite';
    }
    sourcesLog.eventbrite = {
      statut: 'ok',
      count: ebEvents.length,
      urls: [
        'eventbrite.ca/d/canada--québec/free--events/',
        'eventbrite.ca/d/canada--québec/events--this-week/',
        'eventbrite.ca/d/canada--québec/events--next-week/',
      ],
      erreur: null,
    };
  } catch (err) {
    console.warn('  ⚠️  Eventbrite échoué:', err.message);
    sourcesLog.eventbrite = { statut: 'erreur', count: 0, urls: [], erreur: err.message };
  }

  // 2. Claude — suggestions générales + activités gratuites garanties
  const anthKey = process.env.ANTHROPIC_API_KEY;
  if (anthKey) {
    try {
      const { resultats: suggestions, prompt, modele } = await fetchSuggestionsIA(anthKey, semaine, resultats);
      resultats.push(...suggestions);
      sourceLabel = tmKey ? 'ticketmaster+claude' : 'claude';
      sourcesLog.claude = { statut: 'ok', count: suggestions.length, modele, prompt, erreur: null };
    } catch (err) {
      console.warn('  ⚠️  Claude (suggestions) échoué:', err.message);
      sourcesLog.claude = { statut: 'erreur', count: 0, modele: 'claude-opus-4-5', prompt: null, erreur: err.message };
    }

    try {
      const { resultats: gratuites, prompt, modele } = await fetchActivitesGratuites(anthKey, semaine, resultats);
      resultats.push(...gratuites);
      sourcesLog.claude_gratuites = { statut: 'ok', count: gratuites.length, modele, prompt, erreur: null };
    } catch (err) {
      console.warn('  ⚠️  Claude (gratuites) échoué:', err.message);
      sourcesLog.claude_gratuites = { statut: 'erreur', count: 0, modele: 'claude-opus-4-5', prompt: null, erreur: err.message };
    }

    // 3a. Web search — grands événements incontournables (parades, festivals majeurs)
    try {
      const { resultats: incoEvents, prompt: incoPrompt, modele: incoModele, recherches: incoRecherches, sitesVisites: incoSites } = await fetchIncontournables(anthKey, semaine, resultats);
      if (incoEvents.length > 0) {
        resultats.push(...incoEvents);
        sourceLabel += '+incontournables';
      }
      sourcesLog.incontournables = { statut: 'ok', count: incoEvents.length, modele: incoModele, prompt: incoPrompt, recherches: incoRecherches, sitesVisites: incoSites, erreur: null };
    } catch (err) {
      if (err.status === 400 || err.message?.toLowerCase().includes('web_search') || err.message?.toLowerCase().includes('tool')) {
        console.log('  ℹ️  web_search (incontournables) non disponible — étape ignorée');
        sourcesLog.incontournables.statut = 'absent';
        sourcesLog.incontournables.erreur = 'Outil web_search non activé sur ce compte Anthropic';
      } else {
        console.warn('  ⚠️  Incontournables échoué:', err.message);
        sourcesLog.incontournables = { statut: 'erreur', count: 0, modele: 'claude-opus-4-5', prompt: null, recherches: [], sitesVisites: [], erreur: err.message };
      }
    }

    // 3. Web search — événements underground, petites salles, niche
    try {
      const { resultats: webEvents, prompt, modele, recherches, sitesVisites } = await fetchEvenementsWebSearch(anthKey, semaine, resultats);
      if (webEvents.length > 0) {
        resultats.push(...webEvents);
        sourceLabel += '+websearch';
      }
      sourcesLog.web_search = { statut: 'ok', count: webEvents.length, modele, prompt, recherches, sitesVisites, erreur: null };
    } catch (err) {
      if (err.status === 400 || err.message?.toLowerCase().includes('web_search') || err.message?.toLowerCase().includes('tool')) {
        console.log('  ℹ️  web_search non disponible sur ce compte — étape ignorée');
        sourcesLog.web_search.statut = 'absent';
        sourcesLog.web_search.erreur = 'Outil web_search non activé sur ce compte Anthropic';
      } else {
        console.warn('  ⚠️  Web search échoué:', err.message);
        sourcesLog.web_search = { statut: 'erreur', count: 0, modele: 'claude-opus-4-5', prompt: null, recherches: [], sitesVisites: [], erreur: err.message };
      }
    }
  } else {
    console.log('  ℹ️  ANTHROPIC_API_KEY absente — suggestions IA ignorées');
    sourcesLog.claude.erreur = 'ANTHROPIC_API_KEY absente';
    sourcesLog.claude_gratuites.erreur = 'ANTHROPIC_API_KEY absente';
    sourcesLog.web_search.erreur = 'ANTHROPIC_API_KEY absente';
  }

  let activitesFinales = resultats.length > 0 ? resultats : anciennes;

  // ── 5. Scoring IA de toutes les activités (si clé Anthropic disponible) ────
  if (anthKey && activitesFinales.length > 0) {
    try {
      console.log('\n→ Scoring IA : analyse de toutes les activités selon les profils famille...');
      activitesFinales = await scorerEtExpliquer(anthKey, activitesFinales);
    } catch (err) {
      console.warn('  ⚠️  Scoring global échoué:', err.message);
    }
  }

  writeFileSync(ancienFichier, JSON.stringify(activitesFinales, null, 2) + '\n');

  const meta = {
    lastUpdated: new Date().toISOString(),
    semaine: { debut: semaine.debut, fin: semaine.fin },
    source: sourceLabel,
    count: activitesFinales.length,
    ticketmaster: resultats.filter(e => e.source === 'ticketmaster').length,
    claude: resultats.filter(e => e.source === 'claude').length,
    gratuites: resultats.filter(e => e.gratuit === true).length,
    sources: sourcesLog,
  };
  writeFileSync(join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  console.log(`\n✅ ${activitesFinales.length} activités sauvegardées (${sourceLabel})`);
  console.log('   meta.json :', { ...meta, sources: '(voir fichier)' });
}

main().catch(err => { console.error('❌', err); process.exit(1); });
