/**
 * fetch-all-circulaires.mjs
 * Lance tous les scrapers de circulaires en parallèle, puis génère aubaines.json
 *
 * Usage : node scripts/fetch-all-circulaires.mjs
 *
 * Ordre :
 *   1. En parallèle : Maxi, Metro, Adonis, Costco Flipp+Vision (si ANTHROPIC_API_KEY)
 *   2. Séquentiel  : fetch-aubaines.mjs (analyse Claude + génération aubaines.json)
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

function runScript(name) {
  return new Promise((resolve) => {
    console.log(`\n▶ Lancement de ${name}…`);
    const child = spawn('node', [join(__dir, name)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`⚠️  ${name} terminé avec code ${code}`);
      } else {
        console.log(`✅ ${name} terminé`);
      }
      resolve(code);
    });
    child.on('error', (err) => {
      console.error(`❌ ${name} : ${err.message}`);
      resolve(1);
    });
  });
}

async function main() {
  console.log('🛒 Fetch de tous les circulaires…\n');
  const t0 = Date.now();

  // Étape 1 : Scrapers en parallèle
  const scrapers = [
    'fetch-maxi-loblaws.mjs',
    'fetch-metro.mjs',
    'fetch-adonis.mjs',
  ];

  // Costco Vision si clé Anthropic disponible
  if (process.env.ANTHROPIC_API_KEY) {
    scrapers.push('fetch-costco-flipp.mjs');
  } else {
    console.log('ℹ️  ANTHROPIC_API_KEY absente — Costco Flipp Vision ignoré (utilise catalogue)');
  }

  await Promise.all(scrapers.map(runScript));

  // Étape 2 : Analyse et génération aubaines.json
  await runScript('fetch-aubaines.mjs');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n🏁 Terminé en ${elapsed}s`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
