/**
 * fetch-images-wiki.mjs
 * Récupère des images Wikimedia pour les recettes sans image_url via l'API Wikipedia.
 * Usage : node scripts/fetch-images-wiki.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECETTES_PATH = join(__dirname, '../src/data/recettes.json');
const DELAI_MS = 300;

// Mapping: nom français → titre Wikipedia (EN ou FR) pour meilleure précision
const WIKI_TITRES = {
  'Pesto Genovese':              'Pesto',
  'Carbonara Express':           'Carbonara',
  'Aglio e Olio':                'Spaghetti aglio e olio',
  'Cacio e Pepe':                'Cacio e pepe',
  'Puttanesca Rapide':           'Pasta puttanesca',
  'Spaghetti Bolognaise':        'Bolognese sauce',
  'Penne Arrabiata':             'Arrabbiata sauce',
  'Mac and Cheese':              'Macaroni and cheese',
  'Tacos Mexicains':             'Taco',
  'Poke Bowl':                   'Poke (Hawaiian dish)',
  'Ramen Express':               'Ramen',
  'Buddha Bowl':                 'Buddha bowl',
  'Burrito Bowl':                'Burrito bowl',
  'Saumon Teriyaki':             'Teriyaki',
  'Fish and Chips':              'Fish and chips',
  'Paella aux Fruits de Mer':    'Paella',
  'Ceviche Péruvien':            'Ceviche',
  'Truite aux Amandes':          'Truite aux amandes',
  'Sushi Bowl':                  'Chirashi sushi',
  'Pad Thaï aux Crevettes':      'Pad thai',
  'Bouillabaisse Express':       'Bouillabaisse',
  'Falafel Libanais':            'Falafel',
  'Curry Végétarien':            'Vegetable curry',
  'Ratatouille Provençale':      'Ratatouille',
  'Pad Thai Végé':               'Pad thai',
  'Taboulé Libanais':            'Tabbouleh',
  'Risotto aux Champignons':     'Risotto',
  'Burger Végétarien':           'Veggie burger',
  'Quinoa aux Légumes Rôtis':    'Quinoa',
  'Salade de Lentilles':         'Lentil soup',
  'Couscous Végétarien':         'Couscous',
  'Chili Végétarien':            'Chili sin carne',
  'Steak Grillé':                'Beefsteak',
  'Brochettes de Poulet':        'Chicken skewers',
  'BBQ Ribs':                    'Spare ribs',
  'Saucisses Grillées':          'Bratwurst',
  'Hamburger Classique':         'Hamburger',
  'Magret de Canard':            'Magret de canard',
  'Côtelettes d\'Agneau':        'Lamb chop',
  'Hot-Dogs Maison':             'Hot dog',
  'Porc Effiloché':              'Pulled pork',
  'Pizza Margherita':            'Pizza Margherita',
  'Pizza Pepperoni':             'Pepperoni pizza',
  'Pizza Végétarienne':          'Pizza',
  'Pizza Québécoise':            'Pizza',
  'Pizza Blanche':               'White pizza',
  'Pizza aux Fruits de Mer':     'Seafood pizza',
  'Pizza 4 Fromages':            'Four cheese pizza',
  'Boeuf Bourguignon':           'Beef bourguignon',
  'Coq au Vin':                  'Coq au vin',
  'Osso Buco':                   'Ossobuco',
  'Confit de Canard':            'Duck confit',
  'Gigot d\'Agneau':             'Leg of lamb',
  'Filet de Boeuf Wellington':   'Beef Wellington',
  'Rôti de Porc aux Pommes':     'Roast pork',
  'Cassoulet Toulousain':        'Cassoulet',
  'Pot-au-Feu':                  'Pot-au-feu',
  'Bouillabaisse':               'Bouillabaisse',
};

async function fetchWikiImage(titre) {
  // Essai 1 : pageimages via titre exact
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titre)}&prop=pageimages&format=json&pithumbsize=600&piprop=thumbnail|original&origin=*`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await resp.json();
    const pages = Object.values(json.query?.pages || {});
    const page = pages[0];
    if (page && page.original?.source) return page.original.source;
    if (page && page.thumbnail?.source) return page.thumbnail.source.replace(/\/\d+px-/, '/600px-');
    return null;
  } catch {
    return null;
  }
}

async function fetchWikiImageSearch(nom) {
  // Fallback : recherche textuelle
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(nom)}&srlimit=3&format=json&origin=*`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await resp.json();
    const results = json.query?.search || [];
    for (const r of results) {
      const img = await fetchWikiImage(r.title);
      if (img) return img;
    }
    return null;
  } catch {
    return null;
  }
}

const data = JSON.parse(readFileSync(RECETTES_PATH, 'utf-8'));
const aTraiter = data.filter(r => !r.image_url);

console.log(`\n🖼  ${aTraiter.length} recettes sans image\n`);

let ok = 0, raté = 0;

for (let i = 0; i < aTraiter.length; i++) {
  const r = aTraiter[i];
  const pct = `[${String(i + 1).padStart(3)}/${aTraiter.length}]`;
  process.stdout.write(`${pct} ${r.nom.slice(0, 55).padEnd(55)} `);

  const titreCible = WIKI_TITRES[r.nom] || r.nom;
  let img = await fetchWikiImage(titreCible);

  if (!img && titreCible !== r.nom) {
    img = await fetchWikiImageSearch(r.nom);
  }

  if (img) {
    const idx = data.findIndex(d => d.nom === r.nom);
    if (idx !== -1) data[idx].image_url = img;
    ok++;
    console.log(`✓  ${img.slice(0, 60)}`);
  } else {
    raté++;
    console.log(`✗`);
  }

  if ((i + 1) % 20 === 0) {
    writeFileSync(RECETTES_PATH, JSON.stringify(data, null, 2));
    console.log(`   💾 Sauvegarde (${ok} images trouvées)`);
  }

  await new Promise(res => setTimeout(res, DELAI_MS));
}

writeFileSync(RECETTES_PATH, JSON.stringify(data, null, 2));
console.log(`\n✅ Terminé : ${ok} images, ${raté} échecs\n`);
