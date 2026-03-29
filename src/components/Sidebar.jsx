import { useState, useMemo, useRef } from 'react';
import recettes from '../data/recettes.json';
import exercices from '../data/exercices.json';
import activites from '../data/activites.json';
import musique from '../data/musique.json';

function BoutonRebrasser({ onRebrasser }) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const startRef = useRef(null);
  const HOLD_MS = 1500;

  function startHold(e) {
    e.preventDefault();
    if (!onRebrasser) return;
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const p = Math.min((Date.now() - startRef.current) / HOLD_MS, 1);
      setProgress(p);
      if (p >= 1) {
        clearInterval(intervalRef.current);
        setProgress(0);
        onRebrasser();
      }
    }, 30);
  }

  function endHold() {
    clearInterval(intervalRef.current);
    setProgress(0);
  }

  return (
    <button
      className="btn-rebrasser"
      onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
      onTouchStart={startHold} onTouchEnd={endHold} onTouchCancel={endHold}
      disabled={!onRebrasser}
      title="Maintenir pour proposer d'autres recettes"
    >
      <span className="btn-rebrasser__text">
        {progress > 0.05 ? 'Maintenir…' : 'Proposer d\'autres recettes'}
      </span>
      <span className="btn-rebrasser__bar" style={{ transform: `scaleX(${progress})` }} />
    </button>
  );
}

// ── Barre de recherche d'ingrédients ─────────────────────────────────────────
function RechercheIngredients({ ingredientsForces, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Construire la liste de tous les ingrédients uniques depuis les recettes
  const tousIngredients = useMemo(() => {
    const set = new Set();
    recettes.forEach(r => {
      (r.ingredients || '').split(',').map(s => s.trim()).filter(Boolean).forEach(ing => set.add(ing));
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, []);

  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return tousIngredients
      .filter(ing => {
        const n = ing.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return n.includes(q) && !ingredientsForces.includes(ing);
      })
      .slice(0, 8);
  }, [query, tousIngredients, ingredientsForces]);

  function handleSelect(ing) {
    onAdd(ing);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="ing-forces">
      <div className="sidebar-section-title">Ingrédients à inclure</div>
      <p className="ing-forces__desc">
        Les recettes proposées chercheront à inclure ces ingrédients.
      </p>

      {/* Tags des ingrédients sélectionnés */}
      {ingredientsForces.length > 0 && (
        <div className="ing-forces__tags">
          {ingredientsForces.map(ing => (
            <span key={ing} className="ing-forces__tag">
              {ing}
              <button className="ing-forces__tag-remove" onClick={() => onRemove(ing)} title="Retirer">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Barre de recherche */}
      <div className="ing-forces__search-wrap">
        <input
          type="text"
          className="ing-forces__input"
          placeholder="Rechercher un ingrédient…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && suggestions.length > 0 && (
          <ul className="ing-forces__suggestions">
            {suggestions.map(ing => (
              <li key={ing} className="ing-forces__suggestion" onMouseDown={() => handleSelect(ing)}>
                + {ing}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ filtres, setFiltres, onRebrasser, onLockerSemaine, onDelockerSemaine, semaineLockee, stats, lectureSeule, ingredientsForces = [], onAddIngredientForce, onRemoveIngredientForce }) {
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

        {/* Ingrédients à inclure */}
        {onAddIngredientForce && (
          <>
            <RechercheIngredients
              ingredientsForces={ingredientsForces}
              onAdd={onAddIngredientForce}
              onRemove={onRemoveIngredientForce}
            />
            <hr className="sidebar-rule" />
          </>
        )}

        {lectureSeule ? (
          <p className="sidebar-lecture-seule">📖 Semaine passée — lecture seule</p>
        ) : semaineLockee ? (
          <div className="semaine-lockee">
            <span className="semaine-lockee__label">✅ Semaine confirmée</span>
            <button className="semaine-lockee__btn-unlock" onClick={onDelockerSemaine}>
              Modifier
            </button>
          </div>
        ) : (
          <>
            <BoutonRebrasser onRebrasser={onRebrasser} />
            {onLockerSemaine && (
              <button className="btn-locker-semaine" onClick={onLockerSemaine}>
                ✅ Confirmer la semaine
              </button>
            )}
          </>
        )}

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
