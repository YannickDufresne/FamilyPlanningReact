/**
 * fetch-costco-flipp.mjs
 * Récupère les aubaines hebdomadaires Costco Canada via le circulaire Flipp
 * et Claude Vision pour extraire les produits alimentaires.
 *
 * Étapes :
 *   1. Trouve le circulaire Costco Canada courant via l'API Flipp
 *   2. Télécharge chaque page en JPG depuis le CDN f.wishabi.net
 *   3. Envoie chaque image à Claude Vision pour extraire les produits
 *   4. Sauvegarde src/data/costco_aubaines.json
 *
 * Variables d'environnement :
 *   ANTHROPIC_API_KEY — requis pour Claude Vision
 *
 * Usage : ANTHROPIC_API_KEY=xxx node scripts/fetch-costco-flipp.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');
const OUT_PATH = join(DATA_DIR, 'costco_aubaines.json');

const MAX_PAGES = 10; // Limiter à 10 pages max
const FRESHNESS_DAYS = 6; // Fraîcheur : 6 jours

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'fr-CA,fr;q=0.9',
};

// ── Dates de la semaine (prochain lundi) ──────────────────────────────────────
function getSemaine() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 1 ? 0 : (8 - day) % 7;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diff);
  return lundi.toISOString().split('T')[0];
}

// ── Vérification de fraîcheur ─────────────────────────────────────────────────
function aubainsSontFraiches(semaine) {
  if (!existsSync(OUT_PATH)) return false;
  try {
    const data = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
    if (!data.genereeLe) return false;
    if (data.semaine !== semaine) return false;
    const age = (Date.now() - new Date(data.genereeLe).getTime()) / (1000 * 60 * 60 * 24);
    if (age < FRESHNESS_DAYS) {
      const items = data.items?.length ?? 0;
      console.log(`  Aubaines Costco deja fraiches (${Math.round(age * 24)}h, semaine ${semaine}, ${items} items) — aucune regeneration`);
      return true;
    }
    console.log(`  Aubaines ont ${Math.round(age)} jours (> ${FRESHNESS_DAYS}) — regeneration…`);
    return false;
  } catch {
    return false;
  }
}

// ── Détection de catégorie par mots-clés ─────────────────────────────────────
function detecterCategorie(nom) {
  const n = (nom || '').toLowerCase();
  if (/poulet|boeuf|porc|veau|agneau|dinde|viande|côte|cote|steak|bacon|saucisse|haché|hache|bison|kirkland.*chicken/.test(n)) return 'viande';
  if (/saumon|thon|crevette|poisson|morue|tilapia|truite|fruits de mer|homard|pétoncle|petoncle|seafood|salmon|shrimp/.test(n)) return 'poisson';
  if (/laitue|épinard|epinard|carotte|brocoli|tomate|oignon|ail|courgette|patate|pomme de terre|légume|legume|céleri|celeri|poivron|chou|champignon|asperge|courge/.test(n)) return 'legumes';
  if (/pomme|fraise|banane|orange|citron|mangue|raisin|poire|fruit|bleuet|framboises|cerise|melon|ananas|avocat/.test(n)) return 'fruits';
  if (/lait|fromage|beurre|yogourt|crème|creme|œuf|oeuf|mozzarella|cheddar|cottage|egg|cheese|butter|cream/.test(n)) return 'produits_laitiers';
  if (/pâte|pate|riz|farine|pain|céréale|cereale|avoine|granola|biscuit|craquelin|pasta|rice|flour/.test(n)) return 'epicerie_seche';
  if (/huile|vinaigre|sauce|moutarde|épice|epice|herbe|condiment|ketchup|mayo|oil|vinegar/.test(n)) return 'condiments';
  if (/surgelé|surgele|frozen|glace|ice cream/.test(n)) return 'surgele';
  return 'epicerie';
}

// ── Extraction des mots-clés ──────────────────────────────────────────────────
function extraireMotsCles(nom) {
  const stopWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'avec', 'et', 'ou', 'en', 'au', 'aux', 'par', 'sur', 'pour', 'kirkland', 'signature', 'the', 'and', 'of', 'from']);
  return (nom || '')
    .toLowerCase()
    .split(/[\s,\/\-\(\)]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))
    .slice(0, 5);
}

// ── Fetch avec timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Trouver le circulaire Costco Canada sur Flipp ─────────────────────────────
async function trouverCirculaireFlipp() {
  const endpoints = [
    // Endpoint principal Flipp - circulaires par code postal
    {
      url: 'https://flipp.com/api/stores/flyers?locale=fr-ca&postal_code=H2X1Y4',
      label: 'flipp stores/flyers',
    },
    // API Wishabi v4
    {
      url: 'https://api.flipp.com/flyerkit/v4.0/flyers?locale=fr-ca&postal_code=H2X1Y4',
      label: 'flyerkit v4 flyers',
    },
    // API Wishabi publications
    {
      url: 'https://api.flipp.com/flyerkit/v4.0/publication/stores?locale=fr-ca&postal_code=H2X1Y4&store_code=costco',
      label: 'flyerkit v4 publication/stores',
    },
    // Flipp API v2 (ancien endpoint connu)
    {
      url: 'https://flipp.com/api/flyers?locale=fr-ca&postal_code=H2X1Y4&store_code=costco',
      label: 'flipp api v2 flyers',
    },
  ];

  for (const endpoint of endpoints) {
    console.log(`  Tentative: ${endpoint.label}`);
    try {
      const res = await fetchWithTimeout(endpoint.url, { headers: FETCH_HEADERS }, 10000);
      if (!res.ok) {
        console.log(`    HTTP ${res.status} — passer au suivant`);
        continue;
      }
      const contentType = res.headers.get('content-type') || '';
      const text = await res.text();

      // Chercher du JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Chercher un bloc JSON dans la réponse HTML
        const jsonMatch = text.match(/\{[\s\S]{50,}\}/);
        if (!jsonMatch) {
          console.log(`    Reponse non-JSON (${contentType})`);
          continue;
        }
        try { data = JSON.parse(jsonMatch[0]); } catch { continue; }
      }

      // Chercher Costco dans les données
      const flyer = extraireFlyerCostco(data);
      if (flyer) {
        console.log(`    Circulaire Costco trouve: ID=${flyer.id}, pages=${flyer.pages}`);
        return flyer;
      }
      console.log(`    Reponse OK mais Costco introuvable`);
    } catch (e) {
      console.log(`    Erreur: ${e.message}`);
    }
  }

  // Tentative finale : scraper la page Flipp Costco pour extraire des IDs
  return await extraireDepuisPageFlipp();
}

// ── Extraire l'info du circulaire Costco depuis la réponse JSON ───────────────
function extraireFlyerCostco(data) {
  // Normaliser en tableau
  const flyers = Array.isArray(data) ? data : (data.flyers ?? data.publications ?? data.items ?? data.data ?? []);
  if (!Array.isArray(flyers) || flyers.length === 0) return null;

  // Chercher Costco
  const costcoFlyer = flyers.find(f => {
    const name = (f.merchant_name || f.store_name || f.name || f.merchant || '').toLowerCase();
    return name.includes('costco');
  });

  if (!costcoFlyer) return null;

  // Extraire les infos clés
  const id = costcoFlyer.id || costcoFlyer.flyer_id || costcoFlyer.publication_id;
  const pages = costcoFlyer.page_count || costcoFlyer.pages || costcoFlyer.num_pages || 12;
  const validFrom = costcoFlyer.valid_from || costcoFlyer.start_date || costcoFlyer.date_from;

  if (!id) return null;

  return {
    id: String(id),
    pages: Math.min(parseInt(pages) || 12, MAX_PAGES),
    validFrom,
    merchant: costcoFlyer.merchant_name || costcoFlyer.store_name || 'Costco',
  };
}

// ── Scraper la page Flipp Costco en dernier recours ───────────────────────────
async function extraireDepuisPageFlipp() {
  const urls = [
    'https://flipp.com/fr-ca/flyers/costco',
    'https://flipp.com/en-ca/flyers/costco',
    'https://flipp.com/flyers/costco',
  ];

  for (const url of urls) {
    console.log(`  Scraping page Flipp: ${url}`);
    try {
      const res = await fetchWithTimeout(url, {
        headers: { ...FETCH_HEADERS, Accept: 'text/html,application/xhtml+xml,*/*' },
      }, 15000);

      if (!res.ok) continue;
      const html = await res.text();

      // Chercher des IDs de flyer dans le HTML
      // Pattern: /flyers/12345678 ou flyerId: 12345678
      const patterns = [
        /\/flyers\/(\d{6,10})/g,
        /flyer[_-]?id['":\s]+(\d{6,10})/gi,
        /publication[_-]?id['":\s]+(\d{6,10})/gi,
        /"id"\s*:\s*(\d{6,10})/g,
      ];

      const ids = new Set();
      for (const pattern of patterns) {
        for (const m of html.matchAll(pattern)) {
          ids.add(m[1]);
        }
      }

      // Chercher le nombre de pages
      const pagesMatch = html.match(/page[_-]?count['":\s]+(\d+)/i) ||
                         html.match(/num[_-]?pages['":\s]+(\d+)/i) ||
                         html.match(/"pages"\s*:\s*(\d+)/i);
      const pages = pagesMatch ? Math.min(parseInt(pagesMatch[1]), MAX_PAGES) : 10;

      // Prendre le premier ID trouvé (le plus récent en général)
      if (ids.size > 0) {
        const id = [...ids][0];
        console.log(`    ID Costco trouve dans HTML: ${id}, pages: ${pages}`);
        return { id, pages, validFrom: null, merchant: 'Costco' };
      }

      // Chercher dans les blocs JSON intégrés
      const jsonMatches = html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of jsonMatches) {
        try {
          const data = JSON.parse(match[1]);
          const flyer = extraireFlyerCostco(data);
          if (flyer) return flyer;
        } catch {}
      }

      // Chercher __NEXT_DATA__ ou window.__STATE__
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const flyer = chercherCostcoDansObjet(nextData);
          if (flyer) return flyer;
        } catch {}
      }
    } catch (e) {
      console.log(`    Erreur scraping: ${e.message}`);
    }
  }

  return null;
}

// ── Chercher récursivement les données Costco dans un objet JSON ──────────────
function chercherCostcoDansObjet(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return null;

  // Vérifier si cet objet est un flyer Costco
  const name = (obj.merchant_name || obj.store_name || obj.name || obj.merchant || '').toLowerCase();
  if (name.includes('costco') && (obj.id || obj.flyer_id || obj.publication_id)) {
    const id = obj.id || obj.flyer_id || obj.publication_id;
    const pages = Math.min(obj.page_count || obj.pages || obj.num_pages || 10, MAX_PAGES);
    return { id: String(id), pages, validFrom: obj.valid_from || null, merchant: 'Costco' };
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = chercherCostcoDansObjet(item, depth + 1);
      if (result) return result;
    }
  } else {
    for (const value of Object.values(obj)) {
      const result = chercherCostcoDansObjet(value, depth + 1);
      if (result) return result;
    }
  }

  return null;
}

// ── Construire les URLs des pages du circulaire ───────────────────────────────
function construireUrlsPages(flyerId, nbPages) {
  const urls = [];
  // Format CDN Wishabi/Flipp: https://f.wishabi.net/flyers/FLYER_ID/PAGE_NUMBER/large.jpg
  // Indices 0-based ou 1-based selon le circulaire
  for (let i = 1; i <= nbPages; i++) {
    urls.push({
      page: i,
      url: `https://f.wishabi.net/flyers/${flyerId}/${i}/large.jpg`,
    });
  }
  return urls;
}

// ── Vérifier si une URL d'image est accessible ───────────────────────────────
async function verifierImage(url) {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD', headers: FETCH_HEADERS }, 5000);
    return res.ok && (res.headers.get('content-type') || '').includes('image');
  } catch {
    return false;
  }
}

// ── Analyser une page avec Claude Vision ─────────────────────────────────────
async function analyserPageAvecClaude(anthropic, imageUrl, pageNum) {
  console.log(`    Page ${pageNum}: ${imageUrl}`);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'url',
            url: imageUrl,
          },
        },
        {
          type: 'text',
          text: `Analyse cette page du circulaire Costco Canada. Liste UNIQUEMENT les produits alimentaires (epicerie, viande, poisson, produits laitiers, fruits, legumes, surgeles, etc.) avec leurs prix.

Retourne un JSON strict sans markdown:
{
  "produits": [
    { "nom": "Nom du produit", "prix_texte": "XX.XX$", "prix": 12.99, "details": "details optionnels (taille, poids)" }
  ]
}

Si la page ne contient pas de produits alimentaires (page de couverture, produits menagers, electronique, vetements), retourne { "produits": [] }.`,
        },
      ],
    }],
  });

  const text = response.content[0].text;

  // Nettoyer et parser le JSON
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  try {
    const data = JSON.parse(jsonMatch[0].replace(/,(\s*[\}\]])/g, '$1'));
    return data.produits ?? [];
  } catch (e) {
    console.log(`      JSON malformé page ${pageNum}: ${e.message}`);
    return [];
  }
}

// ── Convertir un produit extrait par Vision en format final ──────────────────
function normaliserProduitVision(produit) {
  const nom = (produit.nom || '').slice(0, 100).trim();
  if (!nom) return null;

  let prix = produit.prix;
  if (typeof prix === 'string') {
    prix = parseFloat(prix.replace(/[^0-9.]/g, '')) || null;
  }

  const prixTexte = produit.prix_texte || (prix ? `${prix.toFixed(2)}$` : '');

  return {
    nom,
    prix: typeof prix === 'number' && prix > 0 ? prix : null,
    prix_texte: prixTexte,
    prix_regulier: null,
    prix_regulier_texte: '',
    rabais: '',
    mots_cles: extraireMotsCles(nom),
    categorie: detecterCategorie(nom),
    details: produit.details || '',
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const semaine = getSemaine();
  console.log(`\nFetch circulaire Costco Flipp — semaine du ${semaine}\n`);

  // Vérification de fraîcheur
  if (aubainsSontFraiches(semaine)) return;

  // Vérifier la clé API
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY manquante — impossible d\'utiliser Claude Vision');
    const empty = {
      semaine,
      genereeLe: new Date().toISOString(),
      flyerId: null,
      pages: 0,
      source: 'flipp/claude-vision',
      items: [],
      erreur: 'ANTHROPIC_API_KEY manquante',
    };
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2), 'utf-8');
    return;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Étape 1: Trouver le circulaire Costco sur Flipp
  console.log('Recherche du circulaire Costco sur Flipp…');
  let flyerInfo = null;

  try {
    flyerInfo = await trouverCirculaireFlipp();
  } catch (e) {
    console.error(`Erreur API Flipp: ${e.message}`);
  }

  if (!flyerInfo) {
    console.warn('Circulaire Costco introuvable sur Flipp — fallback gracieux');
    const empty = {
      semaine,
      genereeLe: new Date().toISOString(),
      flyerId: null,
      pages: 0,
      source: 'flipp/claude-vision',
      items: [],
      erreur: 'Circulaire introuvable sur Flipp',
    };
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2), 'utf-8');
    console.log('costco_aubaines.json sauvegarde (vide — Flipp inaccessible)');
    return;
  }

  console.log(`Circulaire trouve: ID=${flyerInfo.id}, ${flyerInfo.pages} pages`);

  // Étape 2: Construire les URLs des pages
  const pagesUrls = construireUrlsPages(flyerInfo.id, flyerInfo.pages);

  // Étape 3: Analyser chaque page avec Claude Vision
  console.log(`\nAnalyse Claude Vision (${pagesUrls.length} pages)…`);
  const tousLesProduits = [];
  let pagesTraitees = 0;
  let pagesAvecProduits = 0;
  let pagesInaccessibles = 0;

  for (const { page, url } of pagesUrls) {
    // Vérifier que l'image est accessible
    const accessible = await verifierImage(url);
    if (!accessible) {
      // Essayer avec index 0-based
      const urlAlt = `https://f.wishabi.net/flyers/${flyerInfo.id}/${page - 1}/large.jpg`;
      const accessibleAlt = await verifierImage(urlAlt);
      if (!accessibleAlt) {
        console.log(`  Page ${page}: inaccessible (${url})`);
        pagesInaccessibles++;
        if (pagesInaccessibles >= 3 && pagesTraitees === 0) {
          console.warn('  3 pages inaccessibles d\'affilee — le flyer ID est peut-etre invalide');
          break;
        }
        continue;
      }
      // Utiliser l'URL alternative
      console.log(`  Page ${page}: utilisation URL 0-based`);
      try {
        const produits = await analyserPageAvecClaude(anthropic, urlAlt, page);
        pagesTraitees++;
        if (produits.length > 0) {
          pagesAvecProduits++;
          tousLesProduits.push(...produits);
          console.log(`    -> ${produits.length} produits alimentaires`);
        } else {
          console.log(`    -> Aucun produit alimentaire (page non-alimentaire)`);
        }
      } catch (e) {
        console.warn(`    Erreur Vision page ${page}: ${e.message}`);
      }
      continue;
    }

    try {
      const produits = await analyserPageAvecClaude(anthropic, url, page);
      pagesTraitees++;
      if (produits.length > 0) {
        pagesAvecProduits++;
        tousLesProduits.push(...produits);
        console.log(`    -> ${produits.length} produits alimentaires`);
      } else {
        console.log(`    -> Aucun produit alimentaire (page non-alimentaire)`);
      }
    } catch (e) {
      console.warn(`    Erreur Vision page ${page}: ${e.message}`);
    }

    // Pause légère pour éviter de surcharger l'API
    if (pagesTraitees % 3 === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Étape 4: Normaliser et dédupliquer
  const seen = new Set();
  const items = tousLesProduits
    .map(normaliserProduitVision)
    .filter(p => {
      if (!p || !p.nom) return false;
      const key = p.nom.toLowerCase().slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Étape 5: Sauvegarder
  const result = {
    semaine,
    genereeLe: new Date().toISOString(),
    flyerId: flyerInfo.id,
    pages: pagesTraitees,
    source: 'flipp/claude-vision',
    items,
  };

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\ncostco_aubaines.json sauvegarde !`);
  console.log(`   Flyer ID : ${flyerInfo.id}`);
  console.log(`   Pages    : ${pagesTraitees} traitees (${pagesAvecProduits} avec produits alimentaires)`);
  console.log(`   Items    : ${items.length} produits alimentaires uniques`);

  if (items.length > 0) {
    console.log('\nAperceu (5 premiers) :');
    items.slice(0, 5).forEach(item => {
      console.log(`  - ${item.nom} — ${item.prix_texte}${item.categorie ? ` [${item.categorie}]` : ''}`);
    });
  }

  if (items.length === 0) {
    console.warn('\nAucun produit extrait. Verifiez que le flyer ID est valide et que les images sont accessibles.');
  }
}

main().catch(e => {
  console.error('Erreur fatale:', e.message);
  // Sauvegarder un fichier vide pour ne pas bloquer d'autres scripts
  const empty = {
    semaine: '',
    genereeLe: new Date().toISOString(),
    flyerId: null,
    pages: 0,
    source: 'flipp/claude-vision',
    items: [],
    erreur: e.message,
  };
  try {
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2), 'utf-8');
    console.log('costco_aubaines.json vide sauvegarde (fallback)');
  } catch {}
  process.exit(0);
});
