/**
 * fetch-metro.mjs
 * Récupère les soldes Metro via l'API TC Digital (metrodigital-apim.azure-api.net)
 *
 * Approche :
 *   1. GET https://www.metro.ca/circulaire → extraire le flyerId courant (autoSelectFlyerId)
 *   2. GET /api/pages/{flyerId}/628/bil/ → pages du circulaire avec produits structurés
 *   3. Extraire tous les products de tous les blocks de toutes les pages
 *   4. Convertir en format metro_aubaines.json
 *
 * Aucune clé API externe requise — credentials extraits du SPA public.
 *
 * Usage : node scripts/fetch-metro.mjs
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

const METRO_HOME_URL = 'https://www.metro.ca/circulaire';
const API_BASE = 'https://metrodigital-apim.azure-api.net/api';
const STORE_ID = '628'; // Metro Québec par défaut (Montréal)
const LANGUAGE = 'bil'; // 'bil' = bilingue (fr) pour TC Digital

// Credentials extraits du SPA public circulaire.metro.ca/config/app.json
const API_HEADERS = {
  'Ocp-Apim-Subscription-Key': '0a112db32b2f42588b54063b05dfbc90',
  'Banner': '62e3ee07ffe0e6f10778a56e',
  'content-type': 'application/json;charset=UTF-8',
  'x-api-version': '3.0',
  'Accept': 'application/json',
};

// ── Dates de la semaine (prochain lundi — même logique que fetch-aubaines.mjs) ─
function getSemaine() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 1 ? 0 : (8 - day) % 7;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diff);
  return lundi.toISOString().split('T')[0];
}

// ── Mapping catégories Metro → format interne ─────────────────────────────────
function mapCategorie(catFr) {
  if (!catFr) return 'epicerie';
  const c = catFr.toLowerCase();
  if (/viande|charcuterie/.test(c)) return 'viande';
  if (/poisson|fruits de mer/.test(c)) return 'poisson';
  if (/fruits et légumes|légume|fruit/.test(c)) {
    // Sous-distinction fruits vs légumes par le nom du produit
    return 'legumes'; // sera affiné au niveau produit si possible
  }
  if (/fromage|laitier|produits laitiers/.test(c)) return 'produits_laitiers';
  if (/boulangerie|pâtisserie/.test(c)) return 'epicerie_seche';
  if (/épicerie/.test(c)) return 'epicerie';
  if (/surgelé/.test(c)) return 'epicerie';
  if (/jus|rafraîchissement/.test(c)) return 'epicerie';
  if (/collation/.test(c)) return 'epicerie';
  return 'epicerie';
}

// ── Affiner la catégorie avec le nom du produit ───────────────────────────────
function detecterCategorie(nomFr, catMetro) {
  const n = (nomFr || '').toLowerCase();

  // Overrides par nom de produit
  if (/poulet|boeuf|porc|veau|agneau|dinde|saucisse|bacon|jambon|haché|steak|côte|cote/.test(n)) return 'viande';
  if (/saumon|thon|crevette|poisson|morue|tilapia|truite|homard|pétoncle|petoncle/.test(n)) return 'poisson';
  if (/pomme|fraise|banane|orange|mangue|raisin|poire|bleuet|framboise|cerise|melon|ananas|avocat|citron|pamplemousse|clémentine|clementine|kiwi/.test(n)) return 'fruits';
  if (/laitue|épinard|epinard|carotte|brocoli|tomate|oignon|ail|courgette|patate|pomme de terre|légume|legume|céleri|celeri|poivron|chou|champignon|asperge|courge|rutabaga|navet|betterave/.test(n)) return 'legumes';
  if (/lait|fromage|beurre|yogourt|crème|oeuf|œuf|mozzarella|cheddar|cottage/.test(n)) return 'produits_laitiers';
  if (/pain|pâte|pate|riz|farine|céréale|avoine|granola|biscuit|craquelin/.test(n)) return 'epicerie_seche';
  if (/huile|vinaigre|sauce|moutarde|épice|condiment|ketchup/.test(n)) return 'condiments';

  // Fallback sur la catégorie Metro
  return mapCategorie(catMetro);
}

// ── Extraire les mots-clés du nom de produit ─────────────────────────────────
function extraireMosCles(nom) {
  const n = (nom || '').toLowerCase();
  const cles = [];

  if (/poulet/.test(n)) cles.push('poulet');
  if (/bœuf|boeuf/.test(n)) cles.push('boeuf');
  if (/porc/.test(n)) cles.push('porc');
  if (/veau/.test(n)) cles.push('veau');
  if (/agneau/.test(n)) cles.push('agneau');
  if (/dinde/.test(n)) cles.push('dinde');
  if (/bacon/.test(n)) cles.push('bacon');
  if (/saucisse/.test(n)) cles.push('saucisse');
  if (/jambon/.test(n)) cles.push('jambon');
  if (/saumon/.test(n)) cles.push('saumon');
  if (/thon/.test(n)) cles.push('thon');
  if (/crevette/.test(n)) cles.push('crevettes');
  if (/carotte/.test(n)) cles.push('carottes');
  if (/brocoli/.test(n)) cles.push('brocoli');
  if (/épinard|epinard/.test(n)) cles.push('épinards');
  if (/tomate/.test(n)) cles.push('tomates');
  if (/oignon/.test(n)) cles.push('oignons');
  if (/pomme de terre|russet|yukon/.test(n)) cles.push('pommes de terre');
  if (/champignon/.test(n)) cles.push('champignons');
  if (/pomme/.test(n) && !/pomme de terre/.test(n)) cles.push('pommes');
  if (/fraise/.test(n)) cles.push('fraises');
  if (/bleuet/.test(n)) cles.push('bleuets');
  if (/banane/.test(n)) cles.push('bananes');
  if (/orange/.test(n)) cles.push('oranges');
  if (/mangue/.test(n)) cles.push('mangue');
  if (/avocat/.test(n)) cles.push('avocat');
  if (/clémentine|clementine/.test(n)) cles.push('clémentines');
  if (/œuf|oeuf/.test(n)) cles.push('oeufs');
  if (/lait/.test(n)) cles.push('lait');
  if (/fromage/.test(n)) cles.push('fromage');
  if (/beurre/.test(n)) cles.push('beurre');
  if (/yogourt/.test(n)) cles.push('yogourt');
  if (/pain/.test(n)) cles.push('pain');
  if (/pâte|pate/.test(n) && !/patate/.test(n)) cles.push('pâtes');
  if (/riz/.test(n)) cles.push('riz');

  return cles.length > 0 ? cles : [nom.split(' ')[0].toLowerCase()];
}

// ── Parser un prix texte en nombre ───────────────────────────────────────────
function parsePrice(str) {
  if (!str) return null;
  const s = String(str);
  // Skip prices that include unit-based pricing (per lb, per kg) — not comparable
  if (/\/lb|\/kg|\/100g/i.test(s)) return null;
  // Extract first decimal number
  const match = s.match(/(\d+[.,]\d+|\d+)/);
  if (!match) return null;
  const n = parseFloat(match[1].replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── Convertir un produit Metro en item aubaine ────────────────────────────────
function convertirProduit(prod) {
  const nomFr = [prod.productFr, prod.bodyFr].filter(Boolean).join(' — ') || null;
  if (!nomFr) return null;

  const salePrice = parsePrice(prod.salePrice || prod.salePriceFr);
  const regularPrice = parsePrice(prod.regularPrice);

  // Texte du rabais
  let rabais = prod.savingsFr || prod.savingsEn || '';
  if (!rabais && regularPrice && salePrice && regularPrice > salePrice) {
    const pct = Math.round(((regularPrice - salePrice) / regularPrice) * 100);
    rabais = `${pct}% de rabais`;
  }

  const categorie = detecterCategorie(nomFr, prod.mainCategoryFr);

  return {
    nom: nomFr.slice(0, 100),
    prix: salePrice,
    prix_texte: salePrice ? `${salePrice.toFixed(2)}$` : (prod.salePriceFr || prod.salePrice || ''),
    prix_regulier: regularPrice,
    prix_regulier_texte: regularPrice ? `${prod.regularPrice} (régulier)` : '',
    rabais,
    mots_cles: extraireMosCles(nomFr),
    categorie,
    sku: prod.sku || null,
    image: prod.productImage || null,
    valide_de: prod.validFrom ? prod.validFrom.split('T')[0] : null,
    valide_au: prod.validTo ? prod.validTo.split('T')[0] : null,
    magasin: 'Metro',
  };
}

// ── Étape 1 : Trouver le flyerId courant sur metro.ca ────────────────────────
async function getFlyerId() {
  console.log(`\n🌐 Recherche du flyerId sur ${METRO_HOME_URL}…`);

  const resp = await fetch(METRO_HOME_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-CA,fr;q=0.9',
    },
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status} sur metro.ca`);

  const html = await resp.text();
  const match = html.match(/autoSelectFlyerId\s*=\s*[\"']?(\d+)/);
  if (!match) throw new Error('flyerId introuvable sur metro.ca');

  const flyerId = match[1];
  console.log(`  ✅ flyerId courant : ${flyerId}`);
  return flyerId;
}

// ── Étape 2 : Récupérer les pages du circulaire ───────────────────────────────
async function getPages(flyerId) {
  const url = `${API_BASE}/pages/${flyerId}/${STORE_ID}/${LANGUAGE}/`;
  console.log(`\n📄 Téléchargement des pages : ${url}`);

  const resp = await fetch(url, { headers: API_HEADERS });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status} — ${text}`);
  }

  const pages = await resp.json();
  console.log(`  ✅ ${pages.length} pages récupérées`);
  return pages;
}

// ── Étape 3 : Extraire tous les produits uniques ──────────────────────────────
function extraireProduitsUniques(pages) {
  const allProducts = [];
  const seenSkus = new Set();

  for (const page of pages) {
    if (!page.blocks) continue;
    for (const block of page.blocks) {
      if (!block.products) continue;
      for (const prod of block.products) {
        const key = prod.sku || prod.productFr;
        if (!key || seenSkus.has(key)) continue;
        seenSkus.add(key);
        const item = convertirProduit(prod);
        if (item) allProducts.push(item);
      }
    }
  }

  return allProducts;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const semaine = getSemaine();
  console.log(`\n🏪 Fetch circulaire Metro — semaine du ${semaine}\n`);

  let flyerId;
  try {
    flyerId = await getFlyerId();
  } catch (err) {
    console.warn(`⚠️  Impossible de trouver le flyerId : ${err.message}`);
    console.log('   Utilisation du flyerId de secours : 82852');
    flyerId = '82852';
  }

  let pages;
  try {
    pages = await getPages(flyerId);
  } catch (err) {
    console.error(`❌ Erreur API Metro : ${err.message}`);
    const empty = { semaine, genereeLe: new Date().toISOString(), storeId: STORE_ID, items: [] };
    writeFileSync(join(DATA_DIR, 'metro_aubaines.json'), JSON.stringify(empty, null, 2), 'utf-8');
    return;
  }

  const items = extraireProduitsUniques(pages);

  const result = {
    semaine,
    genereeLe: new Date().toISOString(),
    flyerId,
    storeId: STORE_ID,
    source: 'metrodigital-apim.azure-api.net',
    items,
  };

  const outPath = join(DATA_DIR, 'metro_aubaines.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n✅ metro_aubaines.json sauvegardé !`);
  console.log(`   ${items.length} soldes pour la semaine du ${semaine}`);

  // Aperçu des premiers items
  console.log('\n📋 Aperçu (5 premiers) :');
  items.slice(0, 5).forEach(item => {
    console.log(`   • ${item.nom} — ${item.prix_texte}${item.rabais ? ` (${item.rabais})` : ''}`);
  });
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
