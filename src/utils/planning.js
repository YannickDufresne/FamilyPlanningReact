// ─── Logique de planification ─────────────────────────────────────────────────

// ── Mots-clés indiquant un événement INADAPTÉ à une sortie en famille ─────────
// Ces termes détectent automatiquement les événements pour adultes célibataires,
// contenus pour adultes, ou situations clairement non-familiales.
const MOTS_INADAPTES_FAMILLE = [
  'speed dating', 'speed-dating', 'speeddating', 'speedating',
  'célibataires', 'celibataires', 'célibataire', 'celibataire',
  'singles night', 'singles event', 'dating event', 'dating night',
  'rencontre adulte', 'soirée pour adultes', 'soirée adultes',
  'adults only', 'adultes seulement', 'réservé aux adultes',
  '18 ans et plus', '18+ seulement', '18+', '19+', '21+',
  'strip-tease', 'striptease', 'cabaret adulte', 'burlesque',
  'bachelorette', 'bachelor party', 'bachelorette party',
  'hen night', 'hen party', 'stag night',
  'séduction', 'hookup', 'rencontre romantique',
];

// Retourne true si l'activité est clairement inadaptée pour une sortie famille
function estInadapteFamille(activite) {
  if (activite.pourQui === 'adultes' || activite.pourQui === 'adulte') return true;
  const texte = `${activite.nom || ''} ${activite.description || ''}`.toLowerCase();
  return MOTS_INADAPTES_FAMILLE.some(m => texte.includes(m));
}

// ── Score d'affinité activité ↔ profils famille ───────────────────────────────
// Priorité 1 : scores pré-calculés par Claude (dans activites.json)
// Priorité 2 : correspondance mot-clé client-side avec pénalité pour inadaptés
function scorerActivite(activite, profils, pourQui = 'famille') {
  // Utilise les scores pré-calculés par Claude si disponibles (0-100)
  if (pourQui === 'adultes' && activite.score_adultes != null) {
    return activite.score_adultes + (activite.incontournable ? 20 : 0);
  }
  if (pourQui !== 'adultes' && activite.score_famille != null) {
    return activite.score_famille + (activite.incontournable ? 20 : 0);
  }

  // Fallback client-side : événement inadapté pour famille → score plancher négatif
  if (pourQui !== 'adultes' && estInadapteFamille(activite)) {
    return -9999; // Toujours dernier dans le classement famille
  }

  // Correspondance mot-clé avec les préférences des membres
  if (!profils || profils.length === 0) return 1; // score neutre minimal
  const texte = `${activite.nom || ''} ${activite.description || ''} ${activite.lieu || ''}`.toLowerCase();

  const membres = pourQui === 'adultes'
    ? profils.filter(p => {
        const n = new Date(p.naissance + 'T12:00:00');
        const age = new Date().getFullYear() - n.getFullYear();
        return age >= 18;
      })
    : profils;

  let score = 1; // Neutre (pas 0, pour distinguer du score de pénalité)
  for (const m of membres) {
    const mots = (m.aime || '').toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    for (const mot of mots) {
      if (mot.length >= 3 && texte.includes(mot)) score += 5;
    }
  }
  if (activite.incontournable) score += 100;
  // Bonus source : les suggestions Claude et incontournables ont déjà été filtrées
  if (activite.source === 'claude' || activite.source === 'claude_gratuites') score += 3;
  return score;
}

export const THEMES_PAR_JOUR = [
  { jour: 'Lundi',    theme: 'pasta_rapido',    emoji: '🍝' },
  { jour: 'Mardi',    theme: 'bol_nwich',        emoji: '🌮' },
  { jour: 'Mercredi', theme: 'criiions_poisson', emoji: '🐟' },
  { jour: 'Jeudi',    theme: 'plat_en_sauce',    emoji: '🍲' },
  { jour: 'Vendredi', theme: 'confort_grille',   emoji: '🔥' },
  { jour: 'Samedi',   theme: 'pizza',            emoji: '🍕' },
  { jour: 'Dimanche', theme: 'slow_chic',        emoji: '🍷' },
];

const JOURS_ENTRAINEMENT = ['Lundi', 'Mercredi', 'Vendredi'];
const SEQUENCE_ENTRAINEMENT = ['échauffement', 'musculaire', 'cardio', 'finition', 'récupération'];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pickRandom(arr, rng) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)];
}

// ── Calcule le lundi de la semaine courante ───────────────────────────────────
export function getLundiSemaine() {
  const today = new Date();
  const day = today.getDay(); // 0=dim
  const diff = day === 0 ? -6 : 1 - day;
  const lundi = new Date(today);
  lundi.setDate(today.getDate() + diff);
  lundi.setHours(12, 0, 0, 0);
  return lundi;
}

// ── Formate une date en "20 mars" ─────────────────────────────────────────────
export function formatDateCourte(date) {
  const jour = date.getDate();
  const mois = date.toLocaleDateString('fr-CA', { month: 'long' });
  return `${jour} ${mois}`;
}

function shuffleSeeded(arr, seed) {
  const rng = seededRandom(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function genererPlanning({ recettes, exercices, activites, musique, filtres, seed, semaineDebut, profils = [] }) {
  const { nbVegetarien, nbVegane, nbGratuit = 1, origine, activerCout, coutMax, activerTemps, tempsMax } = filtres;
  const filtrerOrigine = origine && origine !== 'Tous';
  const nbOmnivore = 7 - nbVegetarien - nbVegane;
  if (nbOmnivore < 0) return null;

  // Lundi de référence (depuis meta.json ou calculé)
  const lundi = semaineDebut
    ? new Date(semaineDebut + 'T12:00:00')
    : getLundiSemaine();

  // ── Musique : shuffle par origine culturelle → cohérence avec la recette ──────
  // Chaque origine a sa propre liste shufflée + un pointeur de lecture
  const originesMusique = [...new Set(musique.map(m => m.origine).filter(Boolean))];
  const musiqueParOrigine = {};
  originesMusique.forEach(orig => {
    musiqueParOrigine[orig] = shuffleSeeded(
      musique.filter(m => m.origine === orig),
      seed + orig.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    );
  });
  const musiqueIndexParOrigine = {};
  originesMusique.forEach(orig => { musiqueIndexParOrigine[orig] = 0; });
  // Fallback global si l'origine de la recette ne correspond à aucune musique
  const musiqueFallback = shuffleSeeded(musique, seed + 9999);

  // ── Activités gratuites : pré-sélectionner quels jours seront gratuits ────
  // Shuffle les 7 jours et prendre les N premiers → répartition variée chaque semaine
  const fallbackGratuitsGlobal = activites.filter(a => a.gratuit === true || (a.cout_adulte ?? a.cout ?? 0) === 0).filter(a => !a.date || a.date === '');
  const nbGratuitEffectif = Math.min(nbGratuit, 7, fallbackGratuitsGlobal.length);
  const joursShuffles = shuffleSeeded([0, 1, 2, 3, 4, 5, 6], seed + 3737);
  const joursGratuitsSet = new Set(joursShuffles.slice(0, nbGratuitEffectif));
  // Index payant cyclique par jour (pour éviter répétitions)
  const joursPayantsSeq = {};
  let payantCounter = 0;
  [0,1,2,3,4,5,6].forEach(j => {
    if (!joursGratuitsSet.has(j)) { joursPayantsSeq[j] = payantCounter++; }
  });

  let compteurOmnivore = 0;
  let compteurVegetarien = 0;
  let compteurVegane = 0;
  const planning = [];

  for (let i = 0; i < 7; i++) {
    const jourInfo = THEMES_PAR_JOUR[i];
    const themeCol = `theme_${jourInfo.theme}`;
    const rngRecette  = seededRandom(seed + i * 13);
    const rngExercice = seededRandom(seed + i * 17 + 500);
    const rngMusique  = seededRandom(seed + i * 23 + 2000);

    // Date réelle de ce jour dans la semaine
    const dateJour = new Date(lundi);
    dateJour.setDate(lundi.getDate() + i);
    const dateStr = dateJour.toISOString().split('T')[0]; // "2026-03-20"

    // ── Recettes ──────────────────────────────────────────────────────────────
    let recettesDispo = recettes.filter(r => r[themeCol] === 1);
    if (filtrerOrigine) recettesDispo = recettesDispo.filter(r => r.origine === origine);
    if (activerCout)    recettesDispo = recettesDispo.filter(r => r.cout <= coutMax);

    let regimeNecessaire = null;
    if      (compteurVegane     < nbVegane)     regimeNecessaire = 'végane';
    else if (compteurVegetarien < nbVegetarien) regimeNecessaire = 'végétarien';
    else if (compteurOmnivore   < nbOmnivore)   regimeNecessaire = 'omnivore';

    if (regimeNecessaire) {
      const avecRegime = recettesDispo.filter(r => r.regime_alimentaire === regimeNecessaire);
      if (avecRegime.length > 0) recettesDispo = avecRegime;
    }

    let recetteJour = pickRandom(recettesDispo, rngRecette);
    if (!recetteJour) {
      recetteJour = { nom: `⚠️ Manquant: ${jourInfo.theme}`, cout: 0, temps_preparation: 0, ingredients: 'Aucune recette disponible', regime_alimentaire: 'inconnu' };
    } else {
      if (recetteJour.regime_alimentaire === 'omnivore')    compteurOmnivore++;
      else if (recetteJour.regime_alimentaire === 'végétarien') compteurVegetarien++;
      else if (recetteJour.regime_alimentaire === 'végane')     compteurVegane++;
    }

    // ── Exercices ─────────────────────────────────────────────────────────────
    let exercicesJour = [];
    if (JOURS_ENTRAINEMENT.includes(jourInfo.jour)) {
      let exDispo = exercices;
      if (filtrerOrigine) exDispo = exDispo.filter(e => e.origine === origine);
      SEQUENCE_ENTRAINEMENT.forEach((fonction, fi) => {
        const rngEx = seededRandom(seed + i * 29 + fi * 7 + 300);
        const candidats = exDispo.filter(e => e.fonction === fonction);
        const choix = pickRandom(candidats, rngEx);
        if (choix) exercicesJour.push(choix);
      });
    } else {
      exercicesJour = [{ nom: '🛌 Jour de repos', duree: 0, objectif: 'récupération', fonction: 'repos' }];
    }

    // ── Activité ──────────────────────────────────────────────────────────────
    // Priorité 1 : incontournable avec date précise ce jour-là (toujours affiché)
    // Priorité 2 : événement daté régulier (Ticketmaster, etc.)
    // Priorité 3 : suggestion sans date comme fallback (quota nbGratuit respecté)
    //
    // IMPORTANT : on filtre TOUJOURS les activités inadaptées hors du pool famille
    // (speed dating, événements célibataires, etc.) — même sans scores pré-calculés.
    const activitesFamilleCompat = activites.filter(a => !estInadapteFamille(a));

    const activitesJour = activitesFamilleCompat.filter(a => a.date === dateStr);
    const incontournablesJour = activitesJour.filter(a => a.incontournable === true);
    const activitesFallback = activitesFamilleCompat.filter(a => !a.date || a.date === '');
    const fallbackGratuits = activitesFallback.filter(a => a.gratuit === true || (a.cout_adulte ?? a.cout ?? 0) === 0);
    const fallbackPayants  = activitesFallback.filter(a => !a.gratuit && (a.cout_adulte ?? a.cout ?? 0) > 0);

    // ── Construire le pool famille (toutes activités valides ce jour) ─────────
    let poolFamille = [];
    if (incontournablesJour.length > 0) {
      poolFamille = [...incontournablesJour, ...activitesJour.filter(a => !a.incontournable), ...activitesFallback];
    } else if (activitesJour.length > 0) {
      poolFamille = [...activitesJour, ...activitesFallback];
    } else if (activitesFallback.length > 0) {
      // Respecte le quota gratuit : si ce jour est désigné gratuit, les gratuits en premier
      if (joursGratuitsSet.has(i) && fallbackGratuits.length > 0) {
        poolFamille = [...fallbackGratuits, ...fallbackPayants];
      } else {
        const poolPayant = fallbackPayants.length > 0 ? fallbackPayants : activitesFallback;
        poolFamille = [...poolPayant, ...activitesFallback.filter(a => !poolPayant.includes(a))];
      }
    }

    // Score + déduplique + prend top-3 famille
    // Le jitter seeded brise les égalités de façon stable (même résultat sur tous les appareils)
    const rngJitter = seededRandom(seed + i * 41 + 8888);
    const familleSeen = new Set();
    const topFamille = poolFamille
      .filter(a => { if (familleSeen.has(a.nom)) return false; familleSeen.add(a.nom); return true; })
      .map(a => ({ ...a, _score: scorerActivite(a, profils, 'famille') + rngJitter() * 0.5 }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 3);
    const activite = topFamille[0] ?? null;

    // ── Pool adultes ──────────────────────────────────────────────────────────
    // Toutes les activités sont éligibles pour adultes (y compris les family-friendly)
    // mais les spécifiquement marquées 'adultes' sont priorisées par le score.
    const adultesExplicites = activites.filter(a =>
      a.pourQui === 'adultes' || a.pourQui === 'adulte'
    );
    const adultesExplicitesJour     = adultesExplicites.filter(a => a.date === dateStr);
    const adultesExplicitesFallback = adultesExplicites.filter(a => !a.date || a.date === '');

    let poolAdultes;
    if (adultesExplicitesJour.length > 0 || adultesExplicitesFallback.length > 0) {
      // Adultes explicites en tête, complétés par activités famille compatibles
      poolAdultes = [
        ...adultesExplicitesJour,
        ...adultesExplicitesFallback,
        ...poolFamille, // les activités famille peuvent aussi convenir aux adultes
      ];
    } else {
      poolAdultes = poolFamille; // fallback complet sur pool famille
    }

    const rngJitterA = seededRandom(seed + i * 43 + 9999);
    const adultesSeen = new Set();
    const topAdultes = poolAdultes
      .filter(a => { if (adultesSeen.has(a.nom)) return false; adultesSeen.add(a.nom); return true; })
      .map(a => ({ ...a, _score: scorerActivite(a, profils, 'adultes') + rngJitterA() * 0.5 }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 3);
    const activiteAdultes = topAdultes[0] ?? activite;

    // ── Musique : calquée sur l'origine culturelle de la recette ─────────────
    const origineRecette = recetteJour?.origine;
    let musiqueJour;
    if (origineRecette && musiqueParOrigine[origineRecette]?.length > 0) {
      const pool = musiqueParOrigine[origineRecette];
      musiqueJour = pool[musiqueIndexParOrigine[origineRecette] % pool.length];
      musiqueIndexParOrigine[origineRecette]++;
    } else {
      musiqueJour = musiqueFallback[i % musiqueFallback.length];
    }
    musiqueJour = musiqueJour || { nom: 'Musique à définir', genre: 'Variété', ambiance: 'Relaxante' };

    planning.push({
      jour: jourInfo.jour,
      date: dateStr,
      dateCourte: formatDateCourte(dateJour), // "20 mars"
      theme: jourInfo.theme,
      emoji: jourInfo.emoji,
      recette: recetteJour,
      exercices: exercicesJour,
      activite,
      activiteAdultes,
      topFamille,
      topAdultes,
      musique: musiqueJour,
    });
  }

  if (activerTemps) {
    const tempsTotal = planning.reduce((s, j) => s + (j.recette.temps_preparation || 0), 0);
    if (tempsTotal > tempsMax) return null;
  }

  return planning;
}

export function calculerStats(planning) {
  if (!planning) return null;
  const valides = planning.filter(j => !j.recette.nom.startsWith('⚠️'));
  const tempsTotal    = planning.reduce((s, j) => s + (j.recette.temps_preparation || 0), 0);
  const coutRecettes  = planning.reduce((s, j) => s + (j.recette.cout || 0), 0);
  const activitesAvec = valides.filter(j => j.activite);
  const coutActivites = activitesAvec.length > 0
    ? Math.round(activitesAvec.reduce((s, j) => s + (j.activite.cout || 0), 0) / activitesAvec.length * 10) / 10
    : 0;

  const regimes = { omnivore: 0, végétarien: 0, végane: 0 };
  valides.forEach(j => { if (regimes[j.recette.regime_alimentaire] !== undefined) regimes[j.recette.regime_alimentaire]++; });

  const evalFields = ['eval_patricia', 'eval_yannick', 'eval_joseph', 'eval_mika', 'eval_luce'];
  const evals = {};
  evalFields.forEach(f => {
    const vals = valides.map(j => j.recette[f]).filter(v => v !== undefined && v !== '' && !isNaN(v));
    evals[f] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + parseFloat(b), 0) / vals.length * 10) / 10 : null;
  });

  return { tempsTotal, coutRecettes, coutActivites, regimes, evals };
}

export function genererListeEpicerie(planning) {
  if (!planning) return [];
  const valides = planning.filter(j => !j.recette.nom.startsWith('⚠️'));
  const ingredients = new Set();
  valides.forEach(j => {
    const ing = j.recette.ingredients || '';
    ing.split(',').forEach(i => {
      const trimmed = i.trim();
      if (trimmed) ingredients.add(trimmed);
    });
  });
  return [...ingredients].sort();
}
