import { useMemo } from 'react';
import recettes from '../data/recettes.json';
import exercices from '../data/exercices.json';
import activites from '../data/activites.json';
import musique from '../data/musique.json';

export default function Sidebar({ filtres, setFiltres, onRebrasser, stats }) {
  const origines = useMemo(() => {
    const all = [...new Set(recettes.map(r => r.origine).filter(Boolean))].sort();
    return all;
  }, []);

  const coutMin = useMemo(() => Math.min(...recettes.map(r => r.cout)), []);
  const coutMax = useMemo(() => Math.max(...recettes.map(r => r.cout)), []);

  const set = (key, val) => setFiltres(prev => ({ ...prev, [key]: val }));

  return (
    <aside className="sidebar">

      {/* Données chargées */}
      <div className="data-status">
        <h6>📊 Données chargées</h6>
        <p>• Recettes : {recettes.length} entrées</p>
        <p>• Exercices : {exercices.length} entrées</p>
        <p>• Activités : {activites.length} entrées</p>
        <p>• Musique : {musique.length} entrées</p>
      </div>

      {/* Paramètres */}
      <h4>🎛️ Paramètres</h4>

      <h5>🌱 Préférences alimentaires</h5>

      <div className="control-group">
        <label>🥗 Repas végétariens / semaine : <strong>{filtres.nbVegetarien}</strong></label>
        <input type="range" min={0} max={7} step={1} value={filtres.nbVegetarien}
          onChange={e => set('nbVegetarien', +e.target.value)} />
      </div>

      <div className="control-group">
        <label>🌿 Repas véganes / semaine : <strong>{filtres.nbVegane}</strong></label>
        <input type="range" min={0} max={7} step={1} value={filtres.nbVegane}
          onChange={e => set('nbVegane', +e.target.value)} />
      </div>

      <h5>🔍 Filtres optionnels</h5>

      <div className="control-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={filtres.activerOrigine}
            onChange={e => set('activerOrigine', e.target.checked)} />
          Filtrer par origine culturelle
        </label>
        {filtres.activerOrigine && (
          <select value={filtres.origine} onChange={e => set('origine', e.target.value)}>
            {origines.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={filtres.activerCout}
            onChange={e => set('activerCout', e.target.checked)} />
          Limiter le coût par recette
        </label>
        {filtres.activerCout && (
          <>
            <label>💰 Coût max : <strong>{filtres.coutMax} $</strong></label>
            <input type="range" min={coutMin} max={coutMax} step={1} value={filtres.coutMax}
              onChange={e => set('coutMax', +e.target.value)} />
          </>
        )}
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input type="checkbox" checked={filtres.activerTemps}
            onChange={e => set('activerTemps', e.target.checked)} />
          Limiter le temps total de cuisine
        </label>
        {filtres.activerTemps && (
          <>
            <label>⏱️ Temps max total : <strong>{filtres.tempsMax} min</strong></label>
            <input type="range" min={50} max={500} step={10} value={filtres.tempsMax}
              onChange={e => set('tempsMax', +e.target.value)} />
          </>
        )}
      </div>

      <hr />

      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <button className="btn-rebrasser" onClick={onRebrasser}>
          🎲 Rebrasser les cartes
        </button>
      </div>

      <hr />

      {/* Stats */}
      {stats && <StatsBlock stats={stats} filtres={filtres} />}
    </aside>
  );
}

function StatsBlock({ stats, filtres }) {
  const membres = [
    { key: 'eval_patricia', emoji: '💚', nom: 'Patricia' },
    { key: 'eval_yannick',  emoji: '🦉', nom: 'Yannick'  },
    { key: 'eval_joseph',   emoji: '🐤', nom: 'Joseph'   },
    { key: 'eval_mika',     emoji: '🍒', nom: 'Mika'     },
    { key: 'eval_luce',     emoji: '🍒', nom: 'Luce'     },
  ];

  return (
    <div className="stats-container">
      <div className="stats-title">📊 Statistiques de la semaine</div>

      <div className="stats-main">
        <div className="stat-item">
          <span className="stat-value">{stats.tempsTotal} min</span>
          <div className="stat-label">Temps cuisine</div>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.coutRecettes} $</span>
          <div className="stat-label">Coût recettes</div>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.coutActivites} $</span>
          <div className="stat-label">Moy. activités</div>
        </div>
      </div>

      <div className="evaluations-title">🍽️ Répartition des régimes</div>
      <div className="eval-grid">
        <div className="eval-member">
          <span className="eval-emoji">🥩</span>
          <div className="eval-name">Omnivore</div>
          <div className="eval-score">{stats.regimes.omnivore}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🥗</span>
          <div className="eval-name">Végétarien</div>
          <div className="eval-score">{stats.regimes['végétarien']}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🌿</span>
          <div className="eval-name">Végane</div>
          <div className="eval-score">{stats.regimes['végane']}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🎯</span>
          <div className="eval-name">Obj. Végé</div>
          <div className="eval-score">{filtres.nbVegetarien}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🎯</span>
          <div className="eval-name">Obj. Végane</div>
          <div className="eval-score">{filtres.nbVegane}/7</div>
        </div>
      </div>

      <div className="evaluations-title">👨‍👩‍👧‍👦 Évaluations moyennes</div>
      <div className="eval-grid">
        {membres.map(m => (
          <div key={m.key} className="eval-member">
            <span className="eval-emoji">{m.emoji}</span>
            <div className="eval-name">{m.nom}</div>
            <div className="eval-score">{stats.evals[m.key] != null ? `${stats.evals[m.key]}/5` : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
