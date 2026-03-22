import { useMemo } from 'react';
import recettes from '../data/recettes.json';
import exercices from '../data/exercices.json';
import activites from '../data/activites.json';
import musique from '../data/musique.json';

export default function Sidebar({ filtres, setFiltres, onRebrasser, stats }) {
  const origines = useMemo(() =>
    [...new Set(recettes.map(r => r.origine).filter(Boolean))].sort(), []);

  const coutMin = useMemo(() => Math.min(...recettes.map(r => r.cout)), []);
  const coutMax = useMemo(() => Math.max(...recettes.map(r => r.cout)), []);

  const set = (key, val) => setFiltres(prev => ({ ...prev, [key]: val }));

  return (
    <aside className="sidebar">
      <div className="data-status">
        <div className="data-status-title">Données</div>
        <p>{recettes.length} recettes · {exercices.length} exercices</p>
        <p>{activites.length} activités · {musique.length} œuvres</p>
      </div>

      <div className="sidebar-inner">
        <div className="sidebar-section-title">Régimes alimentaires</div>

        <div className="control-group">
          <label className="control-label">
            Repas végétariens — <strong>{filtres.nbVegetarien} / 7</strong>
          </label>
          <input type="range" min={0} max={7} step={1} value={filtres.nbVegetarien}
            onChange={e => set('nbVegetarien', +e.target.value)} />
        </div>

        <div className="control-group">
          <label className="control-label">
            Repas véganes — <strong>{filtres.nbVegane} / 7</strong>
          </label>
          <input type="range" min={0} max={7} step={1} value={filtres.nbVegane}
            onChange={e => set('nbVegane', +e.target.value)} />
        </div>

        <div className="sidebar-section-title">Activités</div>

        <div className="control-group">
          <label className="control-label">
            Sorties gratuites — <strong>{filtres.nbGratuit} / sem.</strong>
          </label>
          <input type="range" min={0} max={3} step={1} value={filtres.nbGratuit}
            onChange={e => set('nbGratuit', +e.target.value)} />
        </div>

        <div className="sidebar-section-title">Filtres recettes</div>

        <div className="control-group">
          <label className="control-label">Origine culturelle</label>
          <select className="sidebar-select" value={filtres.origine} onChange={e => set('origine', e.target.value)}>
            <option value="Tous">Toutes les origines</option>
            {origines.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="control-group">
          <label className="checkbox-label">
            <input type="checkbox" checked={filtres.activerCout}
              onChange={e => set('activerCout', e.target.checked)} />
            Limiter le coût par recette
          </label>
          {filtres.activerCout && (
            <>
              <label className="control-label" style={{ marginTop: 10 }}>
                Maximum — <strong>{filtres.coutMax} $</strong>
              </label>
              <input type="range" min={coutMin} max={coutMax} step={1} value={filtres.coutMax}
                onChange={e => set('coutMax', +e.target.value)} />
            </>
          )}
        </div>

        <div className="control-group">
          <label className="checkbox-label">
            <input type="checkbox" checked={filtres.activerTemps}
              onChange={e => set('activerTemps', e.target.checked)} />
            Limiter le temps de cuisine
          </label>
          {filtres.activerTemps && (
            <>
              <label className="control-label" style={{ marginTop: 10 }}>
                Maximum — <strong>{filtres.tempsMax} min</strong>
              </label>
              <input type="range" min={50} max={500} step={10} value={filtres.tempsMax}
                onChange={e => set('tempsMax', +e.target.value)} />
            </>
          )}
        </div>

        <hr className="sidebar-rule" />

        <button className="btn-rebrasser" onClick={onRebrasser}>
          Rebrasser les cartes
        </button>

        <hr className="sidebar-rule" />

        {stats && <StatsBlock stats={stats} filtres={filtres} />}
      </div>
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
      <div className="stats-title">Bilan de la semaine</div>

      <div className="stats-main">
        <div className="stat-item">
          <span className="stat-value">{stats.tempsTotal}</span>
          <div className="stat-label">Min cuisine</div>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.coutRecettes}</span>
          <div className="stat-label">$ recettes</div>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.coutActivites}</span>
          <div className="stat-label">$ activités</div>
        </div>
      </div>

      <div className="evaluations-title">Répartition des régimes</div>
      <div className="eval-grid">
        <div className="eval-member">
          <span className="eval-emoji">🥩</span>
          <div className="eval-name">Omni.</div>
          <div className="eval-score">{stats.regimes.omnivore}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🥗</span>
          <div className="eval-name">Végé.</div>
          <div className="eval-score">{stats.regimes['végétarien']}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🌿</span>
          <div className="eval-name">Végane</div>
          <div className="eval-score">{stats.regimes['végane']}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🎯</span>
          <div className="eval-name">Obj.V.</div>
          <div className="eval-score">{filtres.nbVegetarien}/7</div>
        </div>
        <div className="eval-member">
          <span className="eval-emoji">🎯</span>
          <div className="eval-name">Obj.Vg</div>
          <div className="eval-score">{filtres.nbVegane}/7</div>
        </div>
      </div>

      <div className="evaluations-title">Évaluations familiales</div>
      <div className="eval-grid">
        {membres.map(m => (
          <div key={m.key} className="eval-member">
            <span className="eval-emoji">{m.emoji}</span>
            <div className="eval-name">{m.nom}</div>
            <div className="eval-score">
              {stats.evals[m.key] != null ? stats.evals[m.key] : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
