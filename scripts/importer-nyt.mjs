/**
 * importer-nyt.mjs
 * Classifie les recettes NYT Cooking sauvegardées et les ajoute à recettes.json
 * Usage : node scripts/importer-nyt.mjs
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

// Recettes à exclure (non-plats principaux évidents)
const MOTS_EXCLURE = [
  'cookie', 'cake', 'pie', 'brownie', 'muffin', 'cupcake', 'tart', 'biscuit',
  'shortbread', 'scone', 'bread pudding', 'pudding', 'cheesecake', 'tiramisu',
  'ice cream', 'sorbet', 'granita', 'panna cotta', 'crème brûlée', 'flan',
  'cocktail', 'lemonade', 'smoothie', 'juice', 'punch', 'smash', 'sangria',
  'vinaigrette', 'dressing', 'marinade', 'bbq sauce', 'hot sauce', 'compound butter',
  'garlic bread', 'croutons', 'whipped cream', 'mayonnaise', 'aioli',
  'apple pie', 'chocolate cake', 'banana bread', 'carrot cake',
];

function estExclu(nom) {
  const lower = nom.toLowerCase();
  return MOTS_EXCLURE.some(mot => lower.includes(mot));
}

async function classifier() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!apiKey) { console.error('❌ Aucune clé API trouvée'); process.exit(1); }

  const client = new Anthropic({ apiKey });

  // Charger les recettes NYT (depuis /tmp ou argument)
  const nytPath = process.argv[2] || '/tmp/nyt_recipes.json';
  const nytRecettes = JSON.parse(readFileSync(nytPath, 'utf-8'));
  console.log(`\n→ ${nytRecettes.length} recettes NYT chargées`);

  // Charger les recettes existantes pour éviter les doublons
  const recettesPath = join(DATA_DIR, 'recettes.json');
  const existantes = JSON.parse(readFileSync(recettesPath, 'utf-8'));
  const nomsExistants = new Set(existantes.map(r => r.nom.toLowerCase().trim()));
  const urlsExistantes = new Set(existantes.filter(r => r.url).map(r => r.url));

  // Filtrer: exclure doublons et non-plats évidents
  const aClasser = nytRecettes.filter(r => {
    if (nomsExistants.has(r.nom.toLowerCase().trim())) return false;
    if (r.url && urlsExistantes.has(r.url)) return false;
    if (estExclu(r.nom)) return false;
    return true;
  });

  console.log(`→ ${nytRecettes.length - aClasser.length} recettes filtrées (doublons + non-plats évidents)`);
  console.log(`→ ${aClasser.length} recettes à classifier\n`);

  const BATCH = 15;
  const nouvelles = [];

  for (let i = 0; i < aClasser.length; i += BATCH) {
    const batch = aClasser.slice(i, i + BATCH);
    const n = Math.min(i + BATCH, aClasser.length);
    console.log(`  Batch ${i + 1}–${n} / ${aClasser.length}...`);

    const liste = batch.map((r, j) => `${j + 1}. "${r.nom}" — ${r.url}`).join('\n');

    const prompt = `Tu es un assistant culinaire expert. Voici ${batch.length} recettes de NYT Cooking.

Pour chaque recette, détermine :
1. Si c'est un **plat principal** adapté à un repas du soir en famille (inclure: plats principaux, soupes-repas, salades-repas, currys, ramen, stews, pasta, etc. — EXCLURE: desserts, condiments, boissons, pains simples, accompagnements purs)
2. Si c'est un plat principal, classe-le selon :
   - **themes** : quels thèmes de soirée correspondent (mettre 1 si oui, 0 si non) :
     - pasta_rapido: pâtes, nouilles, gnocchi (rapide, <30 min idéalement)
     - bol_nwich: bols, sandwichs, wraps, tacos, burgers, bowls, mezze
     - criiions_poisson: poisson, fruits de mer, crevettes, calmars
     - plat_en_sauce: plats mijotés, ragoûts, currys, sauces riches, braises
     - confort_grille: grillades, poulet rôti, viandes grillées, comfort food
     - pizza: pizzas, flatbreads garnis, focaccia repas
     - slow_chic: plats élaborés/gastronomiques, rôtis, plats de fête
   - **cout**: estimation coût ingrédients CAD (2=<5$, 4=5-10$, 6=10-15$, 8=15-20$, 10=>20$)
   - **temps_preparation**: minutes totales (préparation + cuisson)
   - **ingredients**: 4-6 ingrédients principaux, séparés par virgules (en français)
   - **origine**: pays/région d'origine culinaire (ex: Italie, Japon, Mexique, France, Moyen-Orient, Inde, États-Unis, Corée, Méditerranéen, Liban, Maroc, Thaïlande, etc.)
   - **regime_alimentaire**: "végane" / "végétarien" / "omnivore"

RECETTES:
${liste}

Réponds UNIQUEMENT avec un tableau JSON de ${batch.length} objets dans le même ordre :
[{
  "inclure": true,
  "nom": "nom original EN anglais",
  "theme_pasta_rapido": 0,
  "theme_bol_nwich": 0,
  "theme_criiions_poisson": 0,
  "theme_plat_en_sauce": 0,
  "theme_confort_grille": 0,
  "theme_pizza": 0,
  "theme_slow_chic": 0,
  "cout": 6,
  "temps_preparation": 30,
  "ingredients": "poulet, tomates, oignons, ail, épices",
  "origine": "Mexique",
  "regime_alimentaire": "omnivore"
}]

Si "inclure" est false (non-plat principal), mets juste {"inclure": false, "nom": "..."} pour cet item.`;

    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const texte = message.content[0].text.trim();
      const match = texte.match(/\[[\s\S]*\]/);
      if (!match) { console.warn('  Réponse JSON invalide pour ce batch'); continue; }

      const batchResult = JSON.parse(match[0]);
      let inclus = 0;
      batchResult.forEach((r, j) => {
        if (!r.inclure) return;
        const original = batch[j];
        nouvelles.push({
          nom: r.nom || original.nom,
          theme_pasta_rapido:    r.theme_pasta_rapido    ?? 0,
          theme_bol_nwich:       r.theme_bol_nwich       ?? 0,
          theme_criiions_poisson:r.theme_criiions_poisson?? 0,
          theme_plat_en_sauce:   r.theme_plat_en_sauce   ?? 0,
          theme_confort_grille:  r.theme_confort_grille  ?? 0,
          theme_pizza:           r.theme_pizza           ?? 0,
          theme_slow_chic:       r.theme_slow_chic       ?? 0,
          cout:                  r.cout                  ?? 6,
          temps_preparation:     r.temps_preparation     ?? 30,
          ingredients:           r.ingredients           ?? '',
          origine:               r.origine               ?? 'États-Unis',
          regime_alimentaire:    r.regime_alimentaire    ?? 'omnivore',
          url: original.url || null,
          source: 'nyt_cooking',
        });
        inclus++;
      });
      console.log(`    → ${inclus}/${batch.length} recettes incluses`);

      // Pause pour éviter rate limiting
      if (i + BATCH < aClasser.length) await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.warn(`  ⚠️  Batch ${i}–${n}: ${err.message}`);
    }
  }

  console.log(`\n✅ ${nouvelles.length} nouvelles recettes à ajouter`);

  // Fusionner avec existantes
  const toutesLesRecettes = [...existantes, ...nouvelles];
  writeFileSync(recettesPath, JSON.stringify(toutesLesRecettes, null, 2) + '\n');
  console.log(`💾 recettes.json mis à jour (${existantes.length} → ${toutesLesRecettes.length} recettes)`);

  // Aperçu par thème
  const themes = ['pasta_rapido', 'bol_nwich', 'criiions_poisson', 'plat_en_sauce', 'confort_grille', 'pizza', 'slow_chic'];
  console.log('\nNouveaux plats par thème:');
  for (const t of themes) {
    const count = nouvelles.filter(r => r[`theme_${t}`] === 1).length;
    console.log(`  ${t}: ${count}`);
  }
}

classifier().catch(err => { console.error('❌', err.message); process.exit(1); });
