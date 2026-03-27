import { useState, useMemo, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import WeeklyPlanning from './components/WeeklyPlanning';
import GroceryList from './components/GroceryList';
import RecettesPage from './components/RecettesPage';
import ActivitesPage from './components/ActivitesPage';
import UpdateModal from './components/UpdateModal';
import LoginScreen from './components/LoginScreen';
import ProfilsModal from './components/ProfilsModal';
import { genererPlanning, calculerStats } from './utils/planning';
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

const LOCKS_STORE       = `planning_locks_${meta.semaine.debut}`;
const SEMAINE_LOCK_STORE = `semaine_lockee_${meta.semaine.debut}`;

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

const DEFAULT_FILTRES = {
  nbVegetarien: 2,
  nbVegane: 1,
  nbGratuit: 1,
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
  const [seed, setSeed] = useState(() => {
    // Seed dérivé de la date du lundi → plannings différents chaque semaine,
    // identiques sur tous les appareils. Rebrassage = seed aléatoire.
    const debut = meta.semaine.debut; // ex. "2026-03-23"
    let h = 5381;
    for (const c of debut) h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
    return (h % 2147483646) + 1;
  });
  const [view, setView]           = useState('planning');
  const [semaineVue, setSemaineVue] = useState(meta.semaine.debut);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showProfilsModal, setShowProfilsModal] = useState(false);
  const [profils, setProfils] = useState(() => {
    try {
      const saved = localStorage.getItem('fp_profils');
      if (saved) return JSON.parse(saved);
    } catch {}
    return familleDefaut;
  });

  const [joursVerrouilles, setJoursVerrouilles] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LOCKS_STORE) || '[]')); }
    catch { return new Set(); }
  });
  const [semaineLockee, setSemaineLockee] = useState(
    () => localStorage.getItem(SEMAINE_LOCK_STORE) === 'true'
  );

  if (!authentifie) {
    return <LoginScreen onSuccess={() => setAuthentifie(true)} />;
  }

  const estSemaineActuelle = semaineVue === meta.semaine.debut;

  const planningRef = useRef(null);
  const planning = useMemo(() => {
    const result = genererPlanning({
      recettes, exercices, activites, musique, filtres, seed,
      semaineDebut: meta.semaine.debut,
      profils,
      joursVerrouilles: estSemaineActuelle ? joursVerrouilles : new Set(),
      planningActuel: planningRef.current,
    });
    planningRef.current = result;
    return result;
  }, [filtres, seed, profils, joursVerrouilles, estSemaineActuelle]);

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

  const planningVue        = estSemaineActuelle ? planning : (historique[semaineVue]?.planning || []);
  const semainePrecedente  = lundiISO(semaineVue, -7);
  const semaineSuivante    = lundiISO(semaineVue, +7);
  const peutReculer        = !!historique[semainePrecedente];
  const peutAvancer        = semaineVue < meta.semaine.debut;

  const stats = useMemo(() => calculerStats(planningVue), [planningVue]);

  function toggleLockJour(i) {
    if (semaineLockee || !estSemaineActuelle) return;
    setJoursVerrouilles(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      localStorage.setItem(LOCKS_STORE, JSON.stringify([...next]));
      return next;
    });
  }

  function lockerSemaine() {
    setSemaineLockee(true);
    localStorage.setItem(SEMAINE_LOCK_STORE, 'true');
    const tous = new Set([0,1,2,3,4,5,6]);
    setJoursVerrouilles(tous);
    localStorage.setItem(LOCKS_STORE, JSON.stringify([0,1,2,3,4,5,6]));
  }

  function delockerSemaine() {
    setSemaineLockee(false);
    localStorage.removeItem(SEMAINE_LOCK_STORE);
    setJoursVerrouilles(new Set());
    localStorage.removeItem(LOCKS_STORE);
  }

  useEffect(() => {
    const lundiPrecedent = lundiISO(meta.semaine.debut, -7);
    const stored = JSON.parse(localStorage.getItem(HISTORIQUE_STORE) || '{}');
    if (stored[lundiPrecedent]) return; // already exists
    // Compute seed for previous week
    let h = 5381;
    for (const c of lundiPrecedent) h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
    const seedPrev = (h % 2147483646) + 1;
    const planningPrev = genererPlanning({
      recettes, exercices, activites, musique, filtres: DEFAULT_FILTRES,
      seed: seedPrev, semaineDebut: lundiPrecedent, profils,
    });
    if (planningPrev) {
      stored[lundiPrecedent] = { planning: planningPrev, savedAt: new Date().toISOString() };
      localStorage.setItem(HISTORIQUE_STORE, JSON.stringify(stored));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Header
        onViewRecettes={() => setView('recettes')}
        onViewActivites={() => setView('activites')}
        onViewUpdate={() => setShowUpdateModal(true)}
        onViewProfils={() => setShowProfilsModal(true)}
        activeView={view}
      />
      {view === 'recettes' ? (
        <RecettesPage onRetour={() => setView('planning')} />
      ) : view === 'activites' ? (
        <ActivitesPage onRetour={() => setView('planning')} semaine={meta.semaine} profils={profils} />
      ) : (
        <div className="layout">
          <Sidebar
            filtres={filtres}
            setFiltres={setFiltres}
            onRebrasser={estSemaineActuelle && !semaineLockee ? () => setSeed(Math.floor(Math.random() * 1e9)) : null}
            onLockerSemaine={estSemaineActuelle && !semaineLockee ? lockerSemaine : null}
            onDelockerSemaine={semaineLockee ? delockerSemaine : null}
            semaineLockee={semaineLockee}
            stats={stats}
            lectureSeule={!estSemaineActuelle}
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
              <button
                className="semaine-nav__btn"
                onClick={() => peutAvancer && setSemaineVue(semaineSuivante)}
                disabled={!peutAvancer}
                title="Semaine suivante"
              >Suiv. →</button>
            </div>
            <WeeklyPlanning
              planning={planningVue}
              profils={profils}
              joursVerrouilles={estSemaineActuelle ? joursVerrouilles : new Set()}
              onToggleLockJour={estSemaineActuelle ? toggleLockJour : null}
              lectureSeule={!estSemaineActuelle || semaineLockee}
            />
            <GroceryList planning={planningVue} />
          </main>
        </div>
      )}
      {showUpdateModal && <UpdateModal onClose={() => setShowUpdateModal(false)} />}
      {showProfilsModal && (
        <ProfilsModal
          profils={profils}
          onSave={(nouveauxProfils) => {
            setProfils(nouveauxProfils);
            localStorage.setItem('fp_profils', JSON.stringify(nouveauxProfils));
            setShowProfilsModal(false);
          }}
          onClose={() => setShowProfilsModal(false)}
        />
      )}
    </div>
  );
}
