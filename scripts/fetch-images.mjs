/**
 * fetch-images.mjs
 * Récupère l'og:image de chaque recette ayant une URL mais pas encore d'image.
 * Usage : node scripts/fetch-images.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECETTES_PATH = join(__dirname, '../src/data/recettes.json');
const DELAI_MS = 180; // ms entre chaque requête

function extraireOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]?.startsWith('http')) return m[1];
  }
  return null;
}

async function fetchOgImage(url) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-CA,fr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) return null;
    // Lire seulement les premiers 20 Ko (les meta tags sont dans le <head>)
    const reader = resp.body.getReader();
    let html = '';
    while (html.length < 20000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel();
    return extraireOgImage(html);
  } catch {
    return null;
  }
}

const data = JSON.parse(readFileSync(RECETTES_PATH, 'utf-8'));
const aTraiter = data.filter(r => r.url && !r.image_url);

console.log(`\n🖼  ${aTraiter.length} recettes sans image (sur ${data.length} total)\n`);

if (aTraiter.length === 0) {
  console.log('Tout est déjà à jour !');
  process.exit(0);
}

let ok = 0, raté = 0;

for (let i = 0; i < aTraiter.length; i++) {
  const r = aTraiter[i];
  const pct = `[${String(i + 1).padStart(3)}/${aTraiter.length}]`;
  process.stdout.write(`${pct} ${r.nom.slice(0, 55).padEnd(55)} `);

  const img = await fetchOgImage(r.url);

  if (img) {
    const idx = data.findIndex(d => d.url === r.url && d.nom === r.nom);
    if (idx !== -1) data[idx].image_url = img;
    ok++;
    console.log(`✓`);
  } else {
    raté++;
    console.log(`✗`);
  }

  // Sauvegarder toutes les 25 recettes (sécurité en cas d'interruption)
  if ((i + 1) % 25 === 0) {
    writeFileSync(RECETTES_PATH, JSON.stringify(data, null, 2));
    console.log(`   💾 Sauvegarde intermédiaire (${ok} images trouvées jusqu'ici)`);
  }

  await new Promise(res => setTimeout(res, DELAI_MS));
}

writeFileSync(RECETTES_PATH, JSON.stringify(data, null, 2));
console.log(`\n✅ Terminé : ${ok} images trouvées, ${raté} échecs\n`);
