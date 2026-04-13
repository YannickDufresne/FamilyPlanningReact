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
    // Pays individuels
    'Corée':          ['Corée', 'Corée du Sud'],
    'Chine':          ['Chine', 'Taïwan', 'Hong Kong'],
    'Japon':          ['Japon'],
    'Inde':           ['Inde'],
    'Mexique':        ['Mexique'],
    'Brésil':         ['Brésil'],
    'Argentine':      ['Argentine'],
    'Colombie':       ['Colombie'],
    'Pérou':          ['Pérou'],
    'Cuba':           ['Cuba'],
    'Haïti':          ['Haïti'],
    'France':         ['France'],
    'Italie':         ['Italie'],
    'Espagne':        ['Espagne'],
    'Portugal':       ['Portugal'],
    'Allemagne':      ['Allemagne'],
    'Royaume-Uni':    ['Royaume-Uni'],
    'Russie':         ['Russie', 'URSS', 'Russie (URSS)'],
    'Pologne':        ['Pologne'],
    'Ukraine':        ['Ukraine'],
    'Grèce':          ['Grèce'],
    'Scandinavie':    ['Suède', 'Danemark', 'Norvège', 'Finlande', 'Islande'],
    'Maroc':          ['Maroc', 'Afrique du Nord'],
    'Algérie':        ['Algérie'],
    'Tunisie':        ['Tunisie'],
    'Égypte':         ['Égypte'],
    'Liban':          ['Liban'],
    'Iran/Perse':     ['Iran', 'Perse', 'Perse/Iran', 'Iran/Perse'],
    'Turquie':        ['Turquie'],
    'Israël':         ['Israël'],
    'Palestine':      ['Palestine'],
    'Irak':           ['Irak'],
    'Syrie':          ['Syrie'],
    'Québec':         ['Québec', 'Canada (Québec)'],
    'Canada':         ['Canada', 'Québec', 'Canada (Québec)'],
    'États-Unis':     ['États-Unis'],
    'Sénégal':        ['Sénégal'],
    'Mali':           ['Mali'],
    'Nigeria':        ['Nigeria'],
    'Ghana':          ['Ghana'],
    'Éthiopie':       ['Éthiopie'],
    'Afrique du Sud': ['Afrique du Sud'],
    'Indonésie':      ['Indonésie'],
    'Thaïlande':      ['Thaïlande'],
    'Viêtnam':        ['Viêtnam', 'Vietnam'],
    'Cambodge':       ['Cambodge'],
    'Philippines':    ['Philippines'],
    'Malaisie':       ['Malaisie'],
    'Fusion':         ['Fusion', 'Multi'],
    // Zones
    'Asie':                  ['Japon', 'Corée', 'Corée du Sud', 'Chine', 'Taïwan', 'Hong Kong', 'Inde', 'Viêtnam', 'Vietnam', 'Thaïlande', 'Indonésie', 'Cambodge', 'Philippines', 'Malaisie', 'Singapour', 'Myanmar', 'Laos', 'Sri Lanka', 'Asie'],
    'Moyen-Orient & Caucase': ['Iran', 'Perse', 'Liban', 'Turquie', 'Syrie', 'Irak', 'Palestine', 'Israël', 'Jordanie', 'Arabie Saoudite', 'Yémen', 'Oman', 'Géorgie', 'Arménie', 'Azerbaïdjan', 'Moyen-Orient'],
    'Europe':                ['France', 'Italie', 'Espagne', 'Portugal', 'Allemagne', 'Royaume-Uni', 'Russie', 'URSS', 'Pologne', 'Hongrie', 'Roumanie', 'Suède', 'Danemark', 'Norvège', 'Finlande', 'Grèce', 'Autriche', 'Belgique', 'Suisse', 'Pays-Bas', 'Ukraine', 'Croatie', 'Europe'],
    'Amériques':             ['États-Unis', 'Canada', 'Québec', 'Canada (Québec)', 'Brésil', 'Mexique', 'Argentine', 'Colombie', 'Pérou', 'Bolivie', 'Cuba', 'Haïti', 'Jamaïque', 'Venezuela', 'Équateur', 'Amériques'],
    'Afrique':               ['Maroc', 'Algérie', 'Tunisie', 'Égypte', 'Sénégal', 'Mali', 'Mauritanie', 'Nigeria', 'Ghana', 'Cameroun', 'Côte d\'Ivoire', 'Éthiopie', 'Kenya', 'Tanzanie', 'Afrique du Sud', 'Afrique'],
    'Afrique & Moyen-Orient':['Maroc', 'Algérie', 'Tunisie', 'Égypte', 'Sénégal', 'Mali', 'Mauritanie', 'Nigeria', 'Ghana', 'Éthiopie', 'Kenya', 'Afrique du Sud', 'Liban', 'Iran', 'Perse', 'Turquie', 'Syrie', 'Irak', 'Palestine', 'Israël', 'Moyen-Orient'],
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
