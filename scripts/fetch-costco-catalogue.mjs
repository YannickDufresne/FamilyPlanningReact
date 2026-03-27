/**
 * fetch-costco-catalogue.mjs
 * Télécharge le catalogue complet Costco Canada (épicerie).
 *
 * Ce script doit être exécuté UNE FOIS PAR MOIS, pas chaque semaine.
 * Le fichier produit (src/data/costco_catalogue.json) est ensuite utilisé
 * chaque semaine par fetch-aubaines.mjs pour sélectionner des items pertinents.
 *
 * Stratégies (essayées en ordre) :
 *   1. API AjaxCatalogRouter Costco (JSON natif)
 *   2. Pages catégories HTML → extraction JSON-LD / window.__INITIAL_STATE__
 *   3. Fallback Claude : catalogue réaliste généré par IA
 *
 * Usage : node scripts/fetch-costco-catalogue.mjs
 *         ANTHROPIC_API_KEY=... node scripts/fetch-costco-catalogue.mjs
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');
const OUT_PATH = join(DATA_DIR, 'costco_catalogue.json');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'fr-CA,fr;q=0.9',
  'Referer': 'https://www.costco.ca/',
};

const CATEGORY_PAGES = [
  'https://www.costco.ca/grocery-household.html',
  'https://www.costco.ca/meat-seafood.html',
  'https://www.costco.ca/fresh-products.html',
  'https://www.costco.ca/dairy-eggs.html',
  'https://www.costco.ca/frozen-foods.html',
  'https://www.costco.ca/bakery.html',
  'https://www.costco.ca/deli.html',
];

// IDs de catégories pour l'API AJAX Costco
const AJAX_CATEGORIES = [
  { id: 'BC_1000046', label: 'épicerie' },
  { id: 'BC_1000049', label: 'viande' },
  { id: 'BC_1000050', label: 'produits_laitiers' },
];

// ── Utilitaires ───────────────────────────────────────────────────────────────

function detecterCategorie(nom) {
  const n = (nom || '').toLowerCase();
  if (/poulet|boeuf|porc|veau|agneau|dinde|viande|côte|steak|bacon|saucisse|kirkland.*chicken/.test(n)) return 'viande';
  if (/saumon|thon|crevette|poisson|morue|tilapia|truite|fruits de mer|seafood|salmon|shrimp/.test(n)) return 'poisson';
  if (/laitue|épinard|spinach|carotte|brocoli|tomate|oignon|ail|courgette|patate|légume|céleri|poivron|chou|champignon/.test(n)) return 'legumes';
  if (/pomme|fraise|banane|orange|citron|mangue|raisin|poire|fruit|bleuet|berry/.test(n)) return 'fruits';
  if (/lait|fromage|beurre|yogourt|crème|œuf|oeuf|egg|cheese|butter|cream/.test(n)) return 'produits_laitiers';
  if (/pâte|pasta|riz|farine|pain|céréale|avoine|granola|rice|flour/.test(n)) return 'epicerie_seche';
  if (/huile|vinaigre|sauce|moutarde|épice|herbe|oil|vinegar/.test(n)) return 'condiments';
  if (/surgelé|frozen|ice cream|glace/.test(n)) return 'surgele';
  return 'epicerie_seche';
}

function extraireMotsCles(nom) {
  const stopWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'avec', 'et', 'ou', 'en', 'au', 'aux', 'par', 'sur', 'pour', 'kirkland', 'signature']);
  return (nom || '')
    .toLowerCase()
    .split(/[\s,\/\-\(\)]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))
    .slice(0, 5);
}

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

function normaliserProduit(nom, prix, unite = '') {
  return {
    nom,
    prix: typeof prix === 'string' ? parseFloat(prix) : prix,
    prix_texte: `${typeof prix === 'number' ? prix.toFixed(2) : prix}$`,
    unite,
    mots_cles: extraireMotsCles(nom),
    categorie: detecterCategorie(nom),
  };
}

// ── Stratégie 1 : API AjaxCatalogRouter ──────────────────────────────────────

async function fetchViaAjaxApi() {
  const produits = [];

  for (const cat of AJAX_CATEGORIES) {
    for (let page = 1; page <= 3; page++) {
      const url = `https://www.costco.ca/AjaxCatalogRouter?storeId=10301&langId=-24&catalogId=10701&categoryId=${cat.id}&showProducts=true&sortBy=PRICE_LOW_TO_HIGH&pageSize=96&pageNumber=${page}`;
      console.log(`  → AJAX API ${cat.label} page ${page}: ${url}`);

      try {
        const res = await fetchWithTimeout(url, { headers: FETCH_HEADERS });
        if (!res.ok) { console.warn(`    ⚠️ HTTP ${res.status}`); break; }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('json')) {
          const text = await res.text();
          // Chercher du JSON embarqué
          const jsonMatch = text.match(/\{[\s\S]{100,}\}/);
          if (!jsonMatch) { console.warn('    ⚠️ Réponse non-JSON'); break; }
          try {
            const data = JSON.parse(jsonMatch[0]);
            const items = data.catalogEntryView ?? data.products ?? [];
            items.forEach(item => {
              const nom = item.name || item.shortDescription || '';
              const prix = item.offerPrice || item.listPrice || item.price;
              if (nom && prix) produits.push(normaliserProduit(nom, parseFloat(prix)));
            });
            if (items.length === 0) break;
          } catch { break; }
          continue;
        }

        const data = await res.json();
        const items = data.catalogEntryView ?? data.products ?? [];
        if (!items.length) break;

        items.forEach(item => {
          const nom = item.name || item.shortDescription || '';
          const prix = item.offerPrice || item.listPrice || item.price;
          if (nom && prix) produits.push(normaliserProduit(nom, parseFloat(prix)));
        });

        console.log(`    → ${items.length} produits (catégorie ${cat.label})`);
      } catch (e) {
        console.warn(`    ⚠️ Erreur: ${e.message}`);
        break;
      }
    }
  }

  return produits;
}

// ── Stratégie 2 : Pages HTML catégories ──────────────────────────────────────

async function fetchViaHtmlPages() {
  const produits = [];

  for (const pageUrl of CATEGORY_PAGES) {
    console.log(`  → Page HTML: ${pageUrl}`);
    try {
      const res = await fetchWithTimeout(pageUrl, { headers: { ...FETCH_HEADERS, Accept: 'text/html,application/xhtml+xml,*/*' } });
      if (!res.ok) { console.warn(`    ⚠️ HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Tentative 1 : window.__INITIAL_STATE__
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          const findProducts = (obj, depth = 0) => {
            if (!obj || typeof obj !== 'object' || depth > 8) return;
            if (Array.isArray(obj)) { obj.forEach(i => findProducts(i, depth + 1)); return; }
            if (obj.name && (obj.price || obj.offerPrice || obj.listPrice)) {
              const prix = parseFloat(obj.price || obj.offerPrice || obj.listPrice);
              if (prix > 0) produits.push(normaliserProduit(obj.name, prix, obj.unit || ''));
              return;
            }
            Object.values(obj).forEach(v => findProducts(v, depth + 1));
          };
          findProducts(state);
        } catch {}
      }

      // Tentative 2 : JSON-LD
      for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          const data = JSON.parse(match[1]);
          const items = Array.isArray(data) ? data : [data];
          items.filter(d => d['@type'] === 'Product' && d.name).forEach(p => {
            const prix = p.offers?.price ?? p.offers?.lowPrice;
            if (prix) produits.push(normaliserProduit(p.name, parseFloat(prix)));
          });
        } catch {}
      }

      // Tentative 3 : Blocs <script type="application/json">
      for (const match of html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          const data = JSON.parse(match[1]);
          const items = Array.isArray(data) ? data : (data.products ?? data.items ?? []);
          items.filter(i => i.name && i.price).forEach(p => {
            produits.push(normaliserProduit(p.name, parseFloat(p.price)));
          });
        } catch {}
      }

      // Tentative 4 : productDataLayer / digitalData
      const layerMatch = html.match(/(?:productDataLayer|digitalData\.product)\s*=\s*(\[[\s\S]*?\]);/);
      if (layerMatch) {
        try {
          const items = JSON.parse(layerMatch[1]);
          items.filter(i => i.productInfo?.productName).forEach(p => {
            const prix = parseFloat(p.price?.sellingPrice || p.price?.basePrice || 0);
            if (prix > 0) produits.push(normaliserProduit(p.productInfo.productName, prix));
          });
        } catch {}
      }

      // Tentative 5 : Regex noms + prix depuis HTML
      if (produits.length === 0) {
        const pairRe = /(?:automation-id=["']product-title["']|class=["'][^"']*description[^"']*["'])[^>]*>([^<]{5,80})<[\s\S]{0,300}?\$\s*([0-9]{1,4}(?:\.[0-9]{2})?)/g;
        for (const m of html.matchAll(pairRe)) {
          const nom = m[1].trim().replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
          if (nom.length > 3) produits.push(normaliserProduit(nom, parseFloat(m[2])));
        }
      }

      console.log(`    → ${produits.length} produits cumulés jusqu'ici`);
    } catch (e) {
      console.warn(`    ⚠️ Erreur: ${e.message}`);
    }
  }

  return produits;
}

// ── Stratégie 3 : Fallback Claude ────────────────────────────────────────────

async function genererViaClaude() {
  console.log('\n→ Stratégie 3 : Génération catalogue via Claude (fallback)');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  ⚠️ ANTHROPIC_API_KEY manquante — impossible de générer via Claude');
    return [];
  }

  const prompt = `Génère un catalogue réaliste de 70 produits d'épicerie Costco Canada avec prix en dollars canadiens (2026).
Focus sur ce qu'une famille québécoise achète : viandes, poissons, produits laitiers, épicerie sèche, sauces, fromages, noix, huiles.
Format JSON strict — retourne UNIQUEMENT le JSON, sans texte autour :
{
  "produits": [
    { "nom": "Poulet entier Kirkland (2 kg)", "prix": 18.99, "prix_texte": "18.99$", "unite": "2 kg", "mots_cles": ["poulet", "volaille"], "categorie": "viande" },
    { "nom": "Saumon atlantique côté (1.8 kg min.)", "prix": 14.99, "prix_texte": "14.99$/kg", "unite": "kg", "mots_cles": ["saumon"], "categorie": "poisson" }
  ]
}
Catégories valides : viande, poisson, legumes, fruits, produits_laitiers, epicerie_seche, condiments, surgele`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;

  // Extraire et parser le JSON
  const jsonMatch = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Aucun JSON dans la réponse Claude');

  let json = jsonMatch[0];
  json = json.replace(/,(\s*[\}\]])/g, '$1');
  const data = JSON.parse(json);

  const produits = data.produits ?? [];
  console.log(`  ✅ Claude a généré ${produits.length} produits`);
  return produits;
}

// ── Dédupliquer les produits ──────────────────────────────────────────────────

function deduplicateProduits(produits) {
  const seen = new Set();
  return produits.filter(p => {
    const key = p.nom.toLowerCase().trim().slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏪 Fetch catalogue Costco Canada (mensuel)…\n');
  console.log('Note : Ce script est conçu pour être exécuté une fois par mois.\n');

  let produits = [];
  let source = '';

  // Stratégie 1 : API AJAX
  console.log('→ Stratégie 1 : API AjaxCatalogRouter Costco');
  try {
    const result = await fetchViaAjaxApi();
    if (result.length > 5) {
      produits = result;
      source = 'api_ajax';
      console.log(`  ✅ Stratégie 1 réussie: ${produits.length} produits`);
    } else {
      console.warn(`  ⚠️ Stratégie 1: seulement ${result.length} produits — passage à la stratégie 2`);
    }
  } catch (e) {
    console.warn(`  ⚠️ Stratégie 1 échouée: ${e.message}`);
  }

  // Stratégie 2 : Pages HTML
  if (produits.length < 10) {
    console.log('\n→ Stratégie 2 : Pages HTML catégories Costco');
    try {
      const result = await fetchViaHtmlPages();
      if (result.length > 5) {
        produits = [...produits, ...result];
        source = source ? `${source}+html` : 'html';
        console.log(`  ✅ Stratégie 2: ${result.length} produits supplémentaires (total: ${produits.length})`);
      } else {
        console.warn(`  ⚠️ Stratégie 2: seulement ${result.length} produits`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Stratégie 2 échouée: ${e.message}`);
    }
  }

  // Stratégie 3 : Fallback Claude
  if (produits.length < 10) {
    console.log('\n⚠️  Scraping insuffisant — fallback Claude');
    try {
      const result = await genererViaClaude();
      produits = result;
      source = 'claude_fallback';
    } catch (e) {
      console.error(`  ❌ Fallback Claude échoué: ${e.message}`);
    }
  }

  // Déduplication
  produits = deduplicateProduits(produits);

  const output = {
    genereeLe: new Date().toISOString(),
    source: source || 'inconnu',
    produits,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ costco_catalogue.json sauvegardé !`);
  console.log(`   Source   : ${output.source}`);
  console.log(`   Produits : ${produits.length}`);

  if (produits.length > 0) {
    const parCat = {};
    produits.forEach(p => { parCat[p.categorie] = (parCat[p.categorie] || 0) + 1; });
    console.log('\n  Par catégorie :');
    Object.entries(parCat).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
      console.log(`    ${cat.padEnd(20)} : ${n}`);
    });
  }

  if (produits.length === 0) {
    console.warn('\n⚠️  Aucun produit récupéré. Exécutez à nouveau avec ANTHROPIC_API_KEY pour le fallback Claude.');
  }
}

main().catch(e => {
  console.error('❌ Erreur fatale:', e.message);
  // Sauvegarder un fichier vide pour ne pas bloquer d'autres scripts
  const empty = { genereeLe: new Date().toISOString(), source: 'erreur', produits: [] };
  try {
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2), 'utf-8');
    console.log('  → costco_catalogue.json vide sauvegardé (fallback)');
  } catch {}
  process.exit(0);
});
