import { useState, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import WeeklyPlanning from './components/WeeklyPlanning';
import GroceryList from './components/GroceryList';
import { genererPlanning, calculerStats } from './utils/planning';
import recettes from './data/recettes.json';
import exercices from './data/exercices.json';
import activites from './data/activites.json';
import musique from './data/musique.json';
import meta from './data/meta.json';
import './App.css';

const DEFAULT_FILTRES = {
  nbVegetarien: 2,
  nbVegane: 1,
  activerOrigine: false,
  origine: 'Italie',
  activerCout: false,
  coutMax: 6,
  activerTemps: false,
  tempsMax: 200,
};

export default function App() {
  const [filtres, setFiltres] = useState(DEFAULT_FILTRES);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));

  const planning = useMemo(() =>
    genererPlanning({
      recettes, exercices, activites, musique, filtres, seed,
      semaineDebut: meta.semaine.debut,
    }),
    [filtres, seed]
  );

  const stats = useMemo(() => calculerStats(planning), [planning]);

  return (
    <div className="app">
      <Header />
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
    </div>
  );
}
