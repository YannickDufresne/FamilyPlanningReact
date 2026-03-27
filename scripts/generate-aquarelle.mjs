/**
 * generate-aquarelle.mjs
 * Génère une illustration aquarelle IA pour chaque recette via Together AI (FLUX.1-schnell).
 * Télécharge dans public/images/recettes/ et ajoute image_aquarelle dans recettes.json.
 * Le champ image_url (photos originales) est conservé intact.
 *
 * Usage :
 *   TOGETHER_KEY=tgp_v1_... node scripts/generate-aquarelle.mjs
 *   TOGETHER_KEY=tgp_v1_... node scripts/generate-aquarelle.mjs --all  # régénère tout
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname     = dirname(fileURLToPath(import.meta.url));
const RECETTES_PATH = join(__dirname, '../src/data/recettes.json');
const IMG_DIR       = join(__dirname, '../public/images/recettes');
// Chemin stocké sans slash initial — préfixé par import.meta.env.BASE_URL dans l'app
const BASE_PATH     = 'images/recettes';

const TOGETHER_KEY  = process.env.TOGETHER_KEY || '';
const CONCURRENCY   = 4;
const TIMEOUT_MS    = 60000;
const args          = process.argv.slice(2);
const skipExisting  = !args.includes('--all');

if (!TOGETHER_KEY) {
  console.error('\n❌  Clé Together AI manquante.');
  console.error('   Lance avec : TOGETHER_KEY=tgp_v1_... node scripts/generate-aquarelle.mjs\n');
  process.exit(1);
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function toSlug(nom) {
  return nom
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildPrompt(nom, nomOriginal) {
  const dish = nomOriginal || nom;
  return [
    `watercolor painting of ${dish}`,
    'loose wet watercolor brushstrokes',
    'paint bleeds and washes',
    'soft pastel tones',
    'white background',
    'hand-painted food illustration',
    'no text',
    'no border',
  ].join(', ');
}

function formatEta(ms) {
  if (!isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}

function bar(done, total, width = 24) {
  const filled = Math.round((done / total) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

// ── Génération + téléchargement ───────────────────────────────────────────────

async function generateAndDownload(nom, nomOriginal, destPath) {
  const prompt = buildPrompt(nom, nomOriginal);

  const genResp = await fetch('https://api.together.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOGETHER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt,
      width: 512,
      height: 512,
      steps: 4,
      n: 1,
      response_format: 'url',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!genResp.ok) {
    const err = await genResp.text();
    throw new Error(`Together AI ${genResp.status}: ${err.slice(0, 120)}`);
  }

  const json   = await genResp.json();
  const imgUrl = json?.data?.[0]?.url;
  if (!imgUrl) throw new Error('Pas d\'URL dans la réponse Together AI');

  const imgResp = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
  if (!imgResp.ok) throw new Error(`Téléchargement HTTP ${imgResp.status}`);

  const buf = await imgResp.arrayBuffer();
  if (buf.byteLength < 2000) throw new Error('Image trop petite');
  writeFileSync(destPath, Buffer.from(buf));
  return buf.byteLength;
}

// ── Traitement ────────────────────────────────────────────────────────────────

async function processRecette(r, data) {
  const slug     = toSlug(r.nom);
  const filename = `${slug}.jpg`;
  const destPath = join(IMG_DIR, filename);
  const localRef = `${BASE_PATH}/${filename}`;

  if (skipExisting && existsSync(destPath)) {
    const idx = data.findIndex(d => d.nom === r.nom);
    if (idx !== -1 && data[idx].image_aquarelle !== localRef) {
      data[idx].image_aquarelle = localRef;
    }
    return { status: 'skip', nom: r.nom };
  }

  const bytes = await generateAndDownload(r.nom, r.nom_original, destPath);
  const idx   = data.findIndex(d => d.nom === r.nom);
  if (idx !== -1) data[idx].image_aquarelle = localRef;
  return { status: 'ok', nom: r.nom, bytes };
}

// ── Main ─────────────────────────────────────────────────────────────────────

mkdirSync(IMG_DIR, { recursive: true });

const data      = JSON.parse(readFileSync(RECETTES_PATH, 'utf-8'));
const aTraiter  = skipExisting
  ? data.filter(r => !existsSync(join(IMG_DIR, `${toSlug(r.nom)}.jpg`)))
  : data;

const total     = aTraiter.length;
const dejaPrets = data.length - total;

console.log('\n┌─────────────────────────────────────────────────────┐');
console.log(`│  🎨  Génération aquarelle — Together AI (FLUX)       │`);
console.log('├─────────────────────────────────────────────────────┤');
console.log(`│  Recettes à générer : ${String(total).padEnd(4)}  (${dejaPrets} déjà présentes)  │`);
console.log(`│  Parallélisme : ${CONCURRENCY} à la fois                         │`);
console.log('└─────────────────────────────────────────────────────┘\n');

let ok = 0, skipped = 0, failed = 0;
const errors  = [];
const startMs = Date.now();
let done      = 0;

for (let i = 0; i < total; i += CONCURRENCY) {
  const batch   = aTraiter.slice(i, i + CONCURRENCY);
  const results = await Promise.allSettled(batch.map(r => processRecette(r, data)));

  for (let j = 0; j < results.length; j++) {
    done++;
    const res = results[j];
    const n   = `${String(done).padStart(3)}/${total}`;
    const elapsed = Date.now() - startMs;
    const eta     = done > 0 ? formatEta((elapsed / done) * (total - done)) : '—';
    const progress = bar(done, total);

    if (res.status === 'fulfilled') {
      const { status, nom, bytes } = res.value;
      if (status === 'skip') {
        skipped++;
        console.log(`[${n}] ${progress} ⏭  ${nom.slice(0, 40)}`);
      } else {
        ok++;
        const ko = Math.round(bytes / 1024);
        console.log(`[${n}] ${progress} ✓  ${nom.slice(0, 38).padEnd(38)} ${String(ko).padStart(3)} Ko  ETA ${eta}`);
      }
    } else {
      failed++;
      const nom = batch[j]?.nom || '?';
      errors.push(`${nom}: ${res.reason?.message}`);
      console.log(`[${n}] ${progress} ✗  ${nom.slice(0, 38)}  — ${res.reason?.message}`);
    }
  }

  // Sauvegarde intermédiaire toutes les 20 recettes
  if (ok > 0 && done % 20 < CONCURRENCY) {
    writeFileSync(RECETTES_PATH, JSON.stringify(data, null, 2));
    console.log(`\n   💾 Sauvegarde (${ok} générées, ${failed} erreurs) …\n`);
  }
}

writeFileSync(RECETTES_PATH, JSON.stringify(data, null, 2));

const totalSec = Math.round((Date.now() - startMs) / 1000);
console.log('\n┌─────────────────────────────────────────────────────┐');
console.log(`│  ✅  Terminé en ${String(totalSec).padEnd(4)}s                              │`);
console.log(`│     Générées : ${String(ok).padEnd(4)}  Ignorées : ${String(skipped).padEnd(4)}  Erreurs : ${String(failed).padEnd(4)} │`);
console.log('└─────────────────────────────────────────────────────┘');
if (errors.length) {
  console.log('\nErreurs :');
  errors.forEach(e => console.log('  -', e));
  console.log('\nRelancez le script pour réessayer les erreurs.');
}
console.log(`\n📁 Images dans : ${IMG_DIR}\n`);
