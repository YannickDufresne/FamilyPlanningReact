/**
 * fetch-aubaines.mjs
 * Sources des aubaines de la semaine :
 *   1. Maxi  → lit src/data/maxi_aubaines.json (généré par fetch-maxi-loblaws.mjs)
 *   2. Costco → lit src/data/costco_catalogue.json (généré mensuellement par fetch-costco-catalogue.mjs)
 *   3. Claude → analyse textuelle + sélection items Costco pertinents + fallback si données absentes
 *
 * Variables d'environnement :
 *   ANTHROPIC_API_KEY — requis pour l'analyse IA
 *
 * Usage : node scripts/fetch-aubaines.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
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

// ── Lire maxi_aubaines.json si disponible et de la bonne semaine ──────────────
function lireMaxiAubaines(semaine) {
  const path = join(DATA_DIR, 'maxi_aubaines.json');
  if (!existsSync(path)) {
    console.log('  ℹ️  maxi_aubaines.json absent — Claude génèrera des soldes Maxi');
    return [];
  }

  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    const items = data.items ?? [];

    // Vérifier que c'est bien la bonne semaine
    if (data.semaine && data.semaine !== semaine.debut) {
      console.warn(`  ⚠️  maxi_aubaines.json est de la semaine ${data.semaine} (attendu: ${semaine.debut}) — Claude génèrera des soldes frais`);
      return [];
    }

    if (items.length === 0) {
      console.log('  ℹ️  maxi_aubaines.json vide — Claude génèrera des soldes Maxi');
      return [];
    }

    console.log(`  ✅ maxi_aubaines.json: ${items.length} aubaines (storeId: ${data.storeId || 'N/A'})`);
    return items;
  } catch (e) {
    console.warn(`  ⚠️  Lecture maxi_aubaines.json échouée: ${e.message}`);
    return [];
  }
}

// ── Lire costco_catalogue.json si disponible ──────────────────────────────────
function lireCostcoCatalogue() {
  const path = join(DATA_DIR, 'costco_catalogue.json');
  if (!existsSync(path)) {
    console.log('  ℹ️  costco_catalogue.json absent — Claude génèrera des aubaines Costco');
    return [];
  }

  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    const produits = data.produits ?? [];

    if (produits.length === 0) {
      console.log('  ℹ️  costco_catalogue.json vide — Claude génèrera des aubaines Costco');
      return [];
    }

    // Vérifier l'âge du catalogue (avertissement si > 45 jours)
    if (data.genereeLe) {
      const age = (Date.now() - new Date(data.genereeLe).getTime()) / (1000 * 60 * 60 * 24);
      if (age > 45) {
        console.warn(`  ⚠️  costco_catalogue.json a ${Math.round(age)} jours — pensez à le régénérer avec fetch-costco-catalogue.mjs`);
      }
    }

    console.log(`  ✅ costco_catalogue.json: ${produits.length} produits`);
    return produits;
  } catch (e) {
    console.warn(`  ⚠️  Lecture costco_catalogue.json échouée: ${e.message}`);
    return [];
  }
}

// ── Détection de catégorie par mots-clés ─────────────────────────────────────
function detecterCategorie(nom) {
  const n = (nom || '').toLowerCase();
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
// Rôle :
//   - Si données Maxi réelles disponibles : analyse textuelle + sélection Costco pertinents
//   - Si données absentes : génère des soldes Maxi/Costco réalistes + analyse
async function analyserAvecClaude(semaine, maxiItems, costcoProduits) {
  const aMaxiReels = maxiItems.length > 0;
  const aCostcoReels = costcoProduits.length > 0;

  console.log(`\n🤖 Analyse Claude — Maxi ${aMaxiReels ? 'réel' : 'généré'} / Costco ${aCostcoReels ? 'catalogue réel' : 'généré'}…`);

  const maxiStr = aMaxiReels
    ? maxiItems.slice(0, 40).map(a => `- ${a.nom}${a.prix_texte ? ` : ${a.prix_texte}` : ''}${a.rabais ? ` (${a.rabais})` : ''}`).join('\n')
    : '(circulaire non disponible — génère des soldes typiques réalistes pour Maxi Québec cette saison, 8 à 12 produits)';

  const costcoStr = aCostcoReels
    ? `Catalogue complet disponible (${costcoProduits.length} produits). Voici un échantillon représentatif :\n` +
      costcoProduits
        .sort(() => Math.random() - 0.5)
        .slice(0, 30)
        .map(p => `- ${p.nom} : ${p.prix_texte}`)
        .join('\n') +
      `\n\nSélectionne 5 à 8 produits Costco les plus pertinents pour une famille québécoise cette semaine.`
    : '(catalogue non disponible — génère des aubaines réalistes Costco Canada cette saison, 5 à 8 produits)';

  const prompt = `Tu es l'assistant d'une famille québécoise (Québec ville).
Magasins : Maxi René-Lévesque, Costco Québec, Lufa (bio local).
Semaine : ${semaine.debutLisible} au ${semaine.finLisible}

**Circulaire MAXI ${aMaxiReels ? '(données réelles API Loblaws)' : '(à générer)'}:**
${maxiStr}

**Aubaines COSTCO ${aCostcoReels ? '(catalogue réel — sélectionne les plus pertinents)' : '(à générer)'}:**
${costcoStr}

**Ta mission :** Retourne UNIQUEMENT du JSON valide, sans texte autour, sans commentaires, sans virgules en trop.

${aMaxiReels
    ? `Les données Maxi sont réelles. Utilise-les telles quelles dans "maxi_aubaines" (en conservant nom, prix_texte, prix_regulier_texte, rabais, mots_cles, categorie).
Ajoute "prix" (nombre) et "prix_regulier" (nombre ou null) si tu peux les déduire du texte.`
    : `Génère des soldes Maxi réalistes pour cette saison au Québec.`}

{
  "maxi_aubaines": [
    {
      "nom": "Poulet entier frais",
      "prix": 7.99,
      "prix_texte": "7.99$/kg",
      "prix_regulier": 11.99,
      "prix_regulier_texte": "11.99$/kg",
      "rabais": "33% de rabais",
      "mots_cles": ["poulet"],
      "categorie": "viande"
    }
  ],
  "costco_aubaines": [
    {
      "nom": "Saumon atlantique côté",
      "prix": 14.99,
      "prix_texte": "14.99$/kg",
      "prix_regulier": null,
      "prix_regulier_texte": "",
      "rabais": "",
      "mots_cles": ["saumon"],
      "categorie": "poisson"
    }
  ],
  "analyse": "2-3 phrases sur les meilleures aubaines de la semaine pour cette famille, avec produits et économies précis.",
  "economies_estimees": "~18$"
}`;

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

  console.log('📦 Lecture des données locales…');
  const maxiItems = lireMaxiAubaines(semaine);
  const costcoProduits = lireCostcoCatalogue();

  let analyse;
  if (process.env.ANTHROPIC_API_KEY) {
    analyse = await analyserAvecClaude(semaine, maxiItems, costcoProduits);
  } else {
    console.warn('\n⚠️  ANTHROPIC_API_KEY manquante — analyse IA désactivée');

    // Sans Claude : utiliser les données disponibles directement
    const costcoSlice = costcoProduits.length > 0
      ? costcoProduits.sort(() => Math.random() - 0.5).slice(0, 8).map(p => ({
          nom: p.nom,
          prix: p.prix,
          prix_texte: p.prix_texte,
          prix_regulier: null,
          prix_regulier_texte: '',
          rabais: '',
          mots_cles: p.mots_cles || [],
          categorie: p.categorie || detecterCategorie(p.nom),
        }))
      : [];

    analyse = {
      maxi_aubaines: maxiItems.slice(0, 20),
      costco_aubaines: costcoSlice,
      analyse: 'Analyse IA non disponible (clé ANTHROPIC_API_KEY manquante).',
      economies_estimees: '',
    };
  }

  // aubaines.json : soldes Maxi/Costco + analyse textuelle.
  // La liste Lufa et la répartition par magasin sont calculées dynamiquement
  // côté client dans GroceryList.jsx — toujours synchronisées avec le planning réel.
  const result = {
    semaine: semaine.debut,
    genereeLe: new Date().toISOString(),
    maxi: analyse.maxi_aubaines || maxiItems.slice(0, 20),
    costco: analyse.costco_aubaines || costcoProduits.slice(0, 8).map(p => ({
      nom: p.nom,
      prix: p.prix,
      prix_texte: p.prix_texte,
      prix_regulier: null,
      prix_regulier_texte: '',
      rabais: '',
      mots_cles: p.mots_cles || [],
      categorie: p.categorie || detecterCategorie(p.nom),
    })),
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
