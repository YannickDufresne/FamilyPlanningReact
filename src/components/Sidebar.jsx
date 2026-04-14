import { useState, useMemo, useRef, useEffect } from 'react';
import recettes from '../data/recettes.json';
import exercices from '../data/exercices.json';
import activites from '../data/activites.json';
import musique from '../data/musique.json';
import films from '../data/films.json';
import meta from '../data/meta.json';
import { ZONES, DRAPEAUX, FUSION_ENTRY, labelOrigine } from '../utils/zones';

// ── Méthode & Système — section unifiée ──────────────────────────────────────
function StatusDot({ ok, label }) {
  return (
    <span
      className={`tdb-dot tdb-dot--${ok === true ? 'ok' : ok === false ? 'err' : 'off'}`}
      title={label}
    />
  );
}

const METHODE_SECTIONS = [
  {
    icon: '🍽️',
    titre: 'Repas · 7 thèmes fixes',
    texte: 'Lundi = Pasta Rapido, Mardi = Bol/Sandwich, Mercredi = Poisson, Jeudi = Plat en sauce, Vendredi = Confort grillé, Samedi = Pizza, Dimanche = Slow Chic. Recette choisie parmi ~342 en respectant régimes et sans doublon.',
  },
  {
    icon: '🏋️',
    titre: 'Entraînement fonctionnel',
    texte: '5 phases (échauffement → musculaire → cardio → finition → récupération) les lundi, mercredi, vendredi.',
  },
  {
    icon: '🗓️',
    titre: 'Activités Québec',
    texte: 'Événements via Ticketmaster + suggestions Claude IA. Score de pertinence famille 0–100 calculé selon les préférences des membres.',
  },
  {
    icon: '🎵',
    titre: 'Bibliothèque musicale',
    texte: 'L\'album suggéré chaque jour correspond à l\'origine culturelle de la recette. Albums 295+, couvrant 50+ pays.',
  },
  {
    icon: '🎬',
    titre: 'Films',
    texte: 'Film de la semaine choisi selon la saison et l\'origine culturelle active. 137 films essentiels du cinéma mondial.',
  },
  {
    icon: '🔄',
    titre: 'Mise à jour hebdomadaire',
    texte: 'Chaque vendredi soir : GitHub Actions régénère activités, aubaines épiceries et suggestions IA.',
  },
];

function GuideEtSysteme({ onViewMethode }) {
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

  const anthropicOk = !!localStorage.getItem('anthropic_key');
  const togetherOk  = !!localStorage.getItem('together_key');
  const sources     = meta.sources || {};
  const claudeOk    = sources.claude?.statut === 'ok' || sources.claude_gratuites?.statut === 'ok';
  const tmOk        = sources.ticketmaster?.statut === 'ok';
  const wsOk        = sources.web_search?.statut === 'ok';
  const maj         = new Date(((meta.lastUpdated || '').split('T')[0]) + 'T12:00:00')
    .toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });

  const toutFonctionne = anthropicOk && claudeOk;

  return (
    <details className="sidebar-avance guide-systeme" open={!toutFonctionne}>
      <summary className="sidebar-avance__toggle">
        📖 Méthode &amp; Système
        {toutFonctionne
          ? <span className="sidebar-avance__badge gs-badge gs-badge--ok">Tout fonctionne ✓</span>
          : <span className="sidebar-avance__badge gs-badge gs-badge--warn">⚠ À configurer</span>
        }
      </summary>

      <div className="sidebar-avance__content gs-content">

        {/* ── Comment ça marche ── */}
        <div className="gs-block">
          <div className="gs-block__titre">Comment ça marche</div>
          <div className="gs-methode-list">
            {METHODE_SECTIONS.map(s => (
              <div key={s.titre} className="gs-methode-item">
                <span className="gs-methode-icon">{s.icon}</span>
                <div>
                  <div className="gs-methode-titre">{s.titre}</div>
                  <div className="gs-methode-texte">{s.texte}</div>
                </div>
              </div>
            ))}
          </div>
          {onViewMethode && (
            <button className="gs-detail-btn" onClick={onViewMethode}>
              Lire la documentation complète →
            </button>
          )}
        </div>

        {/* ── État du système ── */}
        <div className="gs-block">
          <div className="gs-block__titre">État du système</div>

          <div className="gs-status-grid">
            <div className={`gs-status-card ${anthropicOk ? 'gs-status-card--ok' : 'gs-status-card--warn'}`}>
              <StatusDot ok={anthropicOk} label="" />
              <span className="gs-status-label">Anthropic IA</span>
              <span className="gs-status-val">{anthropicOk ? 'Configurée' : 'Requise'}</span>
            </div>
            <div className={`gs-status-card ${claudeOk ? 'gs-status-card--ok' : 'gs-status-card--off'}`}>
              <StatusDot ok={claudeOk} label="" />
              <span className="gs-status-label">Claude IA</span>
              <span className="gs-status-val">{claudeOk ? 'OK' : '—'}</span>
            </div>
            <div className={`gs-status-card ${tmOk ? 'gs-status-card--ok' : 'gs-status-card--off'}`}>
              <StatusDot ok={tmOk} label="" />
              <span className="gs-status-label">Ticketmaster</span>
              <span className="gs-status-val">{tmOk ? 'OK' : '—'}</span>
            </div>
            <div className={`gs-status-card ${wsOk ? 'gs-status-card--ok' : 'gs-status-card--off'}`}>
              <StatusDot ok={wsOk} label="" />
              <span className="gs-status-label">Web Search</span>
              <span className="gs-status-val">{wsOk ? 'OK' : '—'}</span>
            </div>
            <div className={`gs-status-card ${togetherOk ? 'gs-status-card--ok' : 'gs-status-card--off'}`}>
              <StatusDot ok={togetherOk} label="" />
              <span className="gs-status-label">Together</span>
              <span className="gs-status-val">{togetherOk ? 'OK' : '—'}</span>
            </div>
          </div>

          <div className="gs-maj">Données mises à jour : {maj}</div>

          {/* Bibliothèque */}
          <div className="gs-stats-grid">
            <div className="gs-stat"><span className="gs-stat__n">{recettes.length}</span><span className="gs-stat__l">recettes</span></div>
            <div className="gs-stat"><span className="gs-stat__n">{films.length}</span><span className="gs-stat__l">films</span></div>
            <div className="gs-stat"><span className="gs-stat__n">{musique.length}</span><span className="gs-stat__l">albums</span></div>
            <div className="gs-stat"><span className="gs-stat__n">{activites.length}</span><span className="gs-stat__l">activités</span></div>
          </div>
        </div>

        {/* ── Configuration API ── */}
        <div className="gs-block">
          <div className="gs-block__titre">Configuration</div>

          <div className="gs-api-label">
            <StatusDot ok={anthropicOk} label="" />
            Clé API Anthropic
            {!anthropicOk && <span className="gs-api-required">— requise pour l'IA</span>}
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--ink-4)', margin: '2px 0 6px', lineHeight: 1.4 }}>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--forest)' }}>Créer une clé →</a>
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
          >{sauvegarde ? '✓ Sauvegardée' : 'Sauvegarder la clé'}</button>
        </div>

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
const normIngUI = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Thèmes dans l'ordre des 7 jours de la semaine (lundi → dimanche)
const THEMES_JOURS = [
  'pasta_rapido', 'bol_nwich', 'criiions_poisson',
  'plat_en_sauce', 'confort_grille', 'pizza', 'slow_chic',
];

// Correspondance ingrédient ↔ chaîne d'ingrédients d'une recette
const matchIngUI = (recetteIngs, force) => {
  const rNorm = normIngUI(recetteIngs);
  const fNorm = normIngUI(force);
  if (rNorm.includes(fNorm)) return true;
  const mots = fNorm.split(/\s+/).filter(m => m.length >= 4);
  return mots.length >= 2 && mots.every(m => rNorm.includes(m));
};

function RechercheIngredients({ ingredientsForces, ingredientsCounts = {}, onAdd, onRemove, onSetCount, joursDisponibles = 7, planning = null }) {
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

  // Pour chaque ingrédient forcé : combien de jours (par thème) ont ≥1 recette correspondante ?
  // C'est le vrai maximum atteignable — chaque jour n'a qu'un thème fixe.
  const maxParIngredient = useMemo(() => {
    const result = {};
    ingredientsForces.forEach(ing => {
      let joursAvecMatch = 0;
      THEMES_JOURS.forEach(theme => {
        const col = `theme_${theme}`;
        const aMatch = recettes.some(r => r[col] === 1 && matchIngUI(r.ingredients || '', ing));
        if (aMatch) joursAvecMatch++;
      });
      result[ing] = Math.min(joursAvecMatch, joursDisponibles);
    });
    return result;
  }, [ingredientsForces, joursDisponibles]);

  // Ingrédients pour lesquels aucune recette n'existe (dans aucun thème)
  const ingsSansRecettes = useMemo(() => {
    const sans = new Set();
    ingredientsForces.forEach(f => {
      if ((maxParIngredient[f] ?? 0) === 0) sans.add(f);
    });
    return sans;
  }, [ingredientsForces, maxParIngredient]);

  // Nombre de jours dans le planning actuel qui correspondent à chaque ingrédient forcé
  const ingsCovertsEnPlanning = useMemo(() => {
    const result = {};
    if (!planning) return result;
    ingredientsForces.forEach(ing => {
      result[ing] = planning.filter(j => j.recette && matchIngUI(j.recette.ingredients || '', ing)).length;
    });
    return result;
  }, [planning, ingredientsForces]);

  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return tousIngredients
      .filter(ing => {
        const n = ing.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return n.includes(q) && !ingredientsForces.includes(ing);
      })
      .slice(0, 6);
  }, [query, tousIngredients, ingredientsForces]);

  // Montrer l'option d'ajout libre si le texte n'est pas déjà sélectionné
  const queryTrimmed = query.trim();
  const showAddFree = queryTrimmed.length >= 2
    && !ingredientsForces.some(f => f.toLowerCase() === queryTrimmed.toLowerCase())
    && !suggestions.some(s => s.toLowerCase() === queryTrimmed.toLowerCase());

  function handleSelect(ing) {
    onAdd(ing);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="ing-forces">
      <div className="sidebar-section-title">Ingrédients à inclure</div>
      <p className="ing-forces__desc">
        Précisez combien de repas doivent utiliser chaque ingrédient.
      </p>

      {/* Tags avec stepper de count */}
      {ingredientsForces.length > 0 && (
        <div className="ing-forces__tags">
          {ingredientsForces.map(ing => {
            const count = ingredientsCounts[ing] || 1;
            const sansRecette = ingsSansRecettes.has(ing);
            const maxPossible = Math.min(maxParIngredient[ing] ?? joursDisponibles, joursDisponibles);
            const countEffectif = Math.min(count, maxPossible || 1);
            const enPlanning = ingsCovertsEnPlanning[ing] ?? null;
            const planningOk = enPlanning !== null && enPlanning >= countEffectif;
            const planningPartiel = enPlanning !== null && enPlanning > 0 && enPlanning < countEffectif;
            const planningNul = enPlanning !== null && enPlanning === 0 && !sansRecette;
            return (
              <span key={ing} className={`ing-forces__tag ing-forces__tag--count${sansRecette ? ' ing-forces__tag--warn' : ''}`}>
                <span className="ing-forces__tag-nom" title={sansRecette ? 'Aucune recette avec cet ingrédient — ajoutez-en une avec l\'IA' : ''}>
                  {sansRecette && <span className="ing-forces__tag-warn-icon">⚠</span>}{ing}
                </span>
                <span className="ing-forces__tag-stepper">
                  <button
                    className="ing-forces__step-btn"
                    onClick={() => onSetCount(ing, Math.max(1, countEffectif - 1))}
                    disabled={countEffectif <= 1}
                    title="Moins de repas"
                  >−</button>
                  <span
                    className="ing-forces__step-val"
                    title={maxPossible > 0 ? `${countEffectif} repas sur ${maxPossible} possible${maxPossible > 1 ? 's' : ''} cette semaine${enPlanning !== null ? ` · ${enPlanning} dans le planning actuel` : ''}` : 'Aucun repas possible avec cet ingrédient'}
                  >
                    ×{countEffectif}
                    {maxPossible > 0 && maxPossible < (joursDisponibles + (7 - joursDisponibles === 0 ? 0 : 1)) && (
                      <span className="ing-forces__step-max"> / {maxPossible}</span>
                    )}
                  </span>
                  <button
                    className="ing-forces__step-btn"
                    onClick={() => onSetCount(ing, Math.min(maxPossible, countEffectif + 1))}
                    disabled={countEffectif >= maxPossible || maxPossible === 0}
                    title={countEffectif >= maxPossible ? `Maximum atteint : seulement ${maxPossible} jour${maxPossible > 1 ? 's' : ''} de la semaine ont une recette avec cet ingrédient` : 'Plus de repas'}
                  >+</button>
                </span>
                {/* Indicateur visuel du résultat dans le planning actuel */}
                {enPlanning !== null && !sansRecette && (
                  <span
                    className={`ing-forces__planning-dot${planningOk ? ' ing-forces__planning-dot--ok' : planningPartiel ? ' ing-forces__planning-dot--partial' : planningNul ? ' ing-forces__planning-dot--none' : ''}`}
                    title={planningOk ? `✓ ${enPlanning} repas avec cet ingrédient cette semaine` : planningPartiel ? `⚠ Seulement ${enPlanning}/${countEffectif} repas possible (jours confirmés ou régime incompatible)` : `✕ Aucun repas avec cet ingrédient cette semaine`}
                  >
                    {planningOk ? '✓' : planningPartiel ? enPlanning + '/' + countEffectif : '✕'}
                  </span>
                )}
                <button className="ing-forces__tag-remove" onClick={() => onRemove(ing)} title="Retirer">✕</button>
              </span>
            );
          })}
        </div>
      )}
      {ingredientsForces.some(f => ingsSansRecettes.has(f)) && (
        <p className="ing-forces__warn-msg">
          ⚠ Aucune recette existante avec cet ingrédient. Utilisez l'IA pour en suggérer une.
        </p>
      )}

      {/* Barre de recherche + saisie libre */}
      <div className="ing-forces__search-wrap">
        <input
          type="text"
          className="ing-forces__input"
          placeholder="Rechercher ou saisir un ingrédient…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={e => {
            if (e.key === 'Enter' && queryTrimmed.length >= 2) {
              handleSelect(suggestions[0] || queryTrimmed);
            }
          }}
        />
        {open && (suggestions.length > 0 || showAddFree) && (
          <ul className="ing-forces__suggestions">
            {suggestions.map(ing => (
              <li key={ing} className="ing-forces__suggestion" onMouseDown={() => handleSelect(ing)}>
                {ing}
              </li>
            ))}
            {showAddFree && (
              <li
                className="ing-forces__suggestion ing-forces__suggestion--free"
                onMouseDown={() => handleSelect(queryTrimmed)}
              >
                ＋ Ajouter « {queryTrimmed} »
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ filtres, setFiltres, onRebrasser, onLockerSemaine, onDelockerSemaine, semaineLockee, stats, lectureSeule, ingredientsForces = [], ingredientsCounts = {}, onAddIngredientForce, onRemoveIngredientForce, onSetIngredientCount, planning, joursChoisis, onOptimiserIA, joursDisponibles = 7, onViewMethode }) {
  // Tous les pays par zone (avec indication si des recettes existent)
  const originesParZone = useMemo(() => {
    const avecRecettes = new Set(recettes.map(r => r.origine).filter(Boolean));
    return ZONES.map(z => ({
      ...z,
      paysDispo: z.pays, // tous les pays, même sans recettes
      avecRecettes,
    }));
  }, []);

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
        {/* Ingrédients à inclure — en premier pour un accès rapide */}
        {onAddIngredientForce && (
          <>
            <RechercheIngredients
              ingredientsForces={ingredientsForces}
              ingredientsCounts={ingredientsCounts}
              onAdd={onAddIngredientForce}
              onRemove={onRemoveIngredientForce}
              onSetCount={onSetIngredientCount}
              joursDisponibles={joursDisponibles}
              planning={planning}
            />
            <hr className="sidebar-rule" />
          </>
        )}

        {/* Préférences : régimes, repas rapides, filtres recettes */}
        {(() => {
          const badgeParts = [
            filtres.nbVegetarien > 0 && `${filtres.nbVegetarien} végé`,
            filtres.nbVegane > 0 && `${filtres.nbVegane} vg`,
            filtres.nbClassiques > 0 && `${filtres.nbClassiques} classique${filtres.nbClassiques > 1 ? 's' : ''}`,
            filtres.origine !== 'Tous' && labelOrigine(filtres.origine),
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

                <div className="control-group">
                  <label className="control-label">
                    Classiques familiaux ⭐ — <strong>{filtres.nbClassiques}</strong>
                    <span className="control-label__cap"> jour{filtres.nbClassiques > 1 ? 's' : ''} sur 7</span>
                  </label>
                  <input type="range" min={0} max={joursDisponibles} step={1}
                    value={filtres.nbClassiques}
                    onChange={e => set('nbClassiques', +e.target.value)} />
                  {filtres.nbClassiques > 0 && (
                    <p className="control-label__hint">
                      Les repas sans ⭐ seront remplacés par des classiques marqués.
                    </p>
                  )}
                </div>

                <div className="sidebar-section-title">Filtres recettes</div>

                <div className="control-group">
                  <label className="control-label">Origine culturelle</label>
                  <select className="sidebar-select" value={filtres.origine} onChange={e => set('origine', e.target.value)}>
                    <option value="Tous">🌍 Toutes les origines</option>
                    {originesParZone.map(z => (
                      <optgroup key={z.zone} label={`${z.emoji} ${z.zone}`}>
                        <option value={`zone:${z.zone}`}>{z.emoji} Toute la zone {z.zone}</option>
                        {z.paysDispo.map(p => (
                          <option key={p} value={p}>
                            {DRAPEAUX[p] || ''} {p}{!z.avecRecettes.has(p) ? ' ✦' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value={FUSION_ENTRY.value}>{FUSION_ENTRY.label}</option>
                  </select>
                  <p className="control-label__hint" style={{ marginTop: 4 }}>
                    ✦ Pas encore de recettes — utilisez l'IA pour en créer.
                  </p>
                </div>
              </div>
            </details>
          );
        })()}

        {/* Stats temps de cuisine (coût retiré — scale non significative) */}
        {stats && (
          <div className="sidebar-semaine-stats">
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
            <div className="semaine-stat-item">
              <span className="semaine-stat-icon">💰</span>
              <div className="semaine-stat-body">
                <div className="semaine-stat-label">Niveau de coût</div>
                <div className="semaine-stat-valeur">
                  {'●'.repeat(Math.round(stats.coutMoyen || 0))}{'○'.repeat(Math.max(0, 6 - Math.round(stats.coutMoyen || 0)))}
                </div>
                <div className="semaine-stat-detail">{(stats.coutMoyen || 0).toFixed(1)} / 6 en moyenne</div>
              </div>
            </div>
            {onOptimiserIA && !lectureSeule && (
              <button className="btn-optimiser-ia" onClick={onOptimiserIA}>
                ✨ Optimiser avec l'IA
              </button>
            )}
          </div>
        )}

        <hr className="sidebar-rule" />

        {lectureSeule ? (
          <p className="sidebar-lecture-seule">📖 Semaine passée — lecture seule</p>
        ) : semaineLockee ? (
          <div className="semaine-lockee">
            <span className="semaine-lockee__label">✅ Semaine confirmée</span>
            <button className="semaine-lockee__btn-unlock" onClick={onDelockerSemaine}>
              Modifier
            </button>
          </div>
        ) : onLockerSemaine ? (
          <button className="btn-locker-semaine" onClick={onLockerSemaine}>
            ✅ Confirmer la semaine
          </button>
        ) : null}

        <hr className="sidebar-rule" />

        <GuideEtSysteme onViewMethode={onViewMethode} />

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
