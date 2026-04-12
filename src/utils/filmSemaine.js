/**
 * Sélection déterministe du film de la semaine.
 * Critères : saison courante + origine culturelle de la recette.
 */

function saisonActuelle(dateDebut) {
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
  // LCG simple
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(s) / 0x7fffffff;
  };
}

/**
 * @param {string} semaineDebut - "YYYY-MM-DD"
 * @param {string|null} origineRecette - l'origine culturelle active (ex: "Japon", "Maroc")
 * @param {Array} films - tableau complet des films
 * @param {Object} ratings - { [filmId]: 0-5 }
 * @returns {Object|null} film sélectionné
 */
export function choisirFilmDeSemaine(semaineDebut, origineRecette, films, ratings = {}) {
  if (!films || films.length === 0) return null;

  const saison = saisonActuelle(semaineDebut);
  const seed = seedDeSemaine(semaineDebut);
  const rand = pseudoRandom(seed);

  // 1. Filtrer par saison (les films avec saisons: ["tout"] sont toujours éligibles)
  let candidats = films.filter(f => {
    const s = f.saisons || ['tout'];
    return s.includes('tout') || s.includes(saison);
  });

  // 2. Filtrer par origine culturelle si une origine est définie
  if (origineRecette && origineRecette !== 'Tout') {
    const parOrigine = candidats.filter(f => {
      const o = f.origines_cinema || [];
      return o.some(oc => oc === origineRecette ||
        // correspondances approximatives
        (origineRecette === 'Corée' && oc === 'Corée') ||
        (origineRecette === 'Chine' && (oc === 'Chine' || oc === 'Taïwan' || oc === 'Hong Kong')) ||
        (origineRecette === 'Japon' && oc === 'Japon') ||
        (origineRecette === 'Inde' && oc === 'Inde') ||
        (origineRecette === 'Mexique' && oc === 'Mexique') ||
        (origineRecette === 'Brésil' && oc === 'Brésil') ||
        (origineRecette === 'Argentine' && oc === 'Argentine') ||
        (origineRecette === 'France' && oc === 'France') ||
        (origineRecette === 'Italie' && oc === 'Italie') ||
        (origineRecette === 'Espagne' && oc === 'Espagne') ||
        (origineRecette === 'Maroc' && (oc === 'Maroc' || oc === 'Afrique du Nord' || oc === 'Moyen-Orient')) ||
        (origineRecette === 'Liban' && (oc === 'Liban' || oc === 'Moyen-Orient')) ||
        (origineRecette === 'Québec' && oc === 'Québec') ||
        (origineRecette === 'Canada' && (oc === 'Canada' || oc === 'Québec')) ||
        (origineRecette === 'Royaume-Uni' && oc === 'Royaume-Uni') ||
        (origineRecette === 'Allemagne' && oc === 'Allemagne') ||
        (origineRecette === 'Russie' && oc === 'Russie') ||
        (origineRecette === 'Suède' && oc === 'Suède') ||
        (origineRecette === 'Iran' && oc === 'Iran') ||
        (origineRecette === 'États-Unis' && oc === 'États-Unis') ||
        (origineRecette === 'Turquie' && oc === 'Turquie') ||
        (origineRecette === 'Nigeria' && oc === 'Nigeria') ||
        (origineRecette === 'Éthiopie' && oc === 'Éthiopie') ||
        (origineRecette === 'Afrique du Sud' && oc === 'Afrique du Sud') ||
        (origineRecette === 'Asie' && ['Japon', 'Corée', 'Chine', 'Inde', 'Vietnam', 'Thaïlande', 'Asie'].some(a => oc === a)) ||
        (origineRecette === 'Europe' && ['France', 'Italie', 'Espagne', 'Allemagne', 'Royaume-Uni', 'Russie', 'Suède', 'Europe'].some(e => oc === e)) ||
        (origineRecette === 'Amériques' && ['États-Unis', 'Canada', 'Québec', 'Brésil', 'Mexique', 'Argentine', 'Colombie', 'Amériques'].some(a => oc === a))
      );
    });
    if (parOrigine.length > 0) candidats = parOrigine;
    // Si aucun film de cette origine, on garde les candidats par saison
  }

  if (candidats.length === 0) return null;

  // 3. Prioriser les incontournables et les très bien notés (score >= 90)
  const top = candidats.filter(f => f.incontournable || (f.score_consensus || 0) >= 90);
  const pool = top.length >= 3 ? top : candidats;

  // 4. Sélection déterministe
  const idx = Math.floor(rand() * pool.length);
  return pool[idx];
}

export { saisonActuelle };
