/**
 * fetch-maxi-loblaws.mjs
 * Récupère les soldes Maxi via le scraping de __NEXT_DATA__ sur maxi.ca
 *
 * Approche :
 *   1. GET https://www.maxi.ca/fr/collection/deals-centre
 *   2. Extraire le bloc <script id="__NEXT_DATA__"> du HTML
 *   3. Parser le JSON → layout.sections.mainContentCollection.components[0].data.productTiles
 *   4. Convertir en format maxi_aubaines.json
 *
 * Aucune clé API requise — les données sont disponibles dans le HTML SSR de Next.js.
 *
 * Usage : node scripts/fetch-maxi-loblaws.mjs
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

const MAXI_DEALS_URL = 'https://www.maxi.ca/fr/collection/deals-centre';

// ── Dates de la semaine (prochain lundi) ──────────────────────────────────────
function getSemaine() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 1 ? 0 : (8 - day) % 7;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diff);
  return lundi.toISOString().split('T')[0];
}

// ── Détection de catégorie par mots-clés ─────────────────────────────────────
function detecterCategorie(nom) {
  const n = (nom || '').toLowerCase();
  if (/poulet|boeuf|porc|veau|agneau|dinde|viande|côte|cote|steak|bacon|saucisse|haché|hache|bison/.test(n)) return 'viande';
  if (/saumon|thon|crevette|poisson|morue|tilapia|truite|fruits de mer|homard|pétoncle|petoncle/.test(n)) return 'poisson';
  if (/laitue|épinard|epinard|carotte|brocoli|tomate|oignon|ail|courgette|patate|pomme de terre|légume|legume|céleri|celeri|poivron|chou|champignon|asperge|courge/.test(n)) return 'legumes';
  if (/pomme|fraise|banane|orange|citron|mangue|raisin|poire|fruit|bleuet|framboises|cerise|melon/.test(n)) return 'fruits';
  if (/lait|fromage|beurre|yogourt|crème|creme|œuf|oeuf|mozzarella|cheddar|cottage/.test(n)) return 'produits_laitiers';
  if (/pâte|pate|riz|farine|pain|céréale|cereale|avoine|granola|biscuit|craquelin/.test(n)) return 'epicerie_seche';
  if (/huile|vinaigre|sauce|moutarde|épice|epice|herbe|condiment|ketchup|mayo/.test(n)) return 'condiments';
  return 'epicerie';
}

// ── Extraire les mots-clés pertinents du nom de produit ──────────────────────
function extraireMosCles(nom) {
  const n = (nom || '').toLowerCase();
  const cles = [];

  // Viandes
  if (/poulet/.test(n)) cles.push('poulet');
  if (/bœuf|boeuf/.test(n)) cles.push('boeuf');
  if (/porc/.test(n)) cles.push('porc');
  if (/veau/.test(n)) cles.push('veau');
  if (/agneau/.test(n)) cles.push('agneau');
  if (/dinde/.test(n)) cles.push('dinde');
  if (/bacon/.test(n)) cles.push('bacon');
  if (/saucisse/.test(n)) cles.push('saucisse');
  if (/jambon/.test(n)) cles.push('jambon');

  // Poissons
  if (/saumon/.test(n)) cles.push('saumon');
  if (/thon/.test(n)) cles.push('thon');
  if (/crevette/.test(n)) cles.push('crevettes');
  if (/poisson/.test(n)) cles.push('poisson');
  if (/morue|cabillaud/.test(n)) cles.push('morue');

  // Légumes
  if (/carotte/.test(n)) cles.push('carottes');
  if (/brocoli/.test(n)) cles.push('brocoli');
  if (/épinard|epinard/.test(n)) cles.push('épinards');
  if (/tomate/.test(n)) cles.push('tomates');
  if (/oignon/.test(n)) cles.push('oignons');
  if (/pomme de terre|russet|yukon/.test(n)) cles.push('pommes de terre');
  if (/poivron/.test(n)) cles.push('poivron');
  if (/chou-fleur|choufleur/.test(n)) cles.push('chou-fleur');
  if (/chou/.test(n) && !/chou-fleur|choufleur/.test(n)) cles.push('chou');
  if (/champignon/.test(n)) cles.push('champignons');
  if (/céleri|celeri/.test(n)) cles.push('céleri');
  if (/courge|butternut|courgette/.test(n)) cles.push('courge');
  if (/asperge/.test(n)) cles.push('asperges');

  // Fruits
  if (/pomme/.test(n) && !/pomme de terre/.test(n)) cles.push('pommes');
  if (/fraise/.test(n)) cles.push('fraises');
  if (/bleuet/.test(n)) cles.push('bleuets');
  if (/framboise/.test(n)) cles.push('framboises');
  if (/banane/.test(n)) cles.push('bananes');
  if (/orange/.test(n)) cles.push('oranges');
  if (/mangue/.test(n)) cles.push('mangue');
  if (/ananas/.test(n)) cles.push('ananas');
  if (/avocat/.test(n)) cles.push('avocat');

  // Produits laitiers / œufs
  if (/œuf|oeuf/.test(n)) cles.push('oeufs');
  if (/lait/.test(n)) cles.push('lait');
  if (/fromage/.test(n)) cles.push('fromage');
  if (/mozzarella/.test(n)) cles.push('mozzarella');
  if (/cheddar/.test(n)) cles.push('cheddar');
  if (/beurre/.test(n)) cles.push('beurre');
  if (/yogourt/.test(n)) cles.push('yogourt');
  if (/crème sure|creme sure/.test(n)) cles.push('crème sure');

  // Épicerie sèche
  if (/pain/.test(n)) cles.push('pain');
  if (/pâte|pate/.test(n) && !/patate|pâtisserie/.test(n)) cles.push('pâtes');
  if (/riz/.test(n)) cles.push('riz');
  if (/farine/.test(n)) cles.push('farine');
  if (/huile/.test(n)) cles.push('huile');

  return cles.length > 0 ? cles : [nom.split(' ')[0].toLowerCase()];
}

// ── Calculer le % de rabais ───────────────────────────────────────────────────
function calculerRabais(prixActuel, wasPrice) {
  if (!wasPrice) return '';
  // wasPrice is a French-formatted string like "8,00 $"
  const was = parseFloat(wasPrice.replace(/[^0-9,]/g, '').replace(',', '.'));
  const now = parseFloat(prixActuel);
  if (!was || !now || was <= now) return '';
  const pct = Math.round(((was - now) / was) * 100);
  return `${pct}% de rabais`;
}

// ── Convertir un productTile en item aubaine ──────────────────────────────────
function convertirTile(tile) {
  const nom = [tile.brand, tile.title].filter(Boolean).join(' ') || tile.title || '?';
  const prixNum = parseFloat(tile.pricing?.price) || null;
  const displayPrice = tile.pricing?.displayPrice || (prixNum ? `${prixNum.toFixed(2)}$` : '');
  const wasPrice = tile.pricing?.wasPrice || null;
  const wasNum = wasPrice ? parseFloat(wasPrice.replace(/[^0-9,]/g, '').replace(',', '.')) : null;

  // Construire le texte de prix avec la taille si disponible
  const prixTexte = tile.packageSizing
    ? `${displayPrice} (${tile.packageSizing})`
    : displayPrice;

  // Texte de rabais : préférer le texte de l'API, sinon calculer
  const rabaisTexte = tile.deal?.text
    ? tile.deal.text
    : calculerRabais(tile.pricing?.price, wasPrice);

  return {
    nom: nom.slice(0, 80),
    prix: prixNum,
    prix_texte: prixTexte,
    prix_regulier: wasNum,
    prix_regulier_texte: wasPrice ? `${wasPrice} (régulier)` : '',
    rabais: rabaisTexte,
    mots_cles: extraireMosCles(nom),
    categorie: detecterCategorie(nom),
  };
}

// ── Scraper __NEXT_DATA__ depuis maxi.ca ──────────────────────────────────────
async function scrapeNextData() {
  console.log(`\n🌐 Téléchargement de ${MAXI_DEALS_URL}…`);

  const resp = await fetch(MAXI_DEALS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-CA,fr;q=0.9',
    },
    redirect: 'follow',
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const html = await resp.text();
  console.log(`  ✅ Page téléchargée (${Math.round(html.length / 1024)} Ko)`);

  // Extraire le JSON __NEXT_DATA__
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('__NEXT_DATA__ introuvable dans le HTML');
  }

  const nextData = JSON.parse(match[1]);
  console.log('  ✅ __NEXT_DATA__ extrait et parsé');

  // Naviguer jusqu'aux productTiles
  const productTiles =
    nextData?.props?.pageProps?.initialData?.layout?.sections
      ?.mainContentCollection?.components?.[0]?.data?.productTiles;

  if (!productTiles || productTiles.length === 0) {
    throw new Error('Aucun productTile trouvé dans __NEXT_DATA__');
  }

  console.log(`  ✅ ${productTiles.length} soldes trouvés dans __NEXT_DATA__`);
  return productTiles;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const semaine = getSemaine();
  console.log(`\n🏪 Fetch circulaire Maxi — semaine du ${semaine}\n`);

  let productTiles;
  try {
    productTiles = await scrapeNextData();
  } catch (err) {
    console.error(`❌ Scraping échoué : ${err.message}`);
    console.log('\n⚠️  Aucune donnée Maxi disponible — fetch-aubaines.mjs générera des soldes via Claude.');

    // Sauvegarder un fichier vide pour indiquer l'échec
    const empty = { semaine: '', genereeLe: new Date().toISOString(), storeId: '', items: [] };
    writeFileSync(join(DATA_DIR, 'maxi_aubaines.json'), JSON.stringify(empty, null, 2), 'utf-8');
    return;
  }

  // Convertir les tiles en items aubaines
  // Garder seulement les items avec un vrai rabais (wasPrice ou deal text intéressant)
  const items = productTiles
    .map(convertirTile)
    .filter(item => item.prix !== null); // Exclure les items sans prix

  const result = {
    semaine,
    genereeLe: new Date().toISOString(),
    storeId: 'deals-centre',
    source: 'maxi.ca/__NEXT_DATA__',
    items,
  };

  const outPath = join(DATA_DIR, 'maxi_aubaines.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n✅ maxi_aubaines.json sauvegardé !`);
  console.log(`   ${items.length} soldes pour la semaine du ${semaine}`);

  // Aperçu des premiers items
  console.log('\n📋 Aperçu (5 premiers) :');
  items.slice(0, 5).forEach(item => {
    console.log(`   • ${item.nom} — ${item.prix_texte}${item.rabais ? ` (${item.rabais})` : ''}`);
  });
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
