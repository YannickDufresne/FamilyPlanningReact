/**
 * Ajoute score_rt, score_imdb, score_metacritic et prix régionaux (Iris, Jutra, etc.)
 * à chaque film dans src/data/films.json via l'API Claude.
 * Traite 5 films par appel pour limiter le nombre de requêtes.
 *
 * Usage: node scripts/update-film-scores.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILMS_PATH = path.join(__dirname, '../src/data/films.json');

const client = new Anthropic();

const PALMARES_VALIDES = [
  'cannes_palme_dor','cannes_grand_prix','cannes_jury','cannes_meilleur_realisateur',
  'cannes_meilleur_scenario','oscar_meilleur_film','oscar_etranger',
  'oscar_meilleur_film_animation','bafta','golden_globe','berlinale','venice',
  'toronto','sundance','cesar','cesar_meilleur_film','iris','jutra','genie',
  'imdb_top250','afi_top100','sight_sound','japan_critics','silver_bear',
];

function needsUpdate(film) {
  return film.score_rt === undefined || film.score_imdb === undefined;
}

async function processBatch(batch) {
  const filmList = batch.map(f =>
    `- id: ${f.id} | "${f.nom}" (${f.annee}) de ${f.realisateur} [${f.pays}]`
  ).join('\n');

  const prompt = `Pour chacun des films ci-dessous, donne les scores critiques et les prix régionaux importants.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown:

${filmList}

Format attendu (un objet par film):
[
  {
    "id": "metropolis",
    "score_rt": 98,
    "score_imdb": 8.3,
    "score_metacritic": 99,
    "palmares_additionnel": ["jutra", "iris"]
  }
]

Règles:
- score_rt: Tomatometer Rotten Tomatoes (0-100), null si film trop ancien ou introuvable
- score_imdb: note IMDB (ex: 8.3), null si introuvable
- score_metacritic: score Metacritic (0-100), null si introuvable
- palmares_additionnel: UNIQUEMENT les prix RÉELLEMENT remportés parmi: ${PALMARES_VALIDES.join(', ')}
  Inclure les prix québécois (iris=Prix Iris après 2016, jutra=Prix Jutra avant 2016, cesar=César)
  Ne PAS répéter les prix déjà dans le champ palmares du film
- Si un score est vraiment inconnu, mettre null (pas 0)`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Format inattendu pour batch: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

async function main() {
  const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf-8'));

  const toUpdate = films.filter(needsUpdate);
  console.log(`Films à mettre à jour: ${toUpdate.length}/${films.length}`);

  const BATCH_SIZE = 5;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const batchNums = `${i + 1}-${Math.min(i + BATCH_SIZE, toUpdate.length)}`;

    process.stdout.write(`  Batch ${batchNums}/${toUpdate.length}... `);

    try {
      const results = await processBatch(batch);

      for (const result of results) {
        const film = films.find(f => f.id === result.id);
        if (!film) { console.warn(`\n  ⚠ Film introuvable: ${result.id}`); continue; }

        film.score_rt = result.score_rt ?? null;
        film.score_imdb = result.score_imdb ?? null;
        film.score_metacritic = result.score_metacritic ?? null;

        // Fusionner palmares_additionnel avec palmares existant
        if (result.palmares_additionnel?.length) {
          const existant = new Set(film.palmares || []);
          const nouveaux = result.palmares_additionnel.filter(p =>
            PALMARES_VALIDES.includes(p) && !existant.has(p)
          );
          if (nouveaux.length) {
            film.palmares = [...(film.palmares || []), ...nouveaux];
          }
        }

        updated++;
      }

      process.stdout.write(`✓ (${results.length} films)\n`);
    } catch (e) {
      console.error(`\n  ✗ Erreur batch ${batchNums}: ${e.message}`);
    }

    // Sauvegarder après chaque batch (résistant aux interruptions)
    fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf-8');

    // Délai pour éviter le rate limiting
    if (i + BATCH_SIZE < toUpdate.length) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  console.log(`\nTerminé. ${updated} films mis à jour.`);
}

main().catch(e => { console.error(e); process.exit(1); });
