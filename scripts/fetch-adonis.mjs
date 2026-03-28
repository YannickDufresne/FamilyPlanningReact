/**
 * fetch-adonis.mjs
 * Récupère les soldes Adonis via l'API TC Digital (même infrastructure que Metro)
 *
 * Approche :
 *   1. GET /api/flyers?storeId=21943 → liste des circulaires Adonis
 *   2. Filtrer par banner Adonis + tri décroissant par numéro
 *   3. Essayer chaque flyerId jusqu'à trouver le circulaire courant (validFrom ≤ today ≤ validTo)
 *   4. GET /api/pages/{flyerId}/21943/bil/ → pages avec produits structurés
 *   5. Sauvegarder src/data/adonis_aubaines.json
 *
 * Aucune clé API externe requise — credentials extraits du SPA public circulaire.groupeadonis.ca
 *
 * Usage : node scripts/fetch-adonis.mjs
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

const API_BASE = 'https://metrodigital-apim.azure-api.net/api';
const STORE_ID = '21943'; // Adonis Anjou (Montréal) par défaut
const LANGUAGE = 'bil'; // 'bil' = bilingue pour TC Digital
const ADONIS_BANNER_ID = '63fe18ec3e7cd81e86393c61';

// Credentials depuis circulaire.groupeadonis.ca/config/app.json
const API_HEADERS = {
  'Ocp-Apim-Subscription-Key': '0a112db32b2f42588b54063b05dfbc90',
  'Banner': ADONIS_BANNER_ID,
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

// ── Mapping catégories ────────────────────────────────────────────────────────
function detecterCategorie(nomFr, catMetro) {
  const n = (nomFr || '').toLowerCase();

  if (/poulet|boeuf|porc|veau|agneau|dinde|saucisse|bacon|jambon|haché|steak|côte|cote/.test(n)) return 'viande';
  if (/saumon|thon|crevette|poisson|morue|tilapia|truite|homard|pétoncle|petoncle/.test(n)) return 'poisson';
  if (/pomme|fraise|banane|orange|mangue|raisin|poire|bleuet|framboise|cerise|melon|ananas|avocat|citron|clémentine|clementine|kiwi|pamplemousse/.test(n)) return 'fruits';
  if (/laitue|épinard|epinard|carotte|brocoli|tomate|oignon|ail|courgette|patate|pomme de terre|légume|legume|céleri|celeri|poivron|chou|champignon|asperge|courge|betterave/.test(n)) return 'legumes';
  if (/lait|fromage|beurre|yogourt|crème|oeuf|œuf|halloumi|labneh|akkawi/.test(n)) return 'produits_laitiers';
  if (/pain|pita|pâte|pate|riz|farine|céréale|boulgour|couscous/.test(n)) return 'epicerie_seche';
  if (/huile|vinaigre|sauce|moutarde|épice|condiment/.test(n)) return 'condiments';

  const c = (catMetro || '').toLowerCase();
  if (/viande/.test(c)) return 'viande';
  if (/poisson|mer/.test(c)) return 'poisson';
  if (/fruits et légumes|légume/.test(c)) return 'legumes';
  if (/fromage|laitier/.test(c)) return 'produits_laitiers';

  return 'epicerie';
}

// ── Extraire les mots-clés ────────────────────────────────────────────────────
function extraireMosCles(nom) {
  const n = (nom || '').toLowerCase();
  const cles = [];

  if (/poulet/.test(n)) cles.push('poulet');
  if (/bœuf|boeuf/.test(n)) cles.push('boeuf');
  if (/agneau/.test(n)) cles.push('agneau');
  if (/saumon/.test(n)) cles.push('saumon');
  if (/thon/.test(n)) cles.push('thon');
  if (/crevette/.test(n)) cles.push('crevettes');
  if (/carotte/.test(n)) cles.push('carottes');
  if (/brocoli/.test(n)) cles.push('brocoli');
  if (/tomate/.test(n)) cles.push('tomates');
  if (/oignon/.test(n)) cles.push('oignons');
  if (/pomme de terre|russet|yukon/.test(n)) cles.push('pommes de terre');
  if (/pomme/.test(n) && !/pomme de terre/.test(n)) cles.push('pommes');
  if (/fraise/.test(n)) cles.push('fraises');
  if (/banane/.test(n)) cles.push('bananes');
  if (/orange/.test(n)) cles.push('oranges');
  if (/avocat/.test(n)) cles.push('avocat');
  if (/clémentine|clementine/.test(n)) cles.push('clémentines');
  if (/œuf|oeuf/.test(n)) cles.push('oeufs');
  if (/lait/.test(n)) cles.push('lait');
  if (/fromage|halloumi|labneh|akkawi|feta/.test(n)) cles.push('fromage');
  if (/beurre/.test(n)) cles.push('beurre');
  if (/yogourt/.test(n)) cles.push('yogourt');
  if (/pain|pita/.test(n)) cles.push('pain');
  if (/pâte|pate/.test(n) && !/patate/.test(n)) cles.push('pâtes');
  if (/riz/.test(n)) cles.push('riz');
  if (/huile/.test(n)) cles.push('huile');

  return cles.length > 0 ? cles : [nom.split(' ')[0].toLowerCase()];
}

// ── Parser un prix ────────────────────────────────────────────────────────────
function parsePrice(str) {
  if (!str) return null;
  const s = String(str);
  if (/\/lb|\/kg|\/100g/i.test(s)) return null;
  const match = s.match(/(\d+[.,]\d+|\d+)/);
  if (!match) return null;
  const n = parseFloat(match[1].replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── Convertir un produit ──────────────────────────────────────────────────────
function convertirProduit(prod) {
  const nomFr = [prod.productFr, prod.bodyFr].filter(Boolean).join(' — ') || null;
  if (!nomFr) return null;

  const salePrice = parsePrice(prod.salePrice || prod.salePriceFr);
  const regularPrice = parsePrice(prod.regularPrice);

  let rabais = prod.savingsFr || prod.savingsEn || '';
  if (!rabais && regularPrice && salePrice && regularPrice > salePrice) {
    const pct = Math.round(((regularPrice - salePrice) / regularPrice) * 100);
    rabais = `${pct}% de rabais`;
  }

  return {
    nom: nomFr.slice(0, 100),
    prix: salePrice,
    prix_texte: salePrice ? `${salePrice.toFixed(2)}$` : (prod.salePriceFr || prod.salePrice || ''),
    prix_regulier: regularPrice,
    prix_regulier_texte: regularPrice ? `${prod.regularPrice} (régulier)` : '',
    rabais,
    mots_cles: extraireMosCles(nomFr),
    categorie: detecterCategorie(nomFr, prod.mainCategoryFr),
    sku: prod.sku || null,
    image: prod.productImage || null,
    valide_de: prod.validFrom ? prod.validFrom.split('T')[0] : null,
    valide_au: prod.validTo ? prod.validTo.split('T')[0] : null,
    magasin: 'Adonis',
  };
}

// ── Trouver le flyerId courant ────────────────────────────────────────────────
async function getFlyerId() {
  console.log(`\n🔍 Recherche du circulaire Adonis courant (storeId=${STORE_ID})…`);

  const r = await fetch(`${API_BASE}/flyers?storeId=${STORE_ID}`, { headers: API_HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur /flyers?storeId=${STORE_ID}`);

  const flyers = await r.json();
  const today = new Date();

  // Filtrer par banner Adonis, numérique seulement, tri desc
  const adonisFlyers = flyers
    .filter(f => f.bannerId === ADONIS_BANNER_ID && /^\d{5}$/.test(f.title))
    .sort((a, b) => parseInt(b.title) - parseInt(a.title));

  if (adonisFlyers.length === 0) throw new Error('Aucun circulaire Adonis trouvé');

  console.log(`  📋 ${adonisFlyers.length} circulaires Adonis trouvés, essai des plus récents…`);

  // Essayer les 5 plus récents et trouver le courant
  for (const flyer of adonisFlyers.slice(0, 5)) {
    const flyerId = flyer.title;
    const pagesUrl = `${API_BASE}/pages/${flyerId}/${STORE_ID}/${LANGUAGE}/`;
    const rPages = await fetch(pagesUrl, { headers: API_HEADERS });

    if (!rPages.ok) {
      console.log(`  ⊗ ${flyerId} — pages non trouvées`);
      continue;
    }

    const pages = await rPages.json();

    // Trouver un produit et vérifier sa date de validité
    let validFrom = null, validTo = null;
    outer: for (const page of pages) {
      if (!page.blocks) continue;
      for (const block of page.blocks) {
        if (!block.products?.length) continue;
        const p = block.products[0];
        if (p.validFrom) { validFrom = new Date(p.validFrom); }
        if (p.validTo) { validTo = new Date(p.validTo); }
        if (validFrom) break outer;
      }
    }

    if (validFrom && validTo) {
      const isCurrent = validFrom <= today && today <= validTo;
      console.log(`  ${isCurrent ? '✅' : '⊗'} ${flyerId} — ${validFrom.toISOString().slice(0,10)} → ${validTo.toISOString().slice(0,10)}${isCurrent ? ' ← COURANT' : ''}`);
      if (isCurrent) return { flyerId, pages };
    } else {
      // Pas de dates — utiliser le plus récent
      console.log(`  ✅ ${flyerId} — pas de dates, utilisation par défaut`);
      return { flyerId, pages };
    }
  }

  // Fallback : utiliser le plus récent
  const fallbackId = adonisFlyers[0].title;
  console.warn(`  ⚠️ Aucun circulaire avec dates valides — utilisation du plus récent : ${fallbackId}`);
  const rFallback = await fetch(`${API_BASE}/pages/${fallbackId}/${STORE_ID}/${LANGUAGE}/`, { headers: API_HEADERS });
  if (!rFallback.ok) throw new Error(`Impossible de charger les pages pour ${fallbackId}`);
  return { flyerId: fallbackId, pages: await rFallback.json() };
}

// ── Extraire tous les produits uniques ───────────────────────────────────────
function extraireProduitsUniques(pages) {
  const items = [];
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
        if (item) items.push(item);
      }
    }
  }

  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const semaine = getSemaine();
  console.log(`\n🏪 Fetch circulaire Adonis — semaine du ${semaine}\n`);

  let flyerId, pages;
  try {
    ({ flyerId, pages } = await getFlyerId());
  } catch (err) {
    console.error(`❌ Erreur API Adonis : ${err.message}`);
    const empty = { semaine, genereeLe: new Date().toISOString(), storeId: STORE_ID, items: [] };
    writeFileSync(join(DATA_DIR, 'adonis_aubaines.json'), JSON.stringify(empty, null, 2), 'utf-8');
    return;
  }

  const items = extraireProduitsUniques(pages);

  const result = {
    semaine,
    genereeLe: new Date().toISOString(),
    flyerId,
    storeId: STORE_ID,
    source: 'metrodigital-apim.azure-api.net (TC Digital)',
    items,
  };

  const outPath = join(DATA_DIR, 'adonis_aubaines.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n✅ adonis_aubaines.json sauvegardé !`);
  console.log(`   ${items.length} soldes pour la semaine du ${semaine}`);

  console.log('\n📋 Aperçu (5 premiers) :');
  items.slice(0, 5).forEach(item => {
    console.log(`   • ${item.nom} — ${item.prix_texte}${item.rabais ? ` (${item.rabais})` : ''}`);
  });
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
