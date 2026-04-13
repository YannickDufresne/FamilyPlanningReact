/**
 * Sélection déterministe du film de la semaine.
 * Critères : saison courante + origine culturelle de la recette.
 */

export function saisonActuelle(dateDebut) {
  const mois = new Date((dateDebut || '') + 'T12:00:00').getMonth() + 1; // 1-12
  if (mois >= 3 && mois <= 5)  return 'printemps';
  if (mois >= 6 && mois <= 8)  return 'été';
  if (mois >= 9 && mois <= 11) return 'automne';
  return 'hiver';
}

// Seed basé sur la semaine pour être déterministe entre appareils
function seedDeSemaine(dateDebut) {
  if (!dateDebut) return 0;
  const d = new Date(dateDebut + 'T12:00:00');
  return Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
}

function pseudoRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(s) / 0x7fffffff;
  };
}

// Correspondances origine recette → origines_cinema
function matchOrigine(origineRecette, origineCinema) {
  if (!origineRecette || origineRecette === 'Tous') return true;
  const mappings = {
    'Corée':        ['Corée'],
    'Chine':        ['Chine', 'Taïwan', 'Hong Kong'],
    'Japon':        ['Japon'],
    'Inde':         ['Inde'],
    'Mexique':      ['Mexique'],
    'Brésil':       ['Brésil'],
    'Argentine':    ['Argentine'],
    'France':       ['France'],
    'Italie':       ['Italie'],
    'Espagne':      ['Espagne'],
    'Maroc':        ['Maroc', 'Afrique du Nord', 'Moyen-Orient'],
    'Liban':        ['Liban', 'Moyen-Orient'],
    'Québec':       ['Québec'],
    'Canada':       ['Canada', 'Québec'],
    'Royaume-Uni':  ['Royaume-Uni'],
    'Allemagne':    ['Allemagne'],
    'Russie':       ['Russie'],
    'Suède':        ['Suède'],
    'Iran':         ['Iran'],
    'États-Unis':   ['États-Unis'],
    'Turquie':      ['Turquie'],
    'Nigeria':      ['Nigeria', 'Afrique du Sud'],
    'Éthiopie':     ['Éthiopie', 'Afrique du Sud'],
    'Afrique du Sud': ['Afrique du Sud'],
    'Asie':         ['Japon', 'Corée', 'Chine', 'Inde', 'Vietnam', 'Thaïlande', 'Asie'],
    'Europe':       ['France', 'Italie', 'Espagne', 'Allemagne', 'Royaume-Uni', 'Russie', 'Suède', 'Europe'],
    'Amériques':    ['États-Unis', 'Canada', 'Québec', 'Brésil', 'Mexique', 'Argentine', 'Colombie', 'Amériques'],
  };
  const valides = mappings[origineRecette] || [origineRecette];
  return valides.includes(origineCinema);
}

/**
 * Retourne la liste des films candidats filtrés par saison + origine.
 */
export function getFilmsCandidats(semaineDebut, origineRecette, films) {
  if (!films?.length) return [];
  const saison = saisonActuelle(semaineDebut);

  // 1. Filtrer par saison
  let candidats = films.filter(f => {
    const s = f.saisons || ['tout'];
    return s.includes('tout') || s.includes(saison);
  });

  // 2. Filtrer par origine si définie
  if (origineRecette && origineRecette !== 'Tous') {
    const parOrigine = candidats.filter(f =>
      (f.origines_cinema || []).some(oc => matchOrigine(origineRecette, oc))
    );
    if (parOrigine.length === 0) return []; // Aucun film pour cette origine
    candidats = parOrigine;
  }

  // 3. Prioriser incontournables / score ≥ 90
  const top = candidats.filter(f => f.incontournable || (f.score_consensus || 0) >= 90);
  return top.length >= 3 ? top : candidats;
}

/**
 * Retourne l'index de départ déterministe pour la semaine.
 */
export function getFilmIndexInitial(semaineDebut, pool) {
  if (!pool.length) return 0;
  const seed = seedDeSemaine(semaineDebut);
  const rand = pseudoRandom(seed);
  return Math.floor(rand() * pool.length);
}

/**
 * Rétro-compatibilité : retourne directement le film sélectionné.
 */
export function choisirFilmDeSemaine(semaineDebut, origineRecette, films, _ratings = {}) {
  const pool = getFilmsCandidats(semaineDebut, origineRecette, films);
  if (!pool.length) return null;
  const idx = getFilmIndexInitial(semaineDebut, pool);
  return pool[idx];
}
