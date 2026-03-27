/**
 * fetch-maxi-loblaws.mjs
 * Récupère les soldes Maxi de la semaine via l'API PC Optimum / Loblaws.
 *
 * Approches (essayées en ordre, fallback à la suivante) :
 *   1. Store search + flyer (storeflyers endpoint)
 *   2. Product offer preview (weekly deals)
 *   3. Direct deals search (product-facade v3)
 *   4. IDs de magasins connus Maxi Québec avec approches 2 et 3
 *
 * Sauvegarde dans src/data/maxi_aubaines.json
 *
 * Usage : node scripts/fetch-maxi-loblaws.mjs
 *         LOBLAWS_API_KEY=... node scripts/fetch-maxi-loblaws.mjs  (optionnel)
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');
const OUT_PATH = join(DATA_DIR, 'maxi_aubaines.json');

// Clé API connue extraite de l'application Loblaws (partagée publiquement dans des projets open-source)
const LOBLAWS_API_KEY = process.env.LOBLAWS_API_KEY || '1im1hL52q9xvta16GlSdYDsTvG9OECD4';

const HEADERS = {
  'x-apikey': LOBLAWS_API_KEY,
  'x-application-type': 'Web',
  'x-loblaw-tenant-id': 'MCX',
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

// IDs de magasins Maxi connus dans la région de Québec
const KNOWN_STORE_IDS = ['1277', '1278', '1279', '3376', '3413', '3455', '3456'];

// ── Utilitaires ───────────────────────────────────────────────────────────────

function getSemaine() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 1 ? 0 : (8 - day) % 7;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diff);
  return lundi.toISOString().split('T')[0];
}

function detecterCategorie(nom) {
  const n = (nom || '').toLowerCase();
  if (/poulet|boeuf|porc|veau|agneau|dinde|viande|côte|steak|bacon|saucisse/.test(n)) return 'viande';
  if (/saumon|thon|crevette|poisson|morue|tilapia|truite|fruits de mer/.test(n)) return 'poisson';
  if (/laitue|épinard|spinach|carotte|brocoli|tomate|oignon|ail|courgette|patate|légume|céleri|poivron|chou|champignon/.test(n)) return 'legumes';
  if (/pomme|fraise|banane|orange|citron|mangue|raisin|poire|fruit|bleuet/.test(n)) return 'fruits';
  if (/lait|fromage|beurre|yogourt|crème|œuf|oeuf|egg/.test(n)) return 'produits_laitiers';
  if (/pâte|pasta|riz|farine|pain|céréale|avoine|granola/.test(n)) return 'epicerie_seche';
  if (/huile|vinaigre|sauce|moutarde|épice|herbe/.test(n)) return 'condiments';
  return 'epicerie';
}

function extraireMotsCles(nom) {
  const stopWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'avec', 'et', 'ou', 'en', 'au', 'aux', 'par', 'sur', 'pour']);
  return (nom || '')
    .toLowerCase()
    .split(/[\s,\/\-]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))
    .slice(0, 4);
}

function parserixTexte(item) {
  // Essayer plusieurs champs selon la structure retournée par l'API
  const prix = item.prices?.price?.value
    ?? item.prices?.wasPrice?.value
    ?? item.price
    ?? item.current_price
    ?? null;

  const prixReg = item.prices?.wasPrice?.value
    ?? item.regularPrice
    ?? item.was_price
    ?? null;

  const prixTexte = item.prices?.price?.text
    ?? item.displayPrice
    ?? item.display_price
    ?? (prix != null ? `${Number(prix).toFixed(2)}$` : '');

  const prixRegTexte = item.prices?.wasPrice?.text
    ?? (prixReg != null ? `${Number(prixReg).toFixed(2)}$` : '');

  let rabais = item.prices?.savedPrice?.text ?? item.badge?.label ?? item.sale_story ?? '';
  if (!rabais && prix != null && prixReg != null && prixReg > prix) {
    const pct = Math.round((1 - prix / prixReg) * 100);
    rabais = `${pct}% de rabais`;
  }

  const unite = item.unit ?? item.packageSize ?? item.size ?? '';

  return { prix: prix != null ? parseFloat(prix) : null, prix_texte: prixTexte, prix_regulier: prixReg != null ? parseFloat(prixReg) : null, prix_regulier_texte: prixRegTexte, rabais, unite };
}

function normaliserItems(rawItems) {
  return rawItems
    .filter(item => item && (item.name || item.brand))
    .map(item => {
      const nom = item.name ?? item.brand ?? '';
      const { prix, prix_texte, prix_regulier, prix_regulier_texte, rabais, unite } = parserixTexte(item);
      return {
        nom,
        prix,
        prix_texte,
        prix_regulier,
        prix_regulier_texte,
        rabais,
        unite,
        mots_cles: extraireMotsCles(nom),
        categorie: detecterCategorie(nom),
      };
    })
    .filter(item => item.prix != null || item.prix_texte);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
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

// ── Approche 1 : Store search → flyer ────────────────────────────────────────

async function fetchStoreId(postalCode = 'G1R3Z9') {
  const url = `https://api.pcexpress.ca/pcx-bff/api/v1/fulfillment/storeSearch?postalCode=${postalCode}&banner=maxi`;
  console.log(`  → Store search: ${url}`);
  const res = await fetchWithTimeout(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // La réponse peut être un tableau ou un objet avec une liste de magasins
  const stores = Array.isArray(data) ? data : (data.stores ?? data.results ?? []);
  if (!stores.length) throw new Error('Aucun magasin trouvé');

  const storeId = stores[0]?.storeId ?? stores[0]?.id ?? stores[0]?.store_id;
  if (!storeId) throw new Error('storeId introuvable dans la réponse');
  console.log(`  → storeId trouvé : ${storeId}`);
  return String(storeId);
}

async function fetchFlyer(storeId) {
  const url = `https://api.pcexpress.ca/pcx-bff/api/v1/storeflyers?storeId=${storeId}&banner=maxi&lang=fr`;
  console.log(`  → Flyer: ${url}`);
  const res = await fetchWithTimeout(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const items = data.items ?? data.products ?? data.flyerItems ?? [];
  if (!items.length) throw new Error('Flyer vide');
  return items;
}

// ── Approche 2 : Product offer preview ───────────────────────────────────────

async function fetchProductOffers(storeId) {
  const url = `https://api.pcexpress.ca/pcx-bff/api/v1/product-offer-preview?storeId=${storeId}&lang=fr&banner=maxi`;
  console.log(`  → Product offers: ${url}`);
  const res = await fetchWithTimeout(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const items = data.results ?? data.items ?? data.products ?? (Array.isArray(data) ? data : []);
  if (!items.length) throw new Error('Aucune offre trouvée');
  return items;
}

// ── Approche 3 : Direct deals search ─────────────────────────────────────────

async function fetchDealsSearch(storeId) {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://api.pcexpress.ca/product-facade/v3/products/search?storeId=${storeId}&lang=fr&date=${today}&bannerId=maxi&categoryId=deals&pageSize=48`;
  console.log(`  → Deals search: ${url}`);
  const res = await fetchWithTimeout(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const items = data.results ?? data.items ?? data.products ?? (Array.isArray(data) ? data : []);
  if (!items.length) throw new Error('Aucun deal trouvé');
  return items;
}

// ── Séquence complète pour un storeId donné ───────────────────────────────────

async function tryStoreId(storeId) {
  // Approche 2
  try {
    const items = await fetchProductOffers(storeId);
    console.log(`  ✅ Approche 2 (product-offer-preview) réussie pour storeId ${storeId}: ${items.length} items`);
    return { items, storeId, approche: 2 };
  } catch (e) {
    console.warn(`  ⚠️ Approche 2 storeId=${storeId}: ${e.message}`);
  }

  // Approche 3
  try {
    const items = await fetchDealsSearch(storeId);
    console.log(`  ✅ Approche 3 (deals search) réussie pour storeId ${storeId}: ${items.length} items`);
    return { items, storeId, approche: 3 };
  } catch (e) {
    console.warn(`  ⚠️ Approche 3 storeId=${storeId}: ${e.message}`);
  }

  return null;
}

// ── Approche 5 : Scraping maxi.ca (page circulaire Next.js) ──────────────────
// Le site maxi.ca est une app Next.js — la page circulaire embarque les données
// dans __NEXT_DATA__ ou fait des appels API côté client qu'on peut intercepter.

async function fetchMaxiWebsite() {
  const WEB_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  };

  const urls = [
    'https://www.maxi.ca/fr/circulaire-electronique/',
    'https://www.maxi.ca/fr/promotions/',
    'https://www.maxi.ca/fr/soldes-de-la-semaine/',
  ];

  for (const url of urls) {
    console.log(`  → Page web Maxi: ${url}`);
    try {
      // redirect: 'follow' est important — maxi.ca renvoie un 308 avant le 200
      const res = await fetchWithTimeout(url, { headers: WEB_HEADERS, redirect: 'follow' }, 15000);
      if (!res.ok) { console.warn(`    ⚠️ HTTP ${res.status}`); continue; }
      const html = await res.text();

      // Essai 1 : __NEXT_DATA__ (Next.js)
      const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextMatch) {
        try {
          const nextData = JSON.parse(nextMatch[1]);
          const items = [];
          // Parcourir récursivement pour trouver des produits avec prix
          const findProducts = (obj, depth = 0) => {
            if (depth > 8 || !obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) { obj.slice(0, 200).forEach(o => findProducts(o, depth + 1)); return; }
            const hasName = obj.name || obj.title || obj.productName;
            const hasPrice = obj.prices || obj.price || obj.currentPrice || obj.displayPrice;
            if (hasName && hasPrice) items.push(obj);
            Object.values(obj).forEach(v => findProducts(v, depth + 1));
          };
          findProducts(nextData);
          if (items.length > 0) {
            console.log(`    ✅ __NEXT_DATA__: ${items.length} produits trouvés`);
            return items.map(item => ({
              ...item,
              name: item.name || item.title || item.productName,
            }));
          }
        } catch (e) { console.warn(`    ⚠️ __NEXT_DATA__ parse error: ${e.message}`); }
      }

      // Essai 2 : JSON dans des blocs script génériques
      const scriptBlocks = [...html.matchAll(/<script[^>]*>([\s\S]{200,100000}?)<\/script>/g)];
      for (const block of scriptBlocks) {
        const src = block[1];
        if (!src.includes('"price"') && !src.includes('"currentPrice"') && !src.includes('"displayPrice"')) continue;
        // Chercher des tableaux de produits
        const arrayMatch = src.match(/\[(\s*\{[^[\]]*"name"[^[\]]*"price[^[\]]*\}[\s\S]{0,5000}?)\]/);
        if (arrayMatch) {
          try {
            const arr = JSON.parse('[' + arrayMatch[1] + ']');
            if (arr.length > 0) { console.log(`    ✅ Script inline: ${arr.length} items`); return arr; }
          } catch {}
        }
      }

      // Essai 3 : extraction HTML brute
      const nameRe = /<[^>]+(?:class|data-testid)="[^"]*(?:product|item|deal)[^"]*"[^>]*>\s*<[^>]+>\s*([^<]{5,80})\s*<\/[^>]+>/gi;
      const priceRe = /(\d{1,3}[.,]\d{2})\s*\$/g;
      const names = [...html.matchAll(nameRe)].map(m => m[1].trim()).filter(n => n.length > 3);
      const prices = [...html.matchAll(priceRe)].map(m => parseFloat(m[1].replace(',', '.')));
      if (names.length >= 3) {
        console.log(`    ✅ HTML regex: ${names.length} noms, ${prices.length} prix`);
        return names.slice(0, 30).map((name, i) => ({
          name,
          price: prices[i] || null,
          displayPrice: prices[i] ? `${prices[i].toFixed(2)}$` : '',
        }));
      }

    } catch (e) { console.warn(`    ⚠️ ${e.message}`); }
  }

  throw new Error('Toutes les URLs maxi.ca ont échoué');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏪 Fetch circulaire Maxi (API Loblaws/PC Optimum)…\n');
  console.log('💡 Pour utiliser la vraie clé API Loblaws :');
  console.log('   1. Ouvre Chrome → maxi.ca → F12 → Network → cherche "api.pcexpress.ca"');
  console.log('   2. Copie la valeur du header "x-apikey"');
  console.log('   3. Ajoute comme GitHub Secret : LOBLAWS_API_KEY\n');

  let rawItems = null;
  let storeId = '';

  // Approche 1 : store search → storeId → flyer
  try {
    console.log('→ Approche 1 : Store search + Flyer');
    storeId = await fetchStoreId('G1R3Z9');
    const items = await fetchFlyer(storeId);
    console.log(`  ✅ Approche 1 (flyer) réussie: ${items.length} items`);
    rawItems = items;
  } catch (e) {
    console.warn(`  ⚠️ Approche 1 échouée: ${e.message}`);
  }

  // Si approche 1 a trouvé un storeId, essayer approches 2 et 3 avec ce storeId
  if (!rawItems && storeId) {
    console.log(`\n→ Approches 2 et 3 avec storeId ${storeId} trouvé en approche 1`);
    const result = await tryStoreId(storeId);
    if (result) rawItems = result.items;
  }

  // Approche 4 : IDs connus Maxi Québec
  if (!rawItems) {
    console.log('\n→ Approche 4 : IDs de magasins connus Maxi Québec');
    for (const sid of KNOWN_STORE_IDS) {
      const result = await tryStoreId(sid);
      if (result) {
        rawItems = result.items;
        storeId = result.storeId;
        break;
      }
    }
  }

  // Approche 5 : Scraping direct de maxi.ca
  if (!rawItems) {
    console.log('\n→ Approche 5 : Scraping maxi.ca (page circulaire)');
    try {
      rawItems = await fetchMaxiWebsite();
      console.log(`  ✅ Approche 5 réussie: ${rawItems.length} items`);
    } catch (e) {
      console.warn(`  ⚠️ Approche 5 échouée: ${e.message}`);
    }
  }

  const semaine = getSemaine();
  const genereeLe = new Date().toISOString();

  if (!rawItems || rawItems.length === 0) {
    console.warn('\n⚠️  Toutes les approches ont échoué. Sauvegarde d\'un fichier vide.');
    const empty = { semaine, genereeLe, storeId: '', items: [] };
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2), 'utf-8');
    console.log(`\n✅ maxi_aubaines.json sauvegardé (vide) — fetch-aubaines.mjs utilisera Claude pour les soldes.`);
    return;
  }

  const items = normaliserItems(rawItems);

  const output = {
    semaine,
    genereeLe,
    storeId,
    items,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ maxi_aubaines.json sauvegardé !`);
  console.log(`   Magasin : ${storeId}`);
  console.log(`   Semaine : ${semaine}`);
  console.log(`   Items   : ${items.length} aubaines`);
  if (items.length > 0) {
    console.log('\n  Exemples :');
    items.slice(0, 5).forEach(it => console.log(`    - ${it.nom} : ${it.prix_texte}${it.rabais ? ' (' + it.rabais + ')' : ''}`));
  }
}

main().catch(e => {
  console.error('❌ Erreur fatale:', e.message);
  // En cas d'erreur, créer un fichier vide pour ne pas bloquer le pipeline
  const semaine = new Date().toISOString().split('T')[0];
  const empty = { semaine, genereeLe: new Date().toISOString(), storeId: '', items: [] };
  try {
    writeFileSync(OUT_PATH, JSON.stringify(empty, null, 2), 'utf-8');
    console.log('  → maxi_aubaines.json vide sauvegardé (fallback)');
  } catch {}
  process.exit(0); // Ne pas faire échouer le workflow
});
