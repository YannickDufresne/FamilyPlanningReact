/**
 * fetch-albums.mjs
 *
 * Pour chaque album dans src/data/albums.json :
 *   1. Si url_apple_music est null → cherche via iTunes Search API (gratuit, sans clé)
 *   2. Si description est null → génère via Claude API (2-3 phrases françaises)
 *
 * Variables d'environnement :
 *   ANTHROPIC_API_KEY — requis pour les descriptions IA
 *
 * Usage :
 *   node scripts/fetch-albums.mjs
 *   node scripts/fetch-albums.mjs --only-itunes   # iTunes seulement, pas Claude
 *   node scripts/fetch-albums.mjs --only-desc      # Descriptions seulement
 *   node scripts/fetch-albums.mjs --limit 20       # Traiter les 20 premiers manquants
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dir, '..', 'src', 'data');
const ALBUMS_PATH = join(DATA_DIR, 'albums.json');
const META_PATH = join(DATA_DIR, 'albums-meta.json');

const args = process.argv.slice(2);
const ONLY_ITUNES = args.includes('--only-itunes');
const ONLY_DESC   = args.includes('--only-desc');
const limitIdx    = args.indexOf('--limit');
const LIMIT       = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 999 : 999;

// ── Pause pour ne pas surcharger les API ─────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── iTunes Search API (gratuit) ───────────────────────────────────────────────
async function rechercherITunes(artiste, nom) {
  try {
    const terme = encodeURIComponent(`${artiste} ${nom}`);
    const url = `https://itunes.apple.com/search?term=${terme}&entity=album&limit=5&country=ca`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const match = (data.results || []).find(r => r.wrapperType === 'collection' && r.artworkUrl100);
    if (!match) return null;
    return {
      url_apple_music: match.collectionViewUrl || null,
      artwork_url: match.artworkUrl100.replace('100x100bb', '600x600bb'),
    };
  } catch (e) {
    console.warn(`  iTunes erreur pour "${artiste} — ${nom}": ${e.message}`);
    return null;
  }
}

// ── Claude API — rang mondial estimé ─────────────────────────────────────────
async function estimerRangMondial(album, anthropic) {
  try {
    const { nom, artiste, pays, annee, palmares } = album;
    const prompt = `En tant qu'expert en histoire de la musique, estime la position approximative de l'album "${nom}" de ${artiste} (${pays}, ${annee}) dans un classement mondial de consensus critique qui agrège Rolling Stone, Acclaimed Music, Rate Your Music, Pitchfork et NME.

Réponds UNIQUEMENT avec un entier représentant le rang estimé (ex: 5, 42, 150, 800).
- Top 10 : albums universellement reconnus comme les meilleurs de tous les temps
- Top 50 : classiques absolus présents dans presque toutes les listes
- Top 200 : essentiels largement cités
- Top 500 : très importants dans leur genre ou région
- Top 1500 : reconnus mais moins universels
- Au-delà : importants régionalement ou dans un genre précis

Réponds avec le rang seul, rien d'autre.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content?.[0]?.text?.trim();
    const rang = parseInt(text);
    return isNaN(rang) ? null : rang;
  } catch (e) {
    return null;
  }
}

// ── Claude API — description album ───────────────────────────────────────────
async function genererDescription(album, anthropic) {
  try {
    const { nom, artiste, pays, annee } = album;
    const prompt = `Génère une description de 2-3 phrases pour l'album "${nom}" de ${artiste} (${pays}, ${annee}). Inclus: contexte historique, un fait surprenant ou anecdote, pourquoi c'est important culturellement. Style: vivant, accessible, comme un ami passionné de musique. Réponds en français.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content?.[0]?.text?.trim();
    return text || null;
  } catch (e) {
    console.warn(`  Claude erreur pour "${album.nom}": ${e.message}`);
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📀 fetch-albums.mjs — démarrage\n');

  // Lire albums existants
  const albums = JSON.parse(readFileSync(ALBUMS_PATH, 'utf8'));
  console.log(`Albums chargés : ${albums.length}`);

  // Initialiser Anthropic si nécessaire
  let anthropic = null;
  if (!ONLY_ITUNES) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY manquante — descriptions ignorées');
    } else {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      anthropic = new Anthropic({ apiKey });
      console.log('Claude API initialisé ✓');
    }
  }

  let modifie = 0;
  let itunesTraites = 0;
  let descTraites = 0;

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i];

    // iTunes — url Apple Music + artwork
    if (!ONLY_DESC && album.url_apple_music === null && itunesTraites < LIMIT) {
      process.stdout.write(`[${i+1}/${albums.length}] iTunes: ${album.artiste} — ${album.nom}... `);
      const result = await rechercherITunes(album.artiste, album.nom);
      if (result) {
        albums[i].url_apple_music = result.url_apple_music || '';
        albums[i].artwork_url     = result.artwork_url || null;
        modifie++;
        console.log('✓ (artwork + lien)');
      } else {
        albums[i].url_apple_music = '';
        albums[i].artwork_url     = null;
        console.log('—');
      }
      itunesTraites++;
      await sleep(350);
    }

    // Description
    if (!ONLY_ITUNES && album.description === null && anthropic && descTraites < LIMIT) {
      process.stdout.write(`[${i+1}/${albums.length}] Description: ${album.artiste} — ${album.nom}... `);
      const desc = await genererDescription(album, anthropic);
      if (desc) {
        albums[i].description = desc;
        modifie++;
        console.log('✓');
      } else {
        console.log('—');
      }
      descTraites++;
      await sleep(400);
    }

    // Rang mondial estimé
    if (!ONLY_ITUNES && album.rang_mondial === null && anthropic && descTraites < LIMIT) {
      const rang = await estimerRangMondial(album, anthropic);
      if (rang) {
        albums[i].rang_mondial = rang;
        modifie++;
      }
      await sleep(200);
    }

    // Sauvegarder régulièrement (tous les 10 albums)
    if ((itunesTraites + descTraites) > 0 && (itunesTraites + descTraites) % 10 === 0) {
      writeFileSync(ALBUMS_PATH, JSON.stringify(albums, null, 2), 'utf8');
      console.log(`  → Sauvegarde intermédiaire (${modifie} modifié${modifie > 1 ? 's' : ''})`);
    }
  }

  // Sauvegarde finale
  writeFileSync(ALBUMS_PATH, JSON.stringify(albums, null, 2), 'utf8');

  // Mise à jour meta
  const meta = {
    lastUpdated: new Date().toISOString(),
    count: albums.length,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf8');

  console.log(`\n✅ Terminé — ${modifie} album${modifie > 1 ? 's' : ''} modifié${modifie > 1 ? 's' : ''}`);
  console.log(`   iTunes traités : ${itunesTraites}`);
  console.log(`   Descriptions générées : ${descTraites}`);
}

main().catch(e => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
