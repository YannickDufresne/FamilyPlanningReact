import { useState, useMemo, useRef, useEffect } from 'react';
import recettes from '../data/recettes.json';
import exercices from '../data/exercices.json';
import activites from '../data/activites.json';
import musique from '../data/musique.json';

// ── Saisie clé API Anthropic ──────────────────────────────────────────────────
function CleApiSection() {
  const [cle, setCle] = useState(() => localStorage.getItem('anthropic_key') || '');
  const [afficher, setAfficher] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);

  useEffect(() => {
    if (sauvegarde) {
      const t = setTimeout(() => setSauvegarde(false), 2000);
      return () => clearTimeout(t);
    }
  }, [sauvegarde]);

  function sauvegarder() {
    const val = cle.trim();
    if (val) localStorage.setItem('anthropic_key', val);
    else localStorage.removeItem('anthropic_key');
    setCle(val);
    setSauvegarde(true);
  }

  const configureee = !!localStorage.getItem('anthropic_key');

  return (
    <details className="sidebar-avance" open={!configureee}>
      <summary className="sidebar-avance__toggle">
        🔑 Clé API Anthropic
        {configureee
          ? <span className="sidebar-avance__badge" style={{ background: 'var(--sage-light)', color: 'var(--sage)' }}>Configurée ✓</span>
          : <span className="sidebar-avance__badge" style={{ background: 'var(--terra-light)', color: 'var(--terra)' }}>Requise pour l'IA</span>
        }
      </summary>
      <div className="sidebar-avance__content">
        <p style={{ fontSize: '0.72rem', color: 'var(--ink-4)', marginBottom: 6, lineHeight: 1.4 }}>
          Nécessaire pour les suggestions IA. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--forest)' }}>Créer une clé →</a>
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type={afficher ? 'text' : 'password'}
            value={cle}
            onChange={e => setCle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sauvegarder()}
            placeholder="sk-ant-api03-…"
            style={{ flex: 1, fontSize: '0.72rem', padding: '5px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontFamily: 'monospace' }}
          />
          <button
            type="button"
            onClick={() => setAfficher(v => !v)}
            style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 6, padding: '0 8px', cursor: 'pointer', fontSize: '0.8rem' }}
            title={afficher ? 'Masquer' : 'Afficher'}
          >{afficher ? '🙈' : '👁'}</button>
        </div>
        <button
          type="button"
          onClick={sauvegarder}
          style={{ marginTop: 6, width: '100%', background: sauvegarde ? 'var(--sage)' : 'var(--forest)', color: 'white', border: 'none', borderRadius: 6, padding: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
        >{sauvegarde ? '✓ Sauvegardée' : 'Sauvegarder'}</button>
      </div>
    </details>
  );
}

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

export default function Sidebar({ filtres, setFiltres, onRebrasser, onLockerSemaine, onDelockerSemaine, semaineLockee, stats, lectureSeule, ingredientsForces = [], onAddIngredientForce, onRemoveIngredientForce, joursChoisis, onOptimiserIA, joursDisponibles = 7 }) {
  const origines = useMemo(() =>
    [...new Set(recettes.map(r => r.origine).filter(Boolean))].sort(), []);

  // Clamp vegetarian/vegan counts when available days decrease
  useEffect(() => {
    const total = filtres.nbVegetarien + filtres.nbVegane;
    if (total > joursDisponibles) {
      setFiltres(prev => {
        const newVege  = Math.min(prev.nbVegetarien, joursDisponibles);
        const newVegan = Math.min(prev.nbVegane, Math.max(0, joursDisponibles - newVege));
        return { ...prev, nbVegetarien: newVege, nbVegane: newVegan };
      });
    }
  }, [joursDisponibles]); // eslint-disable-line

  const set = (key, val) => setFiltres(prev => ({ ...prev, [key]: val }));

  return (
    <aside className="sidebar">
      <div className="data-status">
        <div className="data-status-title">Données</div>
        <p>{recettes.length} recettes · {exercices.length} exercices</p>
        <p>{activites.length} activités · {musique.length} œuvres</p>
      </div>

      <div className="sidebar-inner">
        {/* Préférences : régimes, activités, filtres recettes */}
        {(() => {
          const badgeParts = [
            filtres.nbVegetarien > 0 && `${filtres.nbVegetarien} végé`,
            filtres.nbVegane > 0 && `${filtres.nbVegane} vg`,
            filtres.nbGratuit > 0 && `${filtres.nbGratuit} gratuit${filtres.nbGratuit > 1 ? 's' : ''}`,
            filtres.origine !== 'Tous' && filtres.origine,
          ].filter(Boolean);
          const isOpen = badgeParts.length > 0;
          return (
            <details className="sidebar-avance" open={isOpen}>
              <summary className="sidebar-avance__toggle">
                ⚙ Préférences
                {badgeParts.length > 0 && (
                  <span className="sidebar-avance__badge">{badgeParts.join(' · ')}</span>
                )}
              </summary>
              <div className="sidebar-avance__content">
                <div className="sidebar-section-title" style={{ marginTop: 4 }}>Régimes alimentaires</div>

                <div className="control-group">
                  <label className="control-label">
                    Repas végétariens — <strong>{filtres.nbVegetarien}</strong>
                    {joursDisponibles < 7 && <span className="control-label__cap"> / {joursDisponibles} dispo</span>}
                  </label>
                  <input type="range" min={0} max={Math.max(0, joursDisponibles - filtres.nbVegane)} step={1}
                    value={filtres.nbVegetarien}
                    onChange={e => set('nbVegetarien', +e.target.value)} />
                </div>

                <div className="control-group">
                  <label className="control-label">
                    Repas véganes — <strong>{filtres.nbVegane}</strong>
                    {joursDisponibles < 7 && <span className="control-label__cap"> / {joursDisponibles} dispo</span>}
                  </label>
                  <input type="range" min={0} max={Math.max(0, joursDisponibles - filtres.nbVegetarien)} step={1}
                    value={filtres.nbVegane}
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
              </div>
            </details>
          );
        })()}

        {/* Stats coût et temps de la semaine */}
        {stats && (
          <div className="sidebar-semaine-stats">
            <div className="semaine-stat-item">
              <span className="semaine-stat-icon">💰</span>
              <div className="semaine-stat-body">
                <div className="semaine-stat-label">Budget semaine</div>
                <div className="semaine-stat-valeur">{stats.coutRecettes}$</div>
                <div className="semaine-stat-detail">≈ {(stats.coutRecettes / 7).toFixed(0)}$ / repas</div>
              </div>
            </div>
            <div className="semaine-stat-item">
              <span className="semaine-stat-icon">⏱</span>
              <div className="semaine-stat-body">
                <div className="semaine-stat-label">Temps cuisine</div>
                <div className="semaine-stat-valeur">
                  {Math.floor(stats.tempsTotal / 60) > 0 ? `${Math.floor(stats.tempsTotal / 60)}h` : ''}{stats.tempsTotal % 60 > 0 ? `${stats.tempsTotal % 60}min` : ''}
                </div>
                <div className="semaine-stat-detail">≈ {Math.round(stats.tempsTotal / 7)} min / repas</div>
              </div>
            </div>
            {onOptimiserIA && !lectureSeule && (
              <button className="btn-optimiser-ia" onClick={onOptimiserIA}>
                ✨ Réduire le budget / temps
              </button>
            )}
          </div>
        )}

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

        <CleApiSection />

        <hr className="sidebar-rule" />

        {stats && <StatsBlock stats={stats} />}
      </div>
    </aside>
  );
}

function StatsBlock({ stats }) {
  const membres = [
    { key: 'eval_patricia', emoji: '💚', nom: 'Patricia' },
    { key: 'eval_yannick',  emoji: '🦉', nom: 'Yannick'  },
    { key: 'eval_joseph',   emoji: '🐤', nom: 'Joseph'   },
    { key: 'eval_mika',     emoji: '🍒', nom: 'Mika'     },
    { key: 'eval_luce',     emoji: '🍒', nom: 'Luce'     },
  ];

  const hasEvals = membres.some(m => stats.evals[m.key] != null && stats.evals[m.key] !== '');
  if (!hasEvals) return null;

  return (
    <div className="stats-container">
      <div className="evaluations-title">Évaluations familiales</div>
      <div className="eval-grid">
        {membres.map(m => (
          <div key={m.key} className="eval-member">
            <span className="eval-emoji">{m.emoji}</span>
            <div className="eval-name">{m.nom}</div>
            <div className="eval-score">
              {stats.evals[m.key] != null && stats.evals[m.key] !== '' ? stats.evals[m.key] : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
