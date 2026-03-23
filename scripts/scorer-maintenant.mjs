/**
 * scorer-maintenant.mjs
 * Score les activités existantes immédiatement, sans refaire le fetch.
 * Usage : node scripts/scorer-maintenant.mjs
 */
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');

const FAMILLE = JSON.parse(readFileSync(join(DATA_DIR, 'famille.json'), 'utf-8'));

function calculerAge(naissance) {
  const n = new Date(naissance + 'T12:00:00');
  const today = new Date();
  let age = today.getFullYear() - n.getFullYear();
  const dm = today.getMonth() - n.getMonth();
  if (dm < 0 || (dm === 0 && today.getDate() < n.getDate())) age--;
  return age;
}

async function scorer() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!apiKey) { console.error('❌ Aucune clé API trouvée'); process.exit(1); }

  const client = new Anthropic({ apiKey });

  const fichier = join(DATA_DIR, 'activites.json');
  const activites = JSON.parse(readFileSync(fichier, 'utf-8'));
  console.log(`\n→ ${activites.length} activités à scorer`);

  const profilsFamille = FAMILLE.map(m => {
    const age = calculerAge(m.naissance);
    const cat = age < 5 ? 'bébé' : age < 13 ? 'enfant' : age < 18 ? 'ado' : 'adulte';
    return `${m.prenom} ${m.emoji} (${age} ans, ${cat}): ${m.aime}`;
  }).join('\n');

  const BATCH = 20;
  const scored = activites.map(a => ({ ...a }));

  for (let i = 0; i < activites.length; i += BATCH) {
    const batch = activites.slice(i, i + BATCH);
    const n = Math.min(i + BATCH, activites.length);
    console.log(`  Batch ${i + 1}–${n} / ${activites.length}...`);

    const liste = batch.map((a, j) =>
      `${j + 1}. "${a.nom}" | ${a.lieu ?? ''} | audience: ${a.pourQui ?? 'famille'} | ${a.description ?? ''}`
    ).join('\n');

    const prompt = `Famille Dufresne, Québec — voici les profils :

${profilsFamille}

Évalue ces ${batch.length} activités selon leur pertinence pour cette famille.

RÈGLES IMPORTANTES :
- score_famille : pertinence pour sortie avec les 5 membres (Patricia, Yannick, Joseph 13 ans, Mika et Luce 1 an)
  · Score 0 si inadapté (speed dating, bar pour adultes, soirée célibataires, 18+, etc.)
  · Score élevé si activité famille : parcs, musées, festivals, plein air, culture accessible
- score_adultes : pertinence pour Patricia + Yannick seulement (sans enfants)
  · Peut inclure restaurants, spectacles, soirées culturelles, etc.
- explication_famille : max 90 car. format «Pour 💚 Patricia et 🐤 Joseph · arts, aventure» ou «Non adapté famille» si score < 20
- explication_adultes : max 90 car. format «Soirée idéale pour 🦉 Yannick · histoire»
- scores_membres : Patricia 0-100, Yannick 0-100, Joseph 0-100, Mika 0-100, Luce 0-100

ACTIVITÉS (numéro | nom | lieu | audience déclarée | description) :
${liste}

Réponds UNIQUEMENT avec un tableau JSON de ${batch.length} objets dans le même ordre :
[{"score_famille":85,"score_adultes":60,"explication_famille":"Pour 💚 Patricia · culture","explication_adultes":"Idéal pour 🦉 Yannick · histoire","scores_membres":{"Patricia":90,"Yannick":80,"Joseph":70,"Mika":50,"Luce":50}}]`;

    try {
      const message = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const texte = message.content[0].text.trim();
      const match = texte.match(/\[[\s\S]*\]/);
      if (!match) { console.warn('  Réponse JSON invalide pour ce batch'); continue; }

      const batchScores = JSON.parse(match[0]);
      batchScores.forEach((s, j) => {
        const idx = i + j;
        if (idx < scored.length) {
          Object.assign(scored[idx], {
            score_famille:        s.score_famille        ?? null,
            score_adultes:        s.score_adultes        ?? null,
            explication_famille:  s.explication_famille  ?? null,
            explication_adultes:  s.explication_adultes  ?? null,
            scores_membres:       s.scores_membres       ?? null,
          });
        }
      });

      // Petite pause pour éviter le rate limiting
      if (i + BATCH < activites.length) await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.warn(`  ⚠️  Batch ${i}–${n}: ${err.message}`);
    }
  }

  const ok = scored.filter(a => a.score_famille != null).length;
  console.log(`\n✅ ${ok}/${activites.length} activités scorées`);

  // Afficher un aperçu
  const top5 = [...scored]
    .filter(a => a.score_famille != null)
    .sort((a, b) => b.score_famille - a.score_famille)
    .slice(0, 5);
  console.log('\nTop 5 famille :');
  top5.forEach(a => console.log(`  ${a.score_famille}% — ${a.nom}`));

  const zero = scored.filter(a => (a.score_famille ?? 0) === 0).map(a => a.nom);
  if (zero.length) console.log('\nScore 0 famille :', zero.join(', '));

  writeFileSync(fichier, JSON.stringify(scored, null, 2) + '\n');
  console.log('\n💾 activites.json mis à jour');
}

scorer().catch(err => { console.error('❌', err.message); process.exit(1); });
