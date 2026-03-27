/**
 * fetch-aubaines.mjs
 * Sources des aubaines de la semaine :
 *   1. Maxi (René-Lévesque, Québec) → via Flipp API
 *   2. Costco (Québec) → via site web
 *   3. Analyse Claude → matching ingrédients, liste par magasin, recommandations Lufa
 *
 * Variables d'environnement :
 *   ANTHROPIC_API_KEY — requis pour l'analyse IA
 *
 * Usage : node scripts/fetch-aubaines.mjs
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

// ── Dates de la semaine (prochain lundi) ──────────────────────────────────────
function getSemaine() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 1 ? 0 : (8 - day) % 7;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diff);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  const fmt = d => d.toISOString().split('T')[0];
  const fmtLisible = d => d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  return { debut: fmt(lundi), fin: fmt(dimanche), debutLisible: fmtLisible(lundi), finLisible: fmtLisible(dimanche) };
}

// ── Fetch circulaire Maxi via Flipp (scraping page web) ──────────────────────
async function fetchMaxi() {
  console.log('📦 Récupération circulaire Maxi (Flipp)…');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  };

  // Essai 1 : page Flipp Maxi → __NEXT_DATA__ JSON embarqué
  try {
    const res = await fetch('https://flipp.com/fr-ca/flyers/maxi?postal_code=G1R3Z9', { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const data = JSON.parse(nextDataMatch[1]);
      // Naviguer dans la structure Next.js pour trouver les items
      const flyerItems = [];
      const findItems = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(findItems); return; }
        if (obj.name && (obj.current_price || obj.display_price || obj.sale_story)) {
          flyerItems.push(obj);
        }
        Object.values(obj).forEach(findItems);
      };
      findItems(data);

      if (flyerItems.length > 0) {
        const results = flyerItems.map(item => ({
          nom: item.name,
          mots_cles: item.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3).slice(0, 3),
          prix: item.current_price,
          prix_texte: item.display_price || (item.current_price ? `${item.current_price}$` : ''),
          unite: item.size || '',
          categorie: detecterCategorie(item.name),
          rabais: item.sale_story || '',
        })).filter(item => item.prix || item.prix_texte);

        console.log(`  ✅ Maxi (__NEXT_DATA__): ${results.length} produits`);
        return results;
      }
    }

    // Essai 2 : chercher du JSON embarqué dans des balises <script> génériques
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]{100,50000}?)<\/script>/g);
    for (const m of scriptMatches) {
      const src = m[1];
      if (!src.includes('"current_price"') && !src.includes('"sale_story"')) continue;
      try {
        // Extraire les objets item du script
        const itemMatches = src.matchAll(/\{"name":"([^"]+)"[^}]*"current_price":([0-9.]+)[^}]*\}/g);
        const results = [];
        for (const im of itemMatches) {
          results.push({
            nom: im[1],
            mots_cles: im[1].toLowerCase().split(/\s+/).filter(w => w.length >= 3).slice(0, 3),
            prix: parseFloat(im[2]),
            prix_texte: `${im[2]}$`,
            categorie: detecterCategorie(im[1]),
            rabais: '',
          });
        }
        if (results.length > 0) {
          console.log(`  ✅ Maxi (script inline): ${results.length} produits`);
          return results;
        }
      } catch {}
    }

    console.warn('  ⚠️ Maxi: page Flipp récupérée mais aucun item extrait — Claude génèrera des suggestions');
    return [];
  } catch (e) {
    console.warn(`  ⚠️ Flipp Maxi échoué: ${e.message}`);
    return [];
  }
}

// ── Fetch aubaines Costco ─────────────────────────────────────────────────────
async function fetchCostco() {
  console.log('📦 Récupération aubaines Costco…');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
  };

  // Essayer plusieurs URLs Costco
  const urls = [
    'https://www.costco.ca/hot-buys.html',
    'https://www.costco.ca/instant-savings.html',
    'https://www.costco.ca/savings-event.html',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) { console.warn(`  ⚠️ Costco ${url}: HTTP ${res.status}`); continue; }
      const html = await res.text();

      const products = [];

      // Essai 1: JSON-LD
      for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try {
          const data = JSON.parse(match[1]);
          const items = Array.isArray(data) ? data : [data];
          items.filter(d => d['@type'] === 'Product' && d.name).forEach(p => {
            products.push({
              nom: p.name,
              mots_cles: p.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3).slice(0, 3),
              prix: p.offers?.price ? parseFloat(p.offers.price) : null,
              prix_texte: p.offers?.price ? `${parseFloat(p.offers.price).toFixed(2)}$` : '',
              categorie: detecterCategorie(p.name),
              rabais: '',
            });
          });
        } catch {}
      }

      // Essai 2: regex produits + prix
      if (products.length === 0) {
        const pairRe = /(?:product[-_](?:title|name|description))[^>]*>([^<]{5,80})<[\s\S]{0,200}?\$\s*([0-9]{1,4}\.[0-9]{2})/g;
        for (const m of html.matchAll(pairRe)) {
          const nom = m[1].trim().replace(/&amp;/g, '&');
          products.push({
            nom,
            mots_cles: nom.toLowerCase().split(/\s+/).filter(w => w.length >= 3).slice(0, 3),
            prix: parseFloat(m[2]),
            prix_texte: `${m[2]}$`,
            categorie: detecterCategorie(nom),
            rabais: '',
          });
        }
      }

      if (products.length > 0) {
        console.log(`  ✅ Costco (${url}): ${products.length} produits`);
        return products.slice(0, 30);
      }
    } catch (e) {
      console.warn(`  ⚠️ Costco ${url}: ${e.message}`);
    }
  }

  console.warn('  ⚠️ Costco: aucune donnée récupérée — Claude génèrera des suggestions');
  return [];
}

// ── Détection de catégorie par mots-clés ─────────────────────────────────────
function detecterCategorie(nom) {
  const n = nom.toLowerCase();
  if (/poulet|boeuf|porc|veau|agneau|dinde|viande|côte|steak|bacon|saucisse/.test(n)) return 'viande';
  if (/saumon|thon|crevette|poisson|morue|tilapia|truite|fruits de mer/.test(n)) return 'poisson';
  if (/laitue|épinard|carotte|brocoli|tomate|oignon|ail|courgette|patate|légume|céleri|poivron|chou|champignon/.test(n)) return 'legumes';
  if (/pomme|fraise|banane|orange|citron|mangue|raisin|poire|fruit|bleuet/.test(n)) return 'fruits';
  if (/lait|fromage|beurre|yogourt|crème|œuf|oeuf/.test(n)) return 'produits_laitiers';
  if (/pâte|riz|farine|pain|céréale|avoine|granola/.test(n)) return 'epicerie_seche';
  if (/huile|vinaigre|sauce|moutarde|épice|herbe/.test(n)) return 'condiments';
  return 'epicerie';
}

// ── Parsing JSON robuste (gère virgules en trop, commentaires, etc.) ──────────
function parseJsonSafe(text) {
  // Retirer les blocs markdown ```json ... ```
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  // Extraire le bloc JSON principal
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Aucun bloc JSON trouvé dans la réponse');
  let json = match[0];

  // Supprimer les commentaires JS inline et de bloc
  json = json.replace(/\/\/[^\n\r"]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Supprimer les virgules traînantes avant } ou ]
  json = json.replace(/,(\s*[\}\]])/g, '$1');

  // Corriger les valeurs null en texte : (ou null) → null
  json = json.replace(/"[^"]*"\s*\(ou null\)/g, 'null');

  try {
    return JSON.parse(json);
  } catch (e) {
    // Dernière tentative : extraire les propriétés clés une par une
    console.warn('  ⚠️ JSON malformé, tentative de récupération partielle…');
    const partial = {};
    const keyMatches = json.matchAll(/"(\w+)":\s*(\[[\s\S]*?\]|\{[\s\S]*?\}|"[^"]*"|true|false|null|-?\d+\.?\d*)/g);
    for (const m of keyMatches) {
      try { partial[m[1]] = JSON.parse(m[2]); } catch {}
    }
    if (Object.keys(partial).length === 0) throw e;
    return partial;
  }
}

// ── Analyse Claude ─────────────────────────────────────────────────────────────
// Rôle limité : générer les soldes Maxi/Costco + l'analyse textuelle.
// La liste Lufa et la répartition par magasin sont calculées côté client (toujours fraîches).
async function analyserAvecClaude(semaine, maxiRaw, costcoRaw) {
  console.log('🤖 Analyse Claude — soldes Maxi/Costco + analyse hebdomadaire…');

  const maxiStr = maxiRaw.length > 0
    ? maxiRaw.slice(0, 40).map(a => `- ${a.nom}${a.prix_texte ? ` : ${a.prix_texte}` : ''}${a.rabais ? ` (${a.rabais})` : ''}`).join('\n')
    : '(circulaire non disponible — génère des soldes typiques réalistes pour Maxi Québec cette saison)';

  const costcoStr = costcoRaw.length > 0
    ? costcoRaw.slice(0, 20).map(a => `- ${a.nom}${a.prix_texte ? ` : ${a.prix_texte}` : ''}`).join('\n')
    : '(données non disponibles — génère des aubaines réalistes Costco Canada cette saison)';

  const prompt = `Tu es l'assistant d'une famille québécoise (Québec ville).
Magasins : Maxi René-Lévesque, Costco Québec, Lufa (bio local).
Semaine : ${semaine.debutLisible} au ${semaine.finLisible}

**Circulaire MAXI :**
${maxiStr}

**Aubaines COSTCO :**
${costcoStr}

**Ta mission :** Retourne UNIQUEMENT du JSON valide, sans texte autour, sans commentaires, sans virgules en trop.

{
  "maxi_aubaines": [
    {
      "nom": "Poulet entier frais",
      "prix_texte": "7.99$/kg",
      "prix_regulier_texte": "11.99$/kg",
      "rabais": "33% de rabais",
      "mots_cles": ["poulet"],
      "categorie": "viande"
    }
  ],
  "costco_aubaines": [
    {
      "nom": "Saumon atlantique côté",
      "prix_texte": "14.99$/kg",
      "prix_regulier_texte": "",
      "rabais": "",
      "mots_cles": ["saumon"],
      "categorie": "poisson"
    }
  ],
  "analyse": "2-3 phrases sur les meilleures aubaines de la semaine pour cette famille, avec produits et économies précis.",
  "economies_estimees": "~18$"
}

Génère 8 à 12 aubaines Maxi et 5 à 8 aubaines Costco réalistes pour cette saison au Québec.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  return parseJsonSafe(text);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const semaine = getSemaine();
  console.log(`\n🛒 Fetch aubaines — semaine du ${semaine.debutLisible}\n`);

  const [maxiRaw, costcoRaw] = await Promise.all([fetchMaxi(), fetchCostco()]);

  let analyse;
  if (process.env.ANTHROPIC_API_KEY) {
    analyse = await analyserAvecClaude(semaine, maxiRaw, costcoRaw);
  } else {
    console.warn('⚠️  ANTHROPIC_API_KEY manquante — analyse IA désactivée');
    analyse = {
      maxi_aubaines: maxiRaw.slice(0, 20),
      costco_aubaines: costcoRaw.slice(0, 10),
      analyse: 'Analyse IA non disponible (clé ANTHROPIC_API_KEY manquante).',
      economies_estimees: '',
    };
  }

  // aubaines.json : seulement les soldes Maxi/Costco + analyse textuelle.
  // La liste Lufa et la répartition par magasin sont calculées dynamiquement
  // côté client dans GroceryList.jsx — toujours synchronisées avec le planning réel.
  const result = {
    semaine: semaine.debut,
    genereeLe: new Date().toISOString(),
    maxi: analyse.maxi_aubaines || maxiRaw.slice(0, 20),
    costco: analyse.costco_aubaines || costcoRaw.slice(0, 10),
    analyse: analyse.analyse || '',
    economies_estimees: analyse.economies_estimees || '',
  };

  const outPath = join(DATA_DIR, 'aubaines.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n✅ aubaines.json sauvegardé !`);
  console.log(`   Maxi   : ${result.maxi.length} aubaines`);
  console.log(`   Costco : ${result.costco.length} aubaines`);
  if (result.analyse) console.log(`\n💬 ${result.analyse}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
