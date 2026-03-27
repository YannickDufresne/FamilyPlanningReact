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

// ── Fetch circulaire Maxi via Flipp ───────────────────────────────────────────
async function fetchMaxi() {
  console.log('📦 Récupération circulaire Maxi (Flipp)…');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
  };

  try {
    // Maxi René-Lévesque, Québec ~ 46.8139° N, 71.2080° W
    const storeRes = await fetch(
      'https://flipp.com/api/stores/search?latitude=46.8139&longitude=-71.2080&locale=fr_CA&radius=3&tags[]=maxi',
      { headers }
    );
    if (!storeRes.ok) throw new Error(`Store search HTTP ${storeRes.status}`);
    const stores = await storeRes.json();
    const maxiStore = (stores || []).find(s =>
      s.merchant_name_identifier === 'maxi' || s.name?.toLowerCase().includes('maxi')
    );
    if (!maxiStore) throw new Error('Maxi introuvable dans les résultats Flipp');
    console.log(`  → Maxi trouvé: "${maxiStore.name}" (id ${maxiStore.id})`);

    const flyerRes = await fetch(
      `https://flipp.com/api/stores/${maxiStore.id}/flyers?locale=fr_CA`,
      { headers }
    );
    if (!flyerRes.ok) throw new Error(`Flyers HTTP ${flyerRes.status}`);
    const flyers = await flyerRes.json();
    const flyer = flyers?.[0];
    if (!flyer) throw new Error('Aucun flyer disponible');

    const itemsRes = await fetch(
      `https://flipp.com/api/flyer_items?flyer_id=${flyer.id}&locale=fr_CA`,
      { headers }
    );
    if (!itemsRes.ok) throw new Error(`Items HTTP ${itemsRes.status}`);
    const items = await itemsRes.json();

    const results = (items || [])
      .filter(item => item.name)
      .map(item => ({
        nom: item.name,
        mots_cles: item.name.toLowerCase().split(/\s+/).filter(w => w.length >= 3).slice(0, 3),
        prix: item.current_price,
        prix_regulier: item.original_price || null,
        prix_texte: item.display_price || (item.current_price ? `${item.current_price}$` : ''),
        unite: item.size || '',
        categorie: detecterCategorie(item.name),
        rabais: item.sale_story || '',
      }))
      .filter(item => item.prix || item.prix_texte);

    console.log(`  ✅ Maxi: ${results.length} produits en solde`);
    return results;
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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-CA,fr;q=0.9',
  };

  try {
    const res = await fetch('https://www.costco.ca/savings-event.html', { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Essai 1: JSON-LD
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    const products = [];
    for (const match of jsonLdMatches) {
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

    // Essai 2: regex sur les prix affichés
    if (products.length === 0) {
      const nameRe = /product-title[^>]*>([^<]{5,60})</g;
      const priceRe = /\$\s*([0-9]{1,4}\.[0-9]{2})/g;
      const names = [...html.matchAll(nameRe)].map(m => m[1].trim());
      const prices = [...html.matchAll(priceRe)].map(m => parseFloat(m[1]));
      names.slice(0, 25).forEach((nom, i) => {
        products.push({
          nom,
          mots_cles: nom.toLowerCase().split(/\s+/).filter(w => w.length >= 3).slice(0, 3),
          prix: prices[i] || null,
          prix_texte: prices[i] ? `${prices[i].toFixed(2)}$` : '',
          categorie: detecterCategorie(nom),
          rabais: '',
        });
      });
    }

    console.log(`  ✅ Costco: ${products.length} produits`);
    return products.slice(0, 30);
  } catch (e) {
    console.warn(`  ⚠️ Costco échoué: ${e.message}`);
    return [];
  }
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

// ── Analyse Claude ─────────────────────────────────────────────────────────────
async function analyserAvecClaude(semaine, maxiRaw, costcoRaw) {
  console.log('🤖 Analyse Claude — matching recettes + organisation par magasin…');

  const recettes = JSON.parse(readFileSync(join(DATA_DIR, 'recettes.json'), 'utf-8'));

  // Échantillon représentatif de recettes (tous les thèmes)
  const themes = ['pasta_rapido', 'bol_nwich', 'criiions_poisson', 'plat_en_sauce', 'confort_grille', 'pizza', 'slow_chic'];
  const sample = themes.flatMap(t =>
    recettes.filter(r => r[`theme_${t}`] === 1).slice(0, 4)
  ).map(r => `${r.nom} (${r.ingredients})`);

  const maxiStr = maxiRaw.length > 0
    ? maxiRaw.slice(0, 40).map(a => `- ${a.nom}${a.prix_texte ? ` : ${a.prix_texte}` : ''}${a.rabais ? ` (${a.rabais})` : ''}`).join('\n')
    : '(circulaire non disponible cette semaine — génère des soldes typiques réalistes pour Maxi Québec cette saison)';

  const costcoStr = costcoRaw.length > 0
    ? costcoRaw.slice(0, 20).map(a => `- ${a.nom}${a.prix_texte ? ` : ${a.prix_texte}` : ''}`).join('\n')
    : '(données non disponibles — génère des aubaines réalistes Costco Canada cette saison)';

  const prompt = `Tu es l'assistant d'une famille québécoise (Québec ville). Tu gères leur planification familiale hebdomadaire.

Membres : Patricia (💚, 32 ans, cuisine, culture), Yannick (🦉, 45 ans, gastronomie, histoire), Joseph (🐤, 13 ans, ado actif), Mika & Luce (🍒, jumeaux 1 an).

Magasins habituels :
- **Maxi** sur René-Lévesque, Québec — épicerie principale
- **Costco** Québec — achats en gros (membres)
- **Lufa** (abonnement paniers biologiques) — commande en ligne hebdomadaire OBLIGATOIRE avec montant minimum (~50-60$). Patricia passe la commande — liste claire et précise très importante.
- **Autres** — épiceries spécialisées ou en ligne pour produits rares

Semaine planifiée : ${semaine.debutLisible} au ${semaine.finLisible}

**Circulaire MAXI cette semaine :**
${maxiStr}

**Aubaines COSTCO :**
${costcoStr}

**Exemples de recettes que la famille cuisine (avec leurs ingrédients) :**
${sample.join('\n')}

**Ta mission :** Générer un JSON complet pour organiser les achats de la semaine. Retourne UNIQUEMENT un JSON valide (pas de texte autour) avec cette structure exacte :

{
  "maxi_aubaines": [
    {
      "nom": "nom exact du produit en solde",
      "prix_texte": "X.XX$",
      "prix_regulier_texte": "X.XX$ reg." (ou null),
      "rabais": "description du rabais ex: 38% de rabais",
      "mots_cles": ["mot-clé court", "autre-mot"],
      "categorie": "viande|poisson|legumes|fruits|produits_laitiers|epicerie_seche|condiments|epicerie"
    }
  ],
  "costco_aubaines": [
    {
      "nom": "produit Costco",
      "prix_texte": "X.XX$",
      "rabais": "",
      "mots_cles": ["mot-clé"],
      "categorie": "..."
    }
  ],
  "lufa_commande": [
    {
      "nom": "Nom exact d'un produit Lufa (légumes biologiques QC, lait, oeufs, fromages locaux, pain artisanal...)",
      "prix_estime": "X.XX$",
      "unite": "ex: 500g / 1kg / 1 unité",
      "raison": "courte explication: pour quelle recette",
      "mots_cles": ["mot-clé"],
      "categorie": "legumes|fruits|produits_laitiers|boulangerie|autre"
    }
  ],
  "lufa_total_estime": "XX.XX$",
  "lufa_min_atteint": true,
  "par_magasin": {
    "maxi": ["ingrédient 1", "ingrédient 2", "..."],
    "costco": ["ingrédient en gros 1", "parmesan", "..."],
    "lufa": ["légume bio 1", "..."],
    "autres": ["ingrédient spécial ou introuvable ailleurs"]
  },
  "analyse": "2-3 phrases dynamiques en français sur les meilleures aubaines et économies de la semaine. Mentionne des produits spécifiques.",
  "economies_estimees": "~XX$"
}

Pour la liste Lufa : sois précis et réaliste. Lufa vend des paniers de légumes du Québec + épicerie fine locale. Minimum ~50-60$ de commande requis pour Patricia.
Génère entre 8 et 15 items Lufa couvrant les besoins de la semaine en légumes/fruits/laitiers.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pas de JSON dans la réponse Claude');
  return JSON.parse(jsonMatch[0]);
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
      lufa_commande: [],
      lufa_total_estime: '0$',
      lufa_min_atteint: false,
      par_magasin: { maxi: [], costco: [], lufa: [], autres: [] },
      analyse: 'Analyse IA non disponible (clé ANTHROPIC_API_KEY manquante).',
      economies_estimees: '',
    };
  }

  const result = {
    semaine: semaine.debut,
    genereeLe: new Date().toISOString(),
    maxi: analyse.maxi_aubaines || maxiRaw.slice(0, 20),
    costco: analyse.costco_aubaines || costcoRaw.slice(0, 10),
    lufa: analyse.lufa_commande || [],
    lufa_total_estime: analyse.lufa_total_estime || '',
    lufa_min_atteint: analyse.lufa_min_atteint ?? false,
    par_magasin: analyse.par_magasin || { maxi: [], costco: [], lufa: [], autres: [] },
    analyse: analyse.analyse || '',
    economies_estimees: analyse.economies_estimees || '',
  };

  const outPath = join(DATA_DIR, 'aubaines.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n✅ aubaines.json sauvegardé !`);
  console.log(`   Maxi    : ${result.maxi.length} aubaines`);
  console.log(`   Costco  : ${result.costco.length} aubaines`);
  console.log(`   Lufa    : ${result.lufa.length} items (${result.lufa_total_estime})`);
  if (result.analyse) console.log(`\n💬 ${result.analyse}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
