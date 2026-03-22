import { useState, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import WeeklyPlanning from './components/WeeklyPlanning';
import GroceryList from './components/GroceryList';
import RecettesPage from './components/RecettesPage';
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
  const [view, setView] = useState('planning'); // 'planning' | 'recettes'
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showProfilsModal, setShowProfilsModal] = useState(false);
  const [profils, setProfils] = useState(() => {
    try {
      const saved = localStorage.getItem('fp_profils');
      if (saved) return JSON.parse(saved);
    } catch {}
    return familleDefaut;
  });

  if (!authentifie) {
    return <LoginScreen onSuccess={() => setAuthentifie(true)} />;
  }

  const planning = useMemo(() =>
    genererPlanning({
      recettes, exercices, activites, musique, filtres, seed,
      semaineDebut: meta.semaine.debut,
      profils,
    }),
    [filtres, seed, profils]
  );

  const stats = useMemo(() => calculerStats(planning), [planning]);

  return (
    <div className="app">
      <Header
        onViewRecettes={() => setView('recettes')}
        onViewUpdate={() => setShowUpdateModal(true)}
        onViewProfils={() => setShowProfilsModal(true)}
      />
      {view === 'recettes' ? (
        <RecettesPage onRetour={() => setView('planning')} />
      ) : (
        <div className="layout">
          <Sidebar
            filtres={filtres}
            setFiltres={setFiltres}
            onRebrasser={() => setSeed(Math.floor(Math.random() * 1e9))}
            stats={stats}
          />
          <main className="main-content">
            <WeeklyPlanning planning={planning} />
            <GroceryList planning={planning} />
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
