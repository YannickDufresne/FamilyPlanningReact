// ─── Logique de planification ─────────────────────────────────────────────────

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

export function genererPlanning({ recettes, exercices, activites, musique, filtres, seed, semaineDebut }) {
  const { nbVegetarien, nbVegane, activerOrigine, origine, activerCout, coutMax, activerTemps, tempsMax } = filtres;
  const nbOmnivore = 7 - nbVegetarien - nbVegane;
  if (nbOmnivore < 0) return null;

  // Lundi de référence (depuis meta.json ou calculé)
  const lundi = semaineDebut
    ? new Date(semaineDebut + 'T12:00:00')
    : getLundiSemaine();

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
    if (activerOrigine && origine) recettesDispo = recettesDispo.filter(r => r.origine === origine);
    if (activerCout)               recettesDispo = recettesDispo.filter(r => r.cout <= coutMax);

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
      if (activerOrigine && origine) exDispo = exDispo.filter(e => e.origine === origine);
      SEQUENCE_ENTRAINEMENT.forEach((fonction, fi) => {
        const rngEx = seededRandom(seed + i * 29 + fi * 7 + 300);
        const candidats = exDispo.filter(e => e.fonction === fonction);
        const choix = pickRandom(candidats, rngEx);
        if (choix) exercicesJour.push(choix);
      });
    } else {
      exercicesJour = [{ nom: '🛌 Jour de repos', duree: 0, objectif: 'récupération', fonction: 'repos' }];
    }

    // ── Activité — uniquement si un événement est prévu ce jour précis ────────
    const activitesJour = activites.filter(a => a.date === dateStr);
    const activite = activitesJour.length > 0
      ? pickRandom(activitesJour, rngRecette) // rng stable
      : null; // Aucun événement ce jour

    // ── Musique ───────────────────────────────────────────────────────────────
    let musiqueDispo = musique;
    if (activerOrigine && origine) musiqueDispo = musiqueDispo.filter(m => m.origine === origine);
    const musiqueJour = pickRandom(musiqueDispo.length > 0 ? musiqueDispo : musique, rngMusique)
      || { nom: 'Musique à définir', genre: 'Variété', ambiance: 'Relaxante' };

    planning.push({
      jour: jourInfo.jour,
      date: dateStr,
      dateCourte: formatDateCourte(dateJour), // "20 mars"
      theme: jourInfo.theme,
      emoji: jourInfo.emoji,
      recette: recetteJour,
      exercices: exercicesJour,
      activite, // null si aucun événement
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
