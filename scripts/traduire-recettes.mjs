/**
 * traduire-recettes.mjs
 * Traduit les noms anglais en français et corrige les origines suspectes.
 * Usage : ANTHROPIC_API_KEY=sk-ant-... node scripts/traduire-recettes.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const RECETTES_PATH = join(__dir, '../src/data/recettes.json');
const API_KEY = process.env.ANTHROPIC_API_KEY;
const BATCH = 40; // recettes par appel API

if (!API_KEY) { console.error('ANTHROPIC_API_KEY manquant'); process.exit(1); }

// ── Helpers ──────────────────────────────────────────────────────────────────
function estNomAnglais(nom) {
  // Heuristique : contient des mots anglais typiques ou pas d'accents français
  if (!nom) return false;
  const motsAnglais = /\b(with|and|or|the|a|an|in|of|for|from|over|on|to|slow|quick|easy|spicy|crispy|creamy|smoky|roasted|grilled|baked|pan|sheet|one|pot|skillet|stuffed|glazed|braised|seared|weeknight|garlic|butter|lemon|chicken|beef|pork|shrimp|salmon|pasta|rice|soup|salad|sauce|cake|tart|pie|cookies|bread)\b/i;
  return motsAnglais.test(nom);
}

async function appelClaude(prompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

function extraireJson(texte) {
  const m = texte.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('Pas de tableau JSON dans la réponse:\n' + texte.slice(0, 200));
  return JSON.parse(m[0]);
}

// ── Prompt traduction + correction origine ────────────────────────────────────
function promptTraduction(recettes) {
  const liste = recettes.map((r, i) => ({
    i,
    nom: r.nom,
    origine_actuelle: r.origine,
    ingredients: r.ingredients,
  }));

  return `Tu reçois une liste de recettes. Pour chacune, retourne un objet JSON avec :
- "i" : l'index (conserve-le tel quel)
- "nom_fr" : traduction naturelle en français, minuscules sauf noms propres culinaires
  Ex: "Spaghetti With Fresh Tomato" → "spaghetti aux tomates fraîches"
  Ex: "Chicken Tikka Masala" → "poulet tikka masala"
  Ex: "Slow Cooker Hoisin Garlic Chicken" → "poulet hoisin et ail à la mijoteuse"
  Ex: "Sheet Pan Salmon" → "saumon à la plaque"
  Ex: "Easy Weeknight Pasta" → "pâtes faciles en semaine"
- "origine_corrigee" : corrige l'origine si elle est visiblement fausse selon les ingrédients.
  Règle : l'origine = tradition culinaire des INGRÉDIENTS, pas l'appareil de cuisson.
  • sauce hoisin / huîtres / cinq-épices / bok choy → "Chine"
  • gochujang / kimchi → "Corée" ; miso / dashi / mirin → "Japon"
  • fish sauce + citronnelle + coco → "Thaïlande" ou "Vietnam"
  • tahini / za'atar / sumac → "Liban" ou "Moyen-Orient"
  • harissa / ras-el-hanout → "Maroc"
  • garam masala / curcuma / ghee → "Inde"
  • "États-Unis" uniquement pour: hamburger, ribs, mac and cheese, Cajun, buffalo
  • Si l'origine actuelle est correcte, retourne null
  Si tu n'es pas sûr, retourne null (ne pas changer).

Retourne UNIQUEMENT un tableau JSON sans markdown.

Recettes :
${JSON.stringify(liste, null, 2)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const recettes = JSON.parse(readFileSync(RECETTES_PATH, 'utf8'));

  // Filtrer celles qui ont un nom anglais
  const aTraduire = recettes
    .map((r, globalIdx) => ({ ...r, globalIdx }))
    .filter(r => estNomAnglais(r.nom));

  console.log(`📋 ${recettes.length} recettes au total`);
  console.log(`🔤 ${aTraduire.length} noms à traduire`);

  if (aTraduire.length === 0) {
    console.log('✅ Rien à faire.');
    return;
  }

  let traduits = 0;
  let corriges = 0;

  for (let debut = 0; debut < aTraduire.length; debut += BATCH) {
    const lot = aTraduire.slice(debut, debut + BATCH);
    const numLot = Math.floor(debut / BATCH) + 1;
    const totalLots = Math.ceil(aTraduire.length / BATCH);
    process.stdout.write(`\n🤖 Lot ${numLot}/${totalLots} (${lot.length} recettes)… `);

    try {
      const prompt = promptTraduction(lot);
      const texte = await appelClaude(prompt);
      const resultats = extraireJson(texte);

      for (const res of resultats) {
        const recetteLocal = lot[res.i];
        if (!recetteLocal) continue;
        const idx = recetteLocal.globalIdx;

        // Conserver le nom anglais original
        if (!recettes[idx].nom_original) {
          recettes[idx].nom_original = recettes[idx].nom;
        }

        // Appliquer la traduction
        if (res.nom_fr && res.nom_fr !== recettes[idx].nom) {
          recettes[idx].nom = res.nom_fr;
          traduits++;
        }

        // Corriger l'origine si indiquée
        if (res.origine_corrigee && res.origine_corrigee !== recettes[idx].origine) {
          console.log(`  🌍 Origine corrigée: "${recettes[idx].nom_original || recettes[idx].nom}" : ${recettes[idx].origine} → ${res.origine_corrigee}`);
          recettes[idx].origine = res.origine_corrigee;
          corriges++;
        }
      }

      process.stdout.write(`✓ (${traduits} traduits, ${corriges} origines corrigées)`);

      // Pause entre les lots pour éviter les rate limits
      if (debut + BATCH < aTraduire.length) {
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (e) {
      console.error(`\n❌ Lot ${numLot} échoué: ${e.message}`);
      // Continuer quand même
    }
  }

  // Sauvegarder
  writeFileSync(RECETTES_PATH, JSON.stringify(recettes, null, 2), 'utf8');
  console.log(`\n\n✅ Terminé : ${traduits} noms traduits, ${corriges} origines corrigées`);
  console.log(`💾 recettes.json mis à jour`);
}

main().catch(e => { console.error(e); process.exit(1); });
