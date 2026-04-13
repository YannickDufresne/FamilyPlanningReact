/**
 * Patch direct de films.json avec les scores RT, IMDB, Metacritic
 * et les prix régionaux (Iris, Jutra, César, etc.)
 * Données issues de la base de connaissances — aucun appel API requis.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILMS_PATH = path.join(__dirname, '../src/data/films.json');

// score_rt (Rotten Tomatoes %), score_imdb (sur 10), score_metacritic (sur 100)
// palmares_add: prix supplémentaires à fusionner
const SCORES = {
  'citizen-kane-1941':          { rt: 99,  imdb: 8.3, meta: 100 },
  'vertigo-1958':               { rt: 96,  imdb: 8.3, meta: 100 },
  '2001-space-odyssey-1968':    { rt: 96,  imdb: 8.3, meta: 84  },
  'casablanca-1942':            { rt: 99,  imdb: 8.5, meta: 100 },
  'godfather-1972':             { rt: 98,  imdb: 9.2, meta: 100 },
  'apocalypse-now-1979':        { rt: 96,  imdb: 8.4, meta: 94  },
  'taxi-driver-1976':           { rt: 96,  imdb: 8.2, meta: 94  },
  'chinatown-1974':             { rt: 99,  imdb: 8.1, meta: 92  },
  'dr-strangelove-1964':        { rt: 98,  imdb: 8.4, meta: 97  },
  'mulholland-drive-2001':      { rt: 84,  imdb: 7.9, meta: 84  },
  'there-will-be-blood-2007':   { rt: 91,  imdb: 8.1, meta: 93  },
  'no-country-for-old-men-2007':{ rt: 93,  imdb: 8.2, meta: 91  },
  'moonlight-2016':             { rt: 98,  imdb: 7.4, meta: 99  },
  'pulp-fiction-1994':          { rt: 92,  imdb: 8.9, meta: 94  },
  'raging-bull-1980':           { rt: 96,  imdb: 8.2, meta: 89  },
  'annie-hall-1977':            { rt: 97,  imdb: 8.0, meta: 92  },
  'schindlers-list-1993':       { rt: 98,  imdb: 9.0, meta: 94  },
  'blade-runner-1982':          { rt: 89,  imdb: 8.1, meta: 84  },
  'fargo-1996':                 { rt: 94,  imdb: 8.1, meta: 85  },
  'everything-everywhere-2022': { rt: 95,  imdb: 7.8, meta: 81  },
  'get-out-2017':               { rt: 98,  imdb: 7.7, meta: 84  },
  'tree-of-life-2011':          { rt: 84,  imdb: 6.8, meta: 85  },
  'blue-velvet-1986':           { rt: 93,  imdb: 7.7, meta: 79  },
  'network-1976':               { rt: 93,  imdb: 8.1, meta: null },
  // Québec
  'mon-oncle-antoine-1971':     { rt: 97,  imdb: 7.6, meta: null, add: ['jutra'] },
  'jesus-de-montreal-1989':     { rt: 95,  imdb: 7.8, meta: null, add: ['jutra', 'cesar'] },
  'declin-empire-americain-1986':{ rt: 94, imdb: 7.4, meta: null, add: ['jutra', 'cesar'] },
  'invasions-barbares-2003':    { rt: 96,  imdb: 7.8, meta: 83,   add: ['jutra', 'cesar'] },
  'crazy-2005':                 { rt: 87,  imdb: 7.7, meta: null, add: ['jutra', 'iris'] },
  'incendies-2010':             { rt: 90,  imdb: 8.1, meta: 80,   add: ['iris'] },
  'leolo-1992':                 { rt: 93,  imdb: 7.6, meta: null, add: ['jutra'] },
  'mommy-2014':                 { rt: 89,  imdb: 8.0, meta: 82,   add: ['iris'] },
  'monsieur-lazhar-2011':       { rt: 95,  imdb: 7.5, meta: 80,   add: ['jutra', 'iris'] },
  'polytechnique-2009':         { rt: 91,  imdb: 7.5, meta: null, add: ['jutra', 'iris'] },
  'jai-tue-ma-mere-2009':       { rt: 96,  imdb: 7.4, meta: null, add: ['jutra', 'iris'] },
  'les-bons-debarras-1980':     { rt: null,imdb: 7.7, meta: null, add: ['jutra'] },
  // France
  'regle-du-jeu-1939':          { rt: 100, imdb: 8.0, meta: 100 },
  '400-coups-1959':             { rt: 99,  imdb: 8.2, meta: 100 },
  'a-bout-de-souffle-1960':     { rt: 97,  imdb: 7.9, meta: null },
  'au-hasard-balthazar-1966':   { rt: 100, imdb: 7.9, meta: 100 },
  'cleo-5-a-7-1962':            { rt: 98,  imdb: 7.7, meta: null },
  'playtime-1967':              { rt: 100, imdb: 8.1, meta: 100 },
  'portrait-jeune-fille-feu-2019':{ rt: 98, imdb: 7.9, meta: 95 },
  'amour-2012':                 { rt: 93,  imdb: 7.9, meta: 94  },
  'la-haine-1995':              { rt: 98,  imdb: 8.1, meta: 95  },
  'grande-illusion-1937':       { rt: 100, imdb: 8.2, meta: null },
  'latalante-1934':             { rt: 100, imdb: 7.7, meta: null },
  'hiroshima-mon-amour-1959':   { rt: 100, imdb: 7.9, meta: null },
  'entre-les-murs-2008':        { rt: 88,  imdb: 7.3, meta: 91  },
  // Italie
  'bicycle-thieves-1948':       { rt: 99,  imdb: 8.3, meta: 100 },
  '8-et-demi-1963':             { rt: 97,  imdb: 8.0, meta: null },
  'good-bad-ugly-1966':         { rt: 97,  imdb: 8.8, meta: null },
  'once-upon-west-1968':        { rt: 98,  imdb: 8.5, meta: null },
  'la-strada-1954':             { rt: 97,  imdb: 8.0, meta: null },
  'leopard-1963':               { rt: 100, imdb: 8.1, meta: null },
  'lavventura-1960':            { rt: 98,  imdb: 7.8, meta: null },
  'cinema-paradiso-1988':       { rt: 90,  imdb: 8.5, meta: null },
  'rome-open-city-1945':        { rt: 98,  imdb: 8.0, meta: null },
  'amarcord-1973':              { rt: 97,  imdb: 7.9, meta: null },
  // Japon
  'rashomon-1950':              { rt: 98,  imdb: 8.2, meta: 98  },
  'tokyo-story-1953':           { rt: 100, imdb: 8.2, meta: 100 },
  'seven-samurai-1954':         { rt: 100, imdb: 8.6, meta: 98  },
  'ikiru-1952':                 { rt: 98,  imdb: 8.3, meta: null },
  'sansho-1954':                { rt: 100, imdb: 8.4, meta: null },
  'spirited-away-2001':         { rt: 97,  imdb: 8.6, meta: 96  },
  'princess-mononoke-1997':     { rt: 92,  imdb: 8.4, meta: 76  },
  'shoplifters-2018':           { rt: 98,  imdb: 7.9, meta: 93  },
  'drive-my-car-2021':          { rt: 99,  imdb: 7.6, meta: 98  },
  'my-neighbor-totoro-1988':    { rt: 94,  imdb: 8.2, meta: 86  },
  'woman-in-dunes-1964':        { rt: 100, imdb: 8.1, meta: null },
  'after-life-1998':            { rt: 93,  imdb: 7.9, meta: null },
  // Corée
  'parasite-2019':              { rt: 99,  imdb: 8.5, meta: 96  },
  'oldboy-2003':                { rt: 80,  imdb: 8.1, meta: 74  },
  'memories-of-murder-2003':    { rt: 98,  imdb: 8.1, meta: 91  },
  'the-handmaiden-2016':        { rt: 94,  imdb: 8.1, meta: 84  },
  'burning-2018':               { rt: 93,  imdb: 7.5, meta: 93  },
  'spring-summer-fall-2003':    { rt: 94,  imdb: 8.0, meta: 89  },
  // Chine / HK / Taïwan
  'in-the-mood-for-love-2000':  { rt: 91,  imdb: 8.1, meta: 84  },
  'chungking-express-1994':     { rt: 97,  imdb: 8.1, meta: 77  },
  'yi-yi-2000':                 { rt: 98,  imdb: 8.1, meta: 94  },
  'farewell-my-concubine-1993': { rt: 93,  imdb: 8.1, meta: 92  },
  'raise-red-lantern-1991':     { rt: 98,  imdb: 8.1, meta: null },
  'crouching-tiger-2000':       { rt: 97,  imdb: 7.9, meta: 94  },
  'still-life-2006':            { rt: 91,  imdb: 7.4, meta: 88  },
  'happy-together-1997':        { rt: 89,  imdb: 7.7, meta: null },
  // Inde
  'pather-panchali-1955':       { rt: 99,  imdb: 8.4, meta: null },
  'aparajito-1956':             { rt: 97,  imdb: 8.2, meta: null },
  'world-of-apu-1959':          { rt: 99,  imdb: 8.3, meta: null },
  'mughal-e-azam-1960':         { rt: null,imdb: 8.1, meta: null },
  'devi-1960':                  { rt: null,imdb: 8.0, meta: null },
  // Allemagne
  'metropolis-1927':            { rt: 98,  imdb: 8.3, meta: null },
  'm-1931':                     { rt: 99,  imdb: 8.5, meta: null },
  'nosferatu-1922':             { rt: 97,  imdb: 7.9, meta: null },
  'wings-of-desire-1987':       { rt: 97,  imdb: 8.1, meta: null },
  'lives-of-others-2006':       { rt: 93,  imdb: 8.4, meta: 89  },
  // Russie / URSS
  'battleship-potemkin-1925':   { rt: 98,  imdb: 7.9, meta: null },
  'andrei-rublev-1966':         { rt: 100, imdb: 8.1, meta: null },
  'stalker-1979':               { rt: 100, imdb: 8.1, meta: null },
  'come-and-see-1985':          { rt: 100, imdb: 8.4, meta: null },
  'mirror-1975':                { rt: 94,  imdb: 8.1, meta: null },
  // Scandinavie
  'seventh-seal-1957':          { rt: 96,  imdb: 8.1, meta: null },
  'wild-strawberries-1957':     { rt: 98,  imdb: 8.2, meta: null },
  'persona-1966':               { rt: 95,  imdb: 8.1, meta: null },
  'fanny-alexander-1982':       { rt: 97,  imdb: 8.1, meta: null },
  'the-hunt-2012':              { rt: 93,  imdb: 8.3, meta: 77  },
  'let-the-right-one-in-2008':  { rt: 98,  imdb: 7.9, meta: 82  },
  // UK
  'lawrence-of-arabia-1962':    { rt: 98,  imdb: 8.3, meta: 100 },
  'the-third-man-1949':         { rt: 99,  imdb: 8.1, meta: null },
  'kes-1969':                   { rt: 99,  imdb: 8.0, meta: null },
  'i-daniel-blake-2016':        { rt: 90,  imdb: 7.9, meta: 87  },
  'brief-encounter-1945':       { rt: 97,  imdb: 7.9, meta: null },
  // Iran
  'close-up-1990':              { rt: 100, imdb: 8.0, meta: null },
  'a-separation-2011':          { rt: 99,  imdb: 8.3, meta: 95  },
  'taste-of-cherry-1997':       { rt: 91,  imdb: 7.6, meta: null },
  'children-of-heaven-1997':    { rt: 98,  imdb: 8.2, meta: null },
  // Espagne
  'viridiana-1961':             { rt: 100, imdb: 8.0, meta: null },
  'all-about-my-mother-1999':   { rt: 96,  imdb: 7.9, meta: 87  },
  'talk-to-her-2002':           { rt: 98,  imdb: 8.0, meta: 89  },
  'pans-labyrinth-2006':        { rt: 95,  imdb: 8.2, meta: 98  },
  // Amérique latine
  'city-of-god-2002':           { rt: 91,  imdb: 8.6, meta: 79  },
  'y-tu-mama-tambien-2001':     { rt: 91,  imdb: 7.7, meta: 88  },
  'amores-perros-2000':         { rt: 93,  imdb: 8.0, meta: 82  },
  'secret-in-their-eyes-2009':  { rt: 91,  imdb: 8.2, meta: 73  },
  'central-station-1998':       { rt: 95,  imdb: 7.9, meta: null },
  'embrace-of-serpent-2015':    { rt: 98,  imdb: 7.7, meta: 89  },
  // Moyen-Orient / Afrique
  'capernaum-2018':             { rt: 89,  imdb: 8.4, meta: 73  },
  'timbuktu-2014':              { rt: 97,  imdb: 7.3, meta: 88  },
  'atlantics-2019':             { rt: 94,  imdb: 6.9, meta: 91  },
  'xala-1975':                  { rt: 100, imdb: 7.4, meta: null },
  'yeelen-1987':                { rt: null,imdb: 7.3, meta: null },
  'battle-of-algiers-1966':     { rt: 98,  imdb: 8.0, meta: null },
  'paradise-now-2005':          { rt: 89,  imdb: 7.6, meta: 83  },
  'cairo-station-1958':         { rt: null,imdb: 7.7, meta: null },
  // Europe de l'Est
  '4-months-2007':              { rt: 96,  imdb: 7.9, meta: 99  },
  'ida-2013':                   { rt: 97,  imdb: 7.4, meta: 97  },
  'son-of-saul-2015':           { rt: 96,  imdb: 7.5, meta: 96  },
  'rosetta-1999':               { rt: 91,  imdb: 7.4, meta: 88  },
};

function main() {
  const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf-8'));
  let updated = 0;
  let skipped = 0;

  for (const film of films) {
    const s = SCORES[film.id];
    if (!s) { skipped++; continue; }

    if (s.rt !== undefined)   film.score_rt          = s.rt;
    if (s.imdb !== undefined) film.score_imdb         = s.imdb;
    if (s.meta !== undefined) film.score_metacritic   = s.meta;

    if (s.add?.length) {
      const existant = new Set(film.palmares || []);
      const nouveaux = s.add.filter(p => !existant.has(p));
      if (nouveaux.length) film.palmares = [...(film.palmares || []), ...nouveaux];
    }

    updated++;
  }

  fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf-8');
  console.log(`✓ ${updated} films mis à jour (${skipped} non couverts)`);
}

main();
