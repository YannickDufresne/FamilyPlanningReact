import { useState, useMemo, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import WeeklyPlanning from './components/WeeklyPlanning';
import GroceryList from './components/GroceryList';
import EpiceriePage from './components/EpiceriePage';
import RecettesPage from './components/RecettesPage';
import ActivitesPage from './components/ActivitesPage';
import UpdateModal from './components/UpdateModal';
import LoginScreen from './components/LoginScreen';
import ProfilsModal from './components/ProfilsModal';
import MethodologieModal from './components/MethodologieModal';
import ModalOptimisationIA from './components/ModalOptimisationIA';
import FamilleActualites from './components/FamilleActualites';
import FooterMontcalm from './components/FooterMontcalm';
import { genererPlanning, calculerStats } from './utils/planning';
import { syncWrite, syncRead, syncSubscribe, uploadPhoto, deletePhoto } from './utils/sync';
import recettes from './data/recettes.json';
import exercices from './data/exercices.json';
import activites from './data/activites.json';
import musique from './data/musique.json';
import familleDefaut from './data/famille.json';
import meta from './data/meta.json';
import './App.css';

const HASH = 'UEBtcGxlbW91c3NlMjAxMiE=';
const HISTORIQUE_STORE = 'planning_historique';
const MAX_HISTORIQUE   = 8; // semaines conservées
const SEMAINES_AVANCE  = 2; // combien de semaines futures accessibles

function lundiISO(dateStr, deltaJours) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + deltaJours);
  return d.toISOString().split('T')[0];
}
function formatSemaineNav(lundiStr) {
  const lundi   = new Date(lundiStr + 'T12:00:00');
  const dimanche = new Date(lundiStr + 'T12:00:00');
  dimanche.setDate(lundi.getDate() + 6);
  const fL = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' }).format(lundi);
  const fD = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }).format(dimanche);
  return `${fL} – ${fD}`;
}
function seedForWeek(lundiStr) {
  let h = 5381;
  for (const c of lundiStr) h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
  return (h % 2147483646) + 1;
}
function locksKey(semaine)        { return `planning_locks_${semaine}`; }
function semaineLockKey(semaine)  { return `semaine_lockee_${semaine}`; }
function forceesKey(semaine)      { return `fp_forcees_${semaine}`; }
function expliciteKey(semaine)    { return `fp_explicites_${semaine}`; }
function semaineTimestampKey(s)   { return `fp_ts_${s}`; }

const DEFAULT_FILTRES = {
  nbVegetarien: 1,
  nbVegane: 0,
  nbGratuit: 1,
  nbClassiques: 0,
  origine: 'Tous',
  activerCout: false,
  coutMax: 6,
  activerTemps: false,
  tempsMax: 200,
};

export default function App() {
  const [authentifie, setAuthentifie] = useState(
    () => localStorage.getItem('fp_auth') === HASH
  );
  const [filtres, setFiltres] = useState(DEFAULT_FILTRES);
  // Seed aléatoire à chaque rechargement → plannings différents à chaque visite.
  // Les jours verrouillés persistent via recettesForcees (localStorage), pas via le seed.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [view, setView]           = useState('planning');
  const [semaineVue, setSemaineVue] = useState(meta.semaine.debut);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showProfilsModal, setShowProfilsModal] = useState(false);
  const [showMethodologieModal, setShowMethodologieModal] = useState(false);
  const [showOptimisationIA, setShowOptimisationIA] = useState(false);
  const [syncLoaded, setSyncLoaded] = useState(false);
  const [profils, setProfils] = useState(() => {
    try {
      const saved = localStorage.getItem('fp_profils');
      if (saved) return JSON.parse(saved);
    } catch {}
    return familleDefaut;
  });
  const [photoFamille, setPhotoFamille] = useState(
    () => localStorage.getItem('fp_photo_famille') || null
  );

  // ── Agenda familial (obligations récurrentes + événements ponctuels) ──────────
  const [agenda, setAgenda] = useState(() => {
    try {
      const saved = localStorage.getItem('fp_agenda');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Pré-remplir avec les obligations connues de la famille
    return {
      obligations: [
        { id: 'oblig-patricia-1', membre: 'Patricia', emoji: '💚', titre: 'Euphonium — Harmonie', jourSemaine: 0, heureDebut: '19:00', heureFin: '21:00' },
        { id: 'oblig-yannick-1', membre: 'Yannick', emoji: '🦉', titre: 'Enseignement — Université', jourSemaine: 1, heureDebut: '15:30', heureFin: '18:30' },
      ],
      evenements: [],
    };
  });

  function saveAgenda(nouvelAgenda) {
    setAgenda(nouvelAgenda);
    localStorage.setItem('fp_agenda', JSON.stringify(nouvelAgenda));
  }

  // ── État par semaine (rechargé à chaque navigation) ───────────────────────
  const [joursVerrouilles, setJoursVerrouilles] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(locksKey(meta.semaine.debut)) || '[]')); }
    catch { return new Set(); }
  });
  const [semaineLockee, setSemaineLockee] = useState(
    () => localStorage.getItem(semaineLockKey(meta.semaine.debut)) === 'true'
  );
  const [recettesForcees, setRecettesForcees] = useState(() => {
    try {
      const s = localStorage.getItem(forceesKey(meta.semaine.debut));
      return s ? new Map(JSON.parse(s)) : new Map();
    } catch { return new Map(); }
  });
  // Indices des jours où l'utilisateur a explicitement choisi une recette (≠ juste verrouillé)
  const [recettesExplicites, setRecettesExplicites] = useState(() => {
    try {
      const s = localStorage.getItem(expliciteKey(meta.semaine.debut));
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch { return new Set(); }
  });

  // Recettes personnalisées (sauvegardées via IA ou manuellement)
  const [recettesCustom, setRecettesCustom] = useState(() => {
    try {
      const s = localStorage.getItem('recettes_custom_v1');
      return s ? JSON.parse(s) : { ajoutees: [], modifiees: {} };
    } catch { return { ajoutees: [], modifiees: {} }; }
  });

  const staticNoms = useMemo(() => new Set(recettes.map(r => r.nom)), []);

  const toutesRecettes = useMemo(() => {
    // Exclure les recettes custom dont le nom existe déjà dans les recettes statiques
    // (la version statique a toujours les champs image_url / image_aquarelle)
    const ajouteesNouvelles = (recettesCustom.ajoutees || []).filter(r => !staticNoms.has(r.nom));
    return [...recettes, ...ajouteesNouvelles];
  }, [recettesCustom, staticNoms]);

  function sauvegarderRecetteCustom(recette) {
    setRecettesCustom(prev => {
      // Éviter les doublons : ni dans les recettes custom déjà sauvegardées, ni dans les recettes statiques
      if (prev.ajoutees.some(r => r.nom === recette.nom)) return prev;
      if (staticNoms.has(recette.nom)) return prev; // La recette statique existe déjà avec ses images
      const next = { ...prev, ajoutees: [...prev.ajoutees, recette] };
      localStorage.setItem('recettes_custom_v1', JSON.stringify(next));
      syncWrite({ recettesCustom: next });
      return next;
    });
  }

  // Ingrédients à inclure (globaux, pas par semaine)
  const [ingredientsForces, setIngredientsForces] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fp_ingredients_forces') || '[]'); }
    catch { return []; }
  });

  function addIngredientForce(ing) {
    setIngredientsForces(prev => {
      if (prev.includes(ing)) return prev;
      const next = [...prev, ing];
      localStorage.setItem('fp_ingredients_forces', JSON.stringify(next));
      return next;
    });
  }

  function removeIngredientForce(ing) {
    setIngredientsForces(prev => {
      const next = prev.filter(f => f !== ing);
      localStorage.setItem('fp_ingredients_forces', JSON.stringify(next));
      return next;
    });
  }

  // ── Classiques familiaux (recettes marquées ⭐ par la famille) ────────────
  const [classiques, setClassiques] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('fp_classiques') || '[]')); }
    catch { return new Set(); }
  });

  function toggleClassique(nomRecette) {
    setClassiques(prev => {
      const next = new Set(prev);
      if (next.has(nomRecette)) next.delete(nomRecette);
      else next.add(nomRecette);
      localStorage.setItem('fp_classiques', JSON.stringify([...next]));
      return next;
    });
  }

  // ── Cloud sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authentifie) return;

    // Initial load from Firestore
    syncRead().then(data => {
      if (data) {
        if (data.profils) {
          setProfils(data.profils);
          localStorage.setItem('fp_profils', JSON.stringify(data.profils));
        }
        if (data.photo !== undefined) {
          const photoVal = data.photo || null;
          setPhotoFamille(photoVal);
          // Only cache in localStorage if it's a base64 (not a Storage URL)
          if (photoVal && !photoVal.startsWith('https://')) {
            localStorage.setItem('fp_photo_famille', photoVal);
          } else if (!photoVal) {
            localStorage.removeItem('fp_photo_famille');
          }
        }
        if (data.togetherKey) {
          localStorage.setItem('together_key', data.togetherKey);
        }
        if (data.githubToken) {
          localStorage.setItem('github_token', data.githubToken);
        }
        if (data.recettesCustom !== undefined) {
          // Merge: Firestore is the source of truth for custom recipes
          localStorage.setItem('recettes_custom_v1', JSON.stringify(data.recettesCustom));
          setRecettesCustom(data.recettesCustom);
        }
        // Load per-week data for all semaines in cloud
        // Guard: ne pas écraser localStorage si les données locales sont plus récentes
        if (data.semaines) {
          Object.entries(data.semaines).forEach(([semaine, val]) => {
            const localTs = parseInt(localStorage.getItem(semaineTimestampKey(semaine)) || '0');
            const cloudTs = val.updatedAt || 0;
            if (cloudTs >= localTs) {
              // Cloud aussi récent ou plus récent → on l'utilise
              if (val.locks !== undefined) localStorage.setItem(`planning_locks_${semaine}`, JSON.stringify(val.locks));
              if (val.semaineLockee !== undefined) localStorage.setItem(`semaine_lockee_${semaine}`, val.semaineLockee ? 'true' : 'false');
              if (val.forcees !== undefined) localStorage.setItem(`fp_forcees_${semaine}`, JSON.stringify(val.forcees));
            }
            // else: local plus récent → on garde localStorage intact
          });
          // Recharger l'état de la semaine courante depuis localStorage (potentiellement mis à jour)
          const sv = semaineVue; // capture current value
          try { setJoursVerrouilles(new Set(JSON.parse(localStorage.getItem(`planning_locks_${sv}`) || '[]'))); } catch {}
          setSemaineLockee(localStorage.getItem(`semaine_lockee_${sv}`) === 'true');
          try {
            const s = localStorage.getItem(`fp_forcees_${sv}`);
            setRecettesForcees(s ? new Map(JSON.parse(s)) : new Map());
          } catch {}
        }
      }
      setSyncLoaded(true);
    });

    // Real-time subscription
    const unsub = syncSubscribe(data => {
      if (data.profils) {
        setProfils(data.profils);
        localStorage.setItem('fp_profils', JSON.stringify(data.profils));
      }
      if (data.photo !== undefined) {
        const photoVal = data.photo || null;
        setPhotoFamille(photoVal);
        if (photoVal && !photoVal.startsWith('https://')) {
          localStorage.setItem('fp_photo_famille', photoVal);
        } else if (!photoVal) {
          localStorage.removeItem('fp_photo_famille');
        }
      }
      if (data.togetherKey) {
        localStorage.setItem('together_key', data.togetherKey);
      }
      if (data.githubToken) {
        localStorage.setItem('github_token', data.githubToken);
      }
      if (data.recettesCustom !== undefined) {
        localStorage.setItem('recettes_custom_v1', JSON.stringify(data.recettesCustom));
      }
      if (data.semaines) {
        Object.entries(data.semaines).forEach(([semaine, val]) => {
          if (val.locks !== undefined) localStorage.setItem(`planning_locks_${semaine}`, JSON.stringify(val.locks));
          if (val.semaineLockee !== undefined) localStorage.setItem(`semaine_lockee_${semaine}`, val.semaineLockee ? 'true' : 'false');
          if (val.forcees !== undefined) localStorage.setItem(`fp_forcees_${semaine}`, JSON.stringify(val.forcees));
        });
      }
    });

    return () => unsub();
  }, [authentifie]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recharger l'état quand on change de semaine
  useEffect(() => {
    try {
      setJoursVerrouilles(new Set(JSON.parse(localStorage.getItem(locksKey(semaineVue)) || '[]')));
    } catch { setJoursVerrouilles(new Set()); }
    setSemaineLockee(localStorage.getItem(semaineLockKey(semaineVue)) === 'true');
    try {
      const s = localStorage.getItem(forceesKey(semaineVue));
      setRecettesForcees(s ? new Map(JSON.parse(s)) : new Map());
    } catch { setRecettesForcees(new Map()); }
  }, [semaineVue]);

  if (!authentifie) {
    return <LoginScreen onSuccess={() => setAuthentifie(true)} />;
  }

  // ── Type de semaine ───────────────────────────────────────────────────────
  // Semaine réelle contenant aujourd'hui (basée sur la date du navigateur, pas meta.json)
  // Cas typique : le script hebdo tourne vendredi soir → meta passe à la semaine suivante
  // mais samedi/dimanche appartiennent encore à la semaine courante du calendrier.
  const semaineContenantAujourdhui = useMemo(() => {
    const auj = new Date();
    const jour = auj.getDay(); // 0=dim, 1=lun, ...
    const diff = jour === 0 ? -6 : 1 - jour; // reculer jusqu'au lundi
    const lundi = new Date(auj);
    lundi.setDate(auj.getDate() + diff);
    return lundi.toISOString().split('T')[0];
  }, []);

  const estSemaineActuelle        = semaineVue === meta.semaine.debut;
  const estSemaineContenantAujourd = semaineVue === semaineContenantAujourdhui;
  const estSemaineAVenir          = semaineVue > meta.semaine.debut;
  // Éditable = semaine qui contient aujourd'hui, semaine meta courante, ou semaines futures
  const estSemaineEditable        = semaineVue >= semaineContenantAujourdhui;

  // ── Jours passés auto-verrouillés (avant aujourd'hui) ────────────────────
  const joursAutoVerrouilles = useMemo(() => {
    // Appliquer uniquement pour la semaine qui contient aujourd'hui (pas les semaines futures)
    if (!estSemaineContenantAujourd && !estSemaineActuelle) return new Set();
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const lundi = new Date(semaineVue + 'T12:00:00');
    const auto = new Set();
    for (let i = 0; i < 7; i++) {
      const d = new Date(lundi); d.setDate(lundi.getDate() + i);
      if (d < auj) auto.add(i);
    }
    return auto;
  }, [estSemaineContenantAujourd, estSemaineActuelle, semaineVue]);

  // Fusion verrous utilisateur + verrous automatiques des jours passés
  const tousJoursVerrouilles = useMemo(
    () => new Set([...joursVerrouilles, ...joursAutoVerrouilles]),
    [joursVerrouilles, joursAutoVerrouilles]
  );

  // ── Planning semaine actuelle (avec seed rebrassable) ─────────────────────
  const planningRef = useRef(null);
  const planning = useMemo(() => {
    const result = genererPlanning({
      recettes: toutesRecettes, exercices, activites, musique, filtres, seed,
      semaineDebut: meta.semaine.debut,
      profils,
      joursVerrouilles: estSemaineActuelle ? tousJoursVerrouilles : new Set(),
      planningActuel: planningRef.current,
      recettesForcees: estSemaineActuelle ? recettesForcees : new Map(),
      ingredientsForces,
      classiques,
    });
    planningRef.current = result;
    return result;
  }, [filtres, seed, profils, tousJoursVerrouilles, estSemaineActuelle, recettesForcees, ingredientsForces, classiques]);

  // ── Planning semaines à venir (déterministe par date) ─────────────────────
  const planningFutur = useMemo(() => {
    if (!estSemaineAVenir) return null;
    return genererPlanning({
      recettes: toutesRecettes, exercices, activites, musique,
      filtres,
      seed: seedForWeek(semaineVue),
      semaineDebut: semaineVue,
      profils,
      joursVerrouilles: tousJoursVerrouilles,
      recettesForcees,
      ingredientsForces,
      classiques,
    });
  }, [estSemaineAVenir, semaineVue, filtres, profils, tousJoursVerrouilles, recettesForcees, ingredientsForces, classiques]);

  // ── Planning semaine calendrier courante quand meta a avancé (sam/dim) ────
  const planningContenantAujourdhui = useMemo(() => {
    if (!estSemaineContenantAujourd || estSemaineActuelle) return null;
    return genererPlanning({
      recettes: toutesRecettes, exercices, activites, musique,
      filtres,
      seed: seedForWeek(semaineContenantAujourdhui),
      semaineDebut: semaineContenantAujourdhui,
      profils,
      joursVerrouilles: tousJoursVerrouilles,
      recettesForcees,
      ingredientsForces,
      classiques,
    });
  }, [estSemaineContenantAujourd, estSemaineActuelle, semaineContenantAujourdhui, filtres, profils, tousJoursVerrouilles, recettesForcees, ingredientsForces, classiques]);

  // ── Historique ───────────────────────────────────────────────────────────────
  // Sauvegarde automatique du planning courant
  useEffect(() => {
    if (!planning || planning.length === 0) return;
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORIQUE_STORE) || '{}');
      stored[meta.semaine.debut] = { planning, savedAt: new Date().toISOString() };
      const keys    = Object.keys(stored).sort().reverse().slice(0, MAX_HISTORIQUE);
      const trimmed = Object.fromEntries(keys.map(k => [k, stored[k]]));
      localStorage.setItem(HISTORIQUE_STORE, JSON.stringify(trimmed));
    } catch (e) { console.warn('Historique planning:', e); }
  }, [planning]);

  const historique = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(HISTORIQUE_STORE) || '{}'); }
    catch { return {}; }
  }, []);

  // ── Auto-sauvegarde des recettes des jours passés ─────────────────────────
  // Assure que les jours passés ont une recette forcée sauvegardée (stable sur rechargement)
  useEffect(() => {
    if (joursAutoVerrouilles.size === 0) return;
    const p = estSemaineActuelle ? planning : planningContenantAujourdhui;
    if (!p?.length) return;
    let updated = false;
    const newForcees = new Map(recettesForcees);
    joursAutoVerrouilles.forEach(i => {
      if (!newForcees.has(i)) {
        const nom = p[i]?.recette?.nom;
        if (nom && !nom.startsWith('⚠️')) { newForcees.set(i, nom); updated = true; }
      }
    });
    if (updated) {
      setRecettesForcees(newForcees);
      localStorage.setItem(forceesKey(semaineVue), JSON.stringify([...newForcees]));
      syncSemaine(semaineVue, { forcees: [...newForcees] });
    }
  }, [joursAutoVerrouilles, planning]); // eslint-disable-line

  // ── Planning affiché selon la semaine sélectionnée ────────────────────────
  const planningVue = estSemaineActuelle
    ? planning
    : planningContenantAujourdhui   // sam/dim : meta avancé mais semaine courante éditable
      ? planningContenantAujourdhui
      : estSemaineAVenir
        ? (planningFutur || [])
        : (historique[semaineVue]?.planning || []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const semainePrecedente = lundiISO(semaineVue, -7);
  const semaineSuivante   = lundiISO(semaineVue, +7);
  const limiteAvance      = lundiISO(meta.semaine.debut, SEMAINES_AVANCE * 7);
  // Peut reculer si l'historique existe OU si c'est la semaine contenant aujourd'hui
  const peutReculer       = !!historique[semainePrecedente] || semainePrecedente === semaineContenantAujourdhui;
  const peutAvancer       = semaineVue < limiteAvance;

  const stats = useMemo(() => calculerStats(planningVue), [planningVue]);

  // ── Sync helper ───────────────────────────────────────────────────────────
  function syncSemaine(semaine, updates) {
    // Horodater la modification locale pour que syncRead sache quelle source est la plus récente
    const ts = Date.now();
    localStorage.setItem(semaineTimestampKey(semaine), ts.toString());
    const firestoreUpdates = { [`semaines.${semaine}.updatedAt`]: ts };
    Object.entries(updates).forEach(([k, v]) => {
      firestoreUpdates[`semaines.${semaine}.${k}`] = v;
    });
    syncWrite(firestoreUpdates);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleLockJour(i) {
    if (semaineLockee || !estSemaineEditable || joursAutoVerrouilles.has(i)) return;
    setJoursVerrouilles(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        // Déverrouiller : retirer aussi la recette forcée et l'explicite
        next.delete(i);
        setRecettesForcees(prevF => {
          const nextF = new Map(prevF);
          nextF.delete(i);
          localStorage.setItem(forceesKey(semaineVue), JSON.stringify([...nextF]));
          syncSemaine(semaineVue, { forcees: [...nextF] });
          return nextF;
        });
        setRecettesExplicites(prevE => {
          const nextE = new Set(prevE);
          nextE.delete(i);
          localStorage.setItem(expliciteKey(semaineVue), JSON.stringify([...nextE]));
          return nextE;
        });
      } else {
        // Verrouiller : sauvegarder la recette courante pour qu'elle survive au rechargement
        next.add(i);
        const recetteActuelle = planningVue[i]?.recette?.nom;
        if (recetteActuelle && !recetteActuelle.startsWith('⚠️')) {
          setRecettesForcees(prevF => {
            const nextF = new Map(prevF);
            nextF.set(i, recetteActuelle);
            localStorage.setItem(forceesKey(semaineVue), JSON.stringify([...nextF]));
            syncSemaine(semaineVue, { forcees: [...nextF] });
            return nextF;
          });
        }
      }
      localStorage.setItem(locksKey(semaineVue), JSON.stringify([...next]));
      syncSemaine(semaineVue, { locks: [...next] });
      return next;
    });
  }

  function lockerSemaine() {
    // Sauvegarder toutes les recettes courantes avant de verrouiller
    const toutesLesRecettes = new Map();
    planningVue.forEach((jour, i) => {
      const nom = jour?.recette?.nom;
      if (nom && !nom.startsWith('⚠️')) toutesLesRecettes.set(i, nom);
    });
    setRecettesForcees(toutesLesRecettes);
    localStorage.setItem(forceesKey(semaineVue), JSON.stringify([...toutesLesRecettes]));

    setSemaineLockee(true);
    localStorage.setItem(semaineLockKey(semaineVue), 'true');
    const tous = new Set([0,1,2,3,4,5,6]);
    setJoursVerrouilles(tous);
    localStorage.setItem(locksKey(semaineVue), JSON.stringify([0,1,2,3,4,5,6]));
    syncSemaine(semaineVue, {
      locks: [0,1,2,3,4,5,6],
      semaineLockee: true,
      forcees: [...toutesLesRecettes],
    });
  }

  function delockerSemaine() {
    setSemaineLockee(false);
    localStorage.removeItem(semaineLockKey(semaineVue));
    setJoursVerrouilles(new Set());
    localStorage.removeItem(locksKey(semaineVue));
    setRecettesForcees(new Map());
    localStorage.removeItem(forceesKey(semaineVue));
    syncSemaine(semaineVue, {
      locks: [],
      semaineLockee: false,
      forcees: [],
    });
  }

  function choisirRecette(dayIndex, recetteNom) {
    setRecettesForcees(prev => {
      const next = new Map(prev);
      if (recetteNom) {
        next.set(dayIndex, recetteNom);
      } else {
        next.delete(dayIndex);
      }
      localStorage.setItem(forceesKey(semaineVue), JSON.stringify([...next]));
      syncSemaine(semaineVue, { forcees: [...next] });
      return next;
    });
    // Marquer comme choix explicite (badge "Choix manuel")
    setRecettesExplicites(prev => {
      const next = new Set(prev);
      if (recetteNom) next.add(dayIndex);
      else next.delete(dayIndex);
      localStorage.setItem(expliciteKey(semaineVue), JSON.stringify([...next]));
      return next;
    });
  }

  // ── Générer semaine précédente dans l'historique si absente ──────────────
  useEffect(() => {
    const lundiPrecedent = lundiISO(meta.semaine.debut, -7);
    const stored = JSON.parse(localStorage.getItem(HISTORIQUE_STORE) || '{}');
    if (stored[lundiPrecedent]) return;
    const planningPrev = genererPlanning({
      recettes, exercices, activites, musique, filtres: DEFAULT_FILTRES,
      seed: seedForWeek(lundiPrecedent), semaineDebut: lundiPrecedent, profils,
    });
    if (planningPrev) {
      stored[lundiPrecedent] = { planning: planningPrev, savedAt: new Date().toISOString() };
      localStorage.setItem(HISTORIQUE_STORE, JSON.stringify(stored));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Badge statut semaine ──────────────────────────────────────────────────
  const statusClass = (estSemaineActuelle || estSemaineContenantAujourd)
    ? 'semaine-nav__status--active'
    : estSemaineAVenir
      ? 'semaine-nav__status--future'
      : 'semaine-nav__status--readonly';
  const statusLabel = (estSemaineActuelle || estSemaineContenantAujourd)
    ? '📅 Semaine en cours'
    : estSemaineAVenir
      ? '🔮 Planification à venir'
      : '📖 Lecture seule';

  return (
    <div className="app">
      <Header
        onViewRecettes={() => setView('recettes')}
        onViewActivites={() => setView('activites')}
        onViewEpicerie={() => setView('epicerie')}
        onViewUpdate={() => setShowUpdateModal(true)}
        onViewProfils={() => setShowProfilsModal(true)}
        onViewMethode={() => setShowMethodologieModal(true)}
        photoUrl={photoFamille}
        activeView={view}
      />
      {view === 'recettes' ? (
        <RecettesPage onRetour={() => setView('planning')} />
      ) : view === 'activites' ? (
        <ActivitesPage onRetour={() => setView('planning')} semaine={meta.semaine} profils={profils} />
      ) : view === 'epicerie' ? (
        <EpiceriePage
          planning={planningVue}
          joursChoisis={joursVerrouilles}
          ingredientsForces={ingredientsForces}
          onAddIngredientForce={addIngredientForce}
          onRemoveIngredientForce={removeIngredientForce}
          onRetour={() => setView('planning')}
        />
      ) : (
        <div className="layout">
          <Sidebar
            filtres={filtres}
            setFiltres={setFiltres}
            onRebrasser={estSemaineActuelle && !semaineLockee ? () => setSeed(Math.floor(Math.random() * 1e9)) : null}
            onLockerSemaine={estSemaineEditable && !semaineLockee ? lockerSemaine : null}
            onDelockerSemaine={semaineLockee ? delockerSemaine : null}
            semaineLockee={semaineLockee}
            stats={stats}
            lectureSeule={!estSemaineEditable}
            ingredientsForces={ingredientsForces}
            onAddIngredientForce={addIngredientForce}
            onRemoveIngredientForce={removeIngredientForce}
            joursChoisis={joursVerrouilles}
            onOptimiserIA={estSemaineEditable && !semaineLockee ? () => setShowOptimisationIA(true) : null}
            joursDisponibles={estSemaineEditable ? Math.max(0, 7 - tousJoursVerrouilles.size) : 7}
          />
          <main className="main-content">
            {/* Navigation entre semaines */}
            <div className="semaine-nav">
              <button
                className="semaine-nav__btn"
                onClick={() => peutReculer && setSemaineVue(semainePrecedente)}
                disabled={!peutReculer}
                title="Semaine précédente"
              >← Préc.</button>
              <span className="semaine-nav__label">
                {formatSemaineNav(semaineVue)}
                {!estSemaineActuelle && (
                  <button className="semaine-nav__retour" onClick={() => setSemaineVue(meta.semaine.debut)}>
                    Semaine actuelle
                  </button>
                )}
              </span>
              <span className={`semaine-nav__status ${statusClass}`}>
                {statusLabel}
              </span>
              <button
                className="semaine-nav__btn"
                onClick={() => peutAvancer && setSemaineVue(semaineSuivante)}
                disabled={!peutAvancer}
                title="Semaine suivante"
              >Suiv. →</button>
            </div>
            <FamilleActualites
              profils={profils}
              semaineVue={semaineVue}
              agenda={agenda}
            />
            <WeeklyPlanning
              planning={planningVue}
              profils={profils}
              joursVerrouilles={estSemaineEditable ? tousJoursVerrouilles : new Set()}
              joursAutoVerrouilles={estSemaineActuelle ? joursAutoVerrouilles : new Set()}
              onToggleLockJour={estSemaineEditable ? toggleLockJour : null}
              lectureSeule={!estSemaineEditable || semaineLockee}
              recettes={toutesRecettes}
              filtres={filtres}
              recettesForcees={estSemaineEditable ? recettesForcees : new Map()}
              recettesExplicites={estSemaineEditable ? recettesExplicites : new Set()}
              onChoisirRecette={estSemaineEditable && !semaineLockee ? choisirRecette : null}
              ingredientsForces={ingredientsForces}
              onSauvegarderRecette={sauvegarderRecetteCustom}
              classiques={classiques}
              onToggleClassique={toggleClassique}
            />
          </main>
        </div>
      )}

      {/* ── Signature du condo ── */}
      {view === 'planning' && <FooterMontcalm semaineVue={semaineVue} />}
      {showMethodologieModal && <MethodologieModal onClose={() => setShowMethodologieModal(false)} />}
      {showOptimisationIA && (
        <ModalOptimisationIA
          planning={planningVue}
          toutesRecettes={toutesRecettes}
          obligations={agenda.obligations || []}
          onAppliquer={(dayIndex, recetteName) => { choisirRecette(dayIndex, recetteName); }}
          onClose={() => setShowOptimisationIA(false)}
        />
      )}
      {showUpdateModal && <UpdateModal onClose={() => setShowUpdateModal(false)} />}
      {showProfilsModal && (
        <ProfilsModal
          profils={profils}
          agenda={agenda}
          onSaveAgenda={saveAgenda}
          onSave={(nouveauxProfils) => {
            setProfils(nouveauxProfils);
            localStorage.setItem('fp_profils', JSON.stringify(nouveauxProfils));
            syncWrite({ profils: nouveauxProfils });
            setShowProfilsModal(false);
          }}
          onClose={() => setShowProfilsModal(false)}
          photoUrl={photoFamille}
          onPhotoChange={(dataUrl) => {
            if (dataUrl) {
              localStorage.setItem('fp_photo_famille', dataUrl);
              setPhotoFamille(dataUrl);
              // Upload to Storage and save URL in Firestore
              uploadPhoto(dataUrl).then(url => {
                if (url) syncWrite({ photo: url });
              });
            } else {
              localStorage.removeItem('fp_photo_famille');
              setPhotoFamille(null);
              deletePhoto();
              syncWrite({ photo: null });
            }
          }}
        />
      )}
    </div>
  );
}
