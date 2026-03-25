import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import recettesBase from '../data/recettes.json';

// ── Métadonnées ──────────────────────────────────────────────────────────────
const THEMES = {
  theme_pasta_rapido:    { label: 'Pasta Rapido',   emoji: '🍝' },
  theme_bol_nwich:       { label: 'Bol · Sandwich',  emoji: '🌮' },
  theme_criiions_poisson:{ label: 'Poisson',          emoji: '🐟' },
  theme_plat_en_sauce:   { label: 'Plat en sauce',   emoji: '🍲' },
  theme_confort_grille:  { label: 'Confort grillé',  emoji: '🔥' },
  theme_pizza:           { label: 'Pizza',            emoji: '🍕' },
  theme_slow_chic:       { label: 'Slow chic',        emoji: '🍷' },
};

const MEMBRES = [
  { key: 'eval_patricia', emoji: '💚', nom: 'Patricia' },
  { key: 'eval_yannick',  emoji: '🦉', nom: 'Yannick'  },
  { key: 'eval_joseph',   emoji: '🐤', nom: 'Joseph'   },
  { key: 'eval_mika',     emoji: '🍒', nom: 'Mika'     },
  { key: 'eval_luce',     emoji: '🍒', nom: 'Luce'     },
];

const REGIME_CONFIG = {
  omnivore:   { label: 'Omnivore',   color: '#5C3D22' },
  végétarien: { label: 'Végétarien', color: '#3A5C26' },
  végane:     { label: 'Végane',     color: '#6E9050' },
};

const ORIGINES_SUGGEREES = [
  'France', 'Italie', 'Japon', 'Liban', 'Grèce', 'Mexique', 'Espagne',
  'Corée', 'Inde', 'Maroc', 'Thaïlande', 'États-Unis', 'Méditerranéen',
  'Moyen-Orient', 'Chine', 'Vietnam', 'Pérou',
];

const RECETTE_VIDE = {
  nom: '', url: '', origine: '', regime_alimentaire: 'omnivore',
  temps_preparation: '', cout: 3, ingredients: '', livre: '', notes: '',
  source: 'manuel',
  theme_pasta_rapido: 0, theme_bol_nwich: 0, theme_criiions_poisson: 0,
  theme_plat_en_sauce: 0, theme_confort_grille: 0, theme_pizza: 0, theme_slow_chic: 0,
  eval_patricia: '', eval_yannick: '', eval_joseph: '', eval_mika: '', eval_luce: '',
};

const STORAGE_KEY   = 'recettes_custom_v1';
const API_KEY_STORE = 'anthropic_key';

// ── Helpers généraux ──────────────────────────────────────────────────────────
function loadStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { ajoutees: [], modifiees: {} }; }
  catch { return { ajoutees: [], modifiees: {} }; }
}

function nomDepuisUrl(url) {
  try {
    const m = url.match(/cooking\.nytimes\.com\/recipes\/\d+-(.+?)(?:\?|$)/);
    if (m) return m[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';
    return last.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch { return ''; }
}

function sourceDepuisUrl(url) {
  if (!url) return 'manuel';
  if (url.includes('cooking.nytimes.com')) return 'nyt_cooking';
  return 'web';
}

function parseDuration(iso) {
  if (!iso) return '';
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return '';
  return (parseInt(m[1] || 0) * 60) + parseInt(m[2] || 0) || '';
}

function extraireJsonLd(html) {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of matches) {
    try {
      const raw = JSON.parse(m[1]);
      const candidates = Array.isArray(raw) ? raw : (raw['@graph'] || [raw]);
      const recipe = candidates.find(d => d['@type'] === 'Recipe' || (Array.isArray(d['@type']) && d['@type'].includes('Recipe')));
      if (recipe) return recipe;
    } catch {}
  }
  return null;
}

// ── Enrichissement IA ─────────────────────────────────────────────────────────
async function enrichirAvecClaude(apiKey, contexte) {
  const PROMPT = `Tu analyses une recette et retournes UNIQUEMENT un objet JSON (sans markdown).

Champs attendus :
- "nom" : string — nom de la recette en français, naturel, sans majuscules inutiles
- "origine" : string — pays/région d'origine culturelle en français (ex : "Italie", "Japon", "Moyen-Orient")
- "regime_alimentaire" : "omnivore" | "végétarien" | "végane"
- "temps_preparation" : number — temps total en minutes (préparation + cuisson), ou null
- "cout" : number 1–6 — estimation du coût par portion (1=très économique, 3=moyen, 6=très cher)
- "ingredients" : string — 5 à 8 ingrédients clés en français, séparés par des virgules
- "themes" : array — thèmes applicables parmi :
    "theme_pasta_rapido"     → pâtes, nouilles, gnocchi, plats italiens rapides
    "theme_bol_nwich"        → bols repas, sandwichs, wraps, salades-repas
    "theme_criiions_poisson" → poisson, fruits de mer, crustacés
    "theme_plat_en_sauce"    → ragoûts, currys, daubes, plats mijotés en sauce épaisse
    "theme_confort_grille"   → viandes grillées, BBQ, burgers, comfort food
    "theme_pizza"            → pizza, focaccia, tarte flambée, flatbread
    "theme_slow_chic"        → cuisine raffinée, risotto, plats lents élaborés, dîner chic

Contexte de la recette :
${JSON.stringify(contexte, null, 2)}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: PROMPT }],
    }),
  });

  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const data = await resp.json();
  const text = data.content?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}

async function enrichirDepuisUrl(url, apiKey, setForm, setStatut) {
  setStatut('chargement');
  let jsonLd = null;

  // Étape 1 : tenter la récupération de la page via proxy CORS
  try {
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const r = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const html = await r.text();
      jsonLd = extraireJsonLd(html);
    }
  } catch { /* proxy échoué, on continue */ }

  if (!apiKey) {
    // Pas de clé : on remplit ce qu'on peut avec le JSON-LD seul
    if (jsonLd) {
      const dur = parseDuration(jsonLd.totalTime || jsonLd.cookTime || jsonLd.prepTime);
      setForm(f => ({
        ...f,
        nom: jsonLd.name || f.nom,
        ingredients: Array.isArray(jsonLd.recipeIngredient)
          ? jsonLd.recipeIngredient.slice(0, 7).join(', ')
          : f.ingredients,
        temps_preparation: dur || f.temps_preparation,
        origine: jsonLd.recipeCuisine || f.origine,
      }));
      setStatut('partiel');
    } else {
      setStatut('cle-manquante');
    }
    return;
  }

  // Étape 2 : enrichissement IA
  try {
    const contexte = jsonLd
      ? {
          nom_original: jsonLd.name,
          ingredients: jsonLd.recipeIngredient || [],
          description: jsonLd.description || '',
          temps_total: jsonLd.totalTime,
          temps_cuisson: jsonLd.cookTime,
          cuisine: jsonLd.recipeCuisine,
          categorie: jsonLd.recipeCategory,
          regime: jsonLd.suitableForDiet,
        }
      : { url, nom_depuis_url: nomDepuisUrl(url) };

    const ai = await enrichirAvecClaude(apiKey, contexte);
    if (!ai) throw new Error('Réponse vide');

    setForm(f => {
      const themes = {};
      (ai.themes || []).forEach(t => { if (t in f) themes[t] = 1; });
      return {
        ...f,
        nom: ai.nom || f.nom,
        origine: ai.origine || f.origine,
        regime_alimentaire: ['omnivore','végétarien','végane'].includes(ai.regime_alimentaire)
          ? ai.regime_alimentaire : f.regime_alimentaire,
        temps_preparation: ai.temps_preparation || f.temps_preparation,
        cout: ai.cout || f.cout,
        ingredients: ai.ingredients || f.ingredients,
        ...themes,
      };
    });
    setStatut('ok');
  } catch (e) {
    console.error('Enrichissement IA :', e);
    setStatut('erreur');
  }
}

// ── Hook API key ──────────────────────────────────────────────────────────────
function useApiKey() {
  const [key, setKey] = useState(() => localStorage.getItem(API_KEY_STORE) || '');
  const save = useCallback(k => {
    setKey(k);
    if (k) localStorage.setItem(API_KEY_STORE, k);
    else localStorage.removeItem(API_KEY_STORE);
  }, []);
  return [key, save];
}

// ── Hook custom storage ───────────────────────────────────────────────────────
function useRecettesCustom() {
  const [custom, setCustom] = useState(loadStorage);

  const save = useCallback((fn) => {
    setCustom(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const ajouter   = useCallback(r  => save(c => ({ ...c, ajoutees: [...c.ajoutees, { ...r, _id: `custom-${Date.now()}`, _source: 'local' }] })), [save]);
  const modifier  = useCallback((id, changes) => {
    if (id.startsWith('json-')) save(c => ({ ...c, modifiees: { ...c.modifiees, [id]: { ...(c.modifiees[id] || {}), ...changes } } }));
    else save(c => ({ ...c, ajoutees: c.ajoutees.map(r => r._id === id ? { ...r, ...changes } : r) }));
  }, [save]);
  const supprimer = useCallback(id => save(c => ({ ...c, ajoutees: c.ajoutees.filter(r => r._id !== id) })), [save]);

  return { custom, ajouter, modifier, supprimer };
}

// ── Fusion base + custom ─────────────────────────────────────────────────────
function useToutesRecettes(custom) {
  return useMemo(() => {
    const base = recettesBase.map((r, i) => ({
      ...r,
      ...(custom.modifiees[`json-${i}`] || {}),
      _id: `json-${i}`,
      _source: 'json',
    }));
    return [...base, ...custom.ajoutees];
  }, [custom]);
}

// ── Statut enrichissement ─────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const cfg = {
    chargement: { txt: 'Analyse en cours…',         cls: 'statut--loading'  },
    ok:         { txt: '✓ Champs pré-remplis',       cls: 'statut--ok'       },
    partiel:    { txt: '⚠ Partiel (sans clé API)',  cls: 'statut--warn'     },
    erreur:     { txt: "✕ Erreur — vérifiez l'URL", cls: 'statut--erreur'   },
    'cle-manquante': { txt: "Ajoutez une clé API pour l'analyse automatique", cls: 'statut--warn' },
  }[statut];
  if (!cfg) return null;
  return <div className={`recette-form__statut ${cfg.cls}`}>{cfg.txt}</div>;
}

// ── Formulaire recette ────────────────────────────────────────────────────────
function RecetteForm({ recette, isNew, onSave, onSupprimer, onClose, apiKey, onSaveApiKey }) {
  const [form, setForm]     = useState(() => { const { _id, _source, ...r } = recette; return { ...RECETTE_VIDE, ...r }; });
  const [statut, setStatut] = useState(null);
  const [afficherCle, setAfficherCle] = useState(false);
  const [cleTemp, setCleTemp]         = useState(apiKey);
  const timerRef = useRef(null);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function handleUrl(url) {
    set('url', url);
    set('source', sourceDepuisUrl(url));
    const nom = nomDepuisUrl(url);
    if (nom && !form.nom) set('nom', nom);

    // Déclenchement après 600 ms d'inactivité sur l'URL
    clearTimeout(timerRef.current);
    if (url.startsWith('http') && isNew) {
      timerRef.current = setTimeout(() => {
        enrichirDepuisUrl(url, apiKey, setForm, setStatut);
      }, 600);
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    onSave(form);
  }

  function sauverCle() {
    onSaveApiKey(cleTemp.trim());
    setAfficherCle(false);
    if (form.url.startsWith('http') && isNew) {
      enrichirDepuisUrl(form.url, cleTemp.trim(), setForm, setStatut);
    }
  }

  const isLocal = recette._source === 'local';

  return (
    <form className="recette-form" onSubmit={handleSubmit}>

      {/* En-tête */}
      <div className="recette-form__header">
        <h2 className="recette-form__titre">
          {isNew ? 'Ajouter une recette' : 'Modifier la recette'}
        </h2>
        <div className="recette-form__header-actions">
          <button type="button" className="recette-form__cle-btn" onClick={() => setAfficherCle(v => !v)} title="Clé API Anthropic">
            🔑
          </button>
          <button type="button" className="recette-form__close" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Clé API (panneau rétractable) */}
      {afficherCle && (
        <div className="recette-form__cle-panel">
          <p className="recette-form__cle-info">
            Clé API Anthropic pour l'analyse automatique des recettes.<br />
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">Obtenir une clé →</a>
          </p>
          <div className="recette-form__cle-row">
            <input
              type="password"
              className="recette-form__input"
              placeholder="sk-ant-…"
              value={cleTemp}
              onChange={e => setCleTemp(e.target.value)}
            />
            <button type="button" className="recette-form__btn recette-form__btn--sauver" onClick={sauverCle}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Statut enrichissement */}
      {isNew && <StatutBadge statut={statut} />}

      {/* Section : Identification */}
      <section className="recette-form__section">
        <h3 className="recette-form__section-titre">Identification</h3>

        <label className="recette-form__field">
          <span>URL de la recette {isNew && apiKey && <em>(coller pour analyser automatiquement)</em>}</span>
          <input
            type="url"
            className="recette-form__input"
            placeholder="https://cooking.nytimes.com/recipes/…"
            value={form.url}
            onChange={e => handleUrl(e.target.value)}
          />
        </label>

        <label className="recette-form__field">
          <span>Nom <em>(requis)</em></span>
          <input
            type="text"
            className="recette-form__input"
            placeholder="Nom de la recette"
            value={form.nom}
            required
            onChange={e => set('nom', e.target.value)}
          />
        </label>

        <div className="recette-form__row">
          <label className="recette-form__field">
            <span>Origine culturelle</span>
            <input
              type="text"
              list="origines-list"
              className="recette-form__input"
              placeholder="ex. Italie, Japon…"
              value={form.origine}
              onChange={e => set('origine', e.target.value)}
            />
            <datalist id="origines-list">
              {ORIGINES_SUGGEREES.map(o => <option key={o} value={o} />)}
            </datalist>
          </label>

          <label className="recette-form__field">
            <span>Régime</span>
            <select
              className="recette-form__input recette-form__select"
              value={form.regime_alimentaire}
              onChange={e => set('regime_alimentaire', e.target.value)}
            >
              <option value="omnivore">Omnivore</option>
              <option value="végétarien">Végétarien</option>
              <option value="végane">Végane</option>
            </select>
          </label>
        </div>
      </section>

      {/* Section : Thèmes */}
      <section className="recette-form__section">
        <h3 className="recette-form__section-titre">Thèmes de soirée</h3>
        <div className="recette-form__themes">
          {Object.entries(THEMES).map(([key, t]) => (
            <label key={key} className={`recette-form__theme-pill ${form[key] ? 'recette-form__theme-pill--on' : ''}`}>
              <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked ? 1 : 0)} />
              {t.emoji} {t.label}
            </label>
          ))}
        </div>
      </section>

      {/* Section : Infos pratiques */}
      <section className="recette-form__section">
        <h3 className="recette-form__section-titre">Infos pratiques</h3>

        <div className="recette-form__row">
          <label className="recette-form__field">
            <span>Temps total (min)</span>
            <input
              type="number"
              className="recette-form__input"
              placeholder="30"
              min="1" max="480"
              value={form.temps_preparation}
              onChange={e => set('temps_preparation', e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
          <label className="recette-form__field">
            <span>Coût par portion</span>
            <div className="recette-form__cout-stars">
              {[1,2,3,4,5,6].map(n => (
                <button key={n} type="button"
                  className={`recette-form__cout-btn ${form.cout >= n ? 'recette-form__cout-btn--on' : ''}`}
                  onClick={() => set('cout', n)}>$</button>
              ))}
            </div>
          </label>
        </div>

        <label className="recette-form__field">
          <span>Ingrédients clés</span>
          <input
            type="text"
            className="recette-form__input"
            placeholder="bœuf, tomates, herbes…"
            value={form.ingredients}
            onChange={e => set('ingredients', e.target.value)}
          />
        </label>

        <label className="recette-form__field">
          <span>Source / livre</span>
          <input
            type="text"
            className="recette-form__input"
            placeholder="ex. Ottolenghi Simple, recette IA…"
            value={form.livre}
            onChange={e => set('livre', e.target.value)}
          />
        </label>

        <label className="recette-form__field">
          <span>Notes libres</span>
          <textarea
            className="recette-form__input recette-form__textarea"
            rows={3}
            placeholder="Variantes, allergies, observations…"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </label>
      </section>

      {/* Section : Notes famille */}
      <section className="recette-form__section">
        <h3 className="recette-form__section-titre">
          Notes de la famille <span className="recette-form__section-sub">(0 – 10)</span>
        </h3>
        <div className="recette-form__ratings">
          {MEMBRES.map(m => (
            <label key={m.key} className="recette-form__rating">
              <span className="recette-form__rating-emoji">{m.emoji}</span>
              <span className="recette-form__rating-nom">{m.nom}</span>
              <input
                type="number"
                className="recette-form__input recette-form__rating-input"
                min="0" max="10" step="0.5"
                placeholder="–"
                value={form[m.key]}
                onChange={e => set(m.key, e.target.value === '' ? '' : parseFloat(e.target.value))}
              />
            </label>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="recette-form__actions">
        {!isNew && isLocal && (
          <button type="button" className="recette-form__btn recette-form__btn--suppr"
            onClick={() => { onSupprimer(recette._id); onClose(); }}>
            Supprimer
          </button>
        )}
        <button type="button" className="recette-form__btn recette-form__btn--annuler" onClick={onClose}>
          Annuler
        </button>
        <button type="submit" className="recette-form__btn recette-form__btn--sauver">
          {isNew ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="recette-drawer" role="dialog" aria-modal="true">
      <div className="recette-drawer__backdrop" onClick={onClose} />
      <div className="recette-drawer__panel">{children}</div>
    </div>
  );
}

// ── Carte recette ─────────────────────────────────────────────────────────────
function RecetteCard({ recette, onEdit }) {
  const themes = Object.entries(THEMES).filter(([key]) => recette[key] === 1);
  const evalsValides = MEMBRES.filter(m => recette[m.key] != null && recette[m.key] !== '' && !isNaN(parseFloat(recette[m.key])));
  const hasRatings = evalsValides.length > 0;
  const avgRating  = hasRatings
    ? (evalsValides.reduce((s, m) => s + parseFloat(recette[m.key]), 0) / evalsValides.length).toFixed(1)
    : null;
  const regime      = REGIME_CONFIG[recette.regime_alimentaire];
  const dollarSigns = '$'.repeat(Math.min(recette.cout || 1, 6));

  return (
    <article className="recette-card">
      <div className="recette-card__top">
        {themes.map(([key, t]) => (
          <span key={key} className="recette-tag recette-tag--theme">{t.emoji} {t.label}</span>
        ))}
        {regime && (
          <span className="recette-tag recette-tag--regime" style={{ color: regime.color }}>{regime.label}</span>
        )}
        {recette._source === 'local' && (
          <span className="recette-tag recette-tag--local">✦ ajoutée</span>
        )}
      </div>

      <h3 className="recette-card__nom">
        {recette.url ? (
          <a className="recette-card__lien" href={recette.url} target="_blank" rel="noopener noreferrer">
            {recette.nom}
          </a>
        ) : recette.nom}
        {recette.source === 'nyt_cooking' && (
          <span className="nyt-badge" title="Coup de cœur NYT Cooking">♥ NYT</span>
        )}
      </h3>

      <div className="recette-card__meta">
        {recette.cout > 0 && <span className="recette-card__cout">{dollarSigns}</span>}
        {recette.cout > 0 && recette.temps_preparation > 0 && <span className="recette-card__dot">·</span>}
        {recette.temps_preparation > 0 && <span>{recette.temps_preparation} min</span>}
        {recette.origine && <><span className="recette-card__dot">·</span><span>{recette.origine}</span></>}
        {avgRating && <><span className="recette-card__dot">·</span><span className="recette-card__avg">★ {avgRating}</span></>}
      </div>

      {recette.ingredients && <p className="recette-card__ingredients">{recette.ingredients}</p>}
      {recette.notes        && <p className="recette-card__notes">{recette.notes}</p>}

      {hasRatings && (
        <div className="recette-card__evals">
          {evalsValides.map(m => (
            <span key={m.key} className="recette-eval-chip">{m.emoji} {recette[m.key]}</span>
          ))}
        </div>
      )}

      {recette.livre && <div className="recette-card__livre">📖 {recette.livre}</div>}

      <button className="recette-card__edit-btn" onClick={() => onEdit(recette)} title="Modifier">✏</button>
    </article>
  );
}

// ── Pill filtre ───────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }) {
  return (
    <button className={`filtre-pill ${active ? 'filtre-pill--active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function RecettesPage({ onRetour }) {
  const { custom, ajouter, modifier, supprimer } = useRecettesCustom();
  const [apiKey, setApiKey] = useApiKey();
  const toutesRecettes = useToutesRecettes(custom);

  const [recherche, setRecherche]       = useState('');
  const [filtreRegime, setFiltreRegime] = useState('Tous');
  const [filtreTheme, setFiltreTheme]   = useState('');
  const [filtreOrigine, setFiltreOrigine] = useState('Tous');
  const [filtreCout, setFiltreCout]     = useState(0);
  const [tri, setTri]                   = useState('nom');

  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [recetteEnEdition, setRecetteEnEdition] = useState(null);
  const importRef = useRef();

  const origines = useMemo(() =>
    ['Tous', ...[...new Set(toutesRecettes.map(r => r.origine).filter(Boolean))].sort()],
  [toutesRecettes]);

  const resultats = useMemo(() => {
    let liste = toutesRecettes.filter(r => {
      if (filtreRegime !== 'Tous' && r.regime_alimentaire !== filtreRegime) return false;
      if (filtreTheme && !r[filtreTheme]) return false;
      if (filtreOrigine !== 'Tous' && r.origine !== filtreOrigine) return false;
      if (filtreCout > 0 && r.cout > filtreCout) return false;
      if (recherche.trim()) {
        const q = recherche.trim().toLowerCase();
        if (!r.nom.toLowerCase().includes(q) && !(r.ingredients || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
    return [...liste].sort((a, b) => {
      if (tri === 'cout')  return (a.cout || 0) - (b.cout || 0);
      if (tri === 'temps') return (a.temps_preparation || 0) - (b.temps_preparation || 0);
      if (tri === 'note') {
        const avg = r => {
          const v = MEMBRES.filter(m => r[m.key] != null && r[m.key] !== '' && !isNaN(parseFloat(r[m.key])));
          return v.length ? v.reduce((s, m) => s + parseFloat(r[m.key]), 0) / v.length : 0;
        };
        return avg(b) - avg(a);
      }
      return a.nom.localeCompare(b.nom, 'fr');
    });
  }, [toutesRecettes, filtreRegime, filtreTheme, filtreOrigine, filtreCout, recherche, tri]);

  function ouvrirAjout()        { setRecetteEnEdition(null); setDrawerOpen(true); }
  function ouvrirEdition(r)     { setRecetteEnEdition(r);    setDrawerOpen(true); }
  function handleSave(form) {
    if (recetteEnEdition) modifier(recetteEnEdition._id, form);
    else ajouter(form);
    setDrawerOpen(false);
  }

  function telecharger() {
    const clean = toutesRecettes.map(({ _id, _source, ...r }) => r);
    const blob  = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = 'recettes.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error();
        data.filter(r => r.nom).forEach(r => ajouter({ ...r, source: r.source || 'import' }));
        alert(`${data.filter(r => r.nom).length} recettes importées.`);
      } catch { alert('Fichier JSON invalide.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const recetteFormulaire = recetteEnEdition ?? { ...RECETTE_VIDE, _id: null, _source: 'local' };

  return (
    <div className="recettes-page">

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <RecetteForm
          recette={recetteFormulaire}
          isNew={!recetteEnEdition}
          onSave={handleSave}
          onSupprimer={supprimer}
          onClose={() => setDrawerOpen(false)}
          apiKey={apiKey}
          onSaveApiKey={setApiKey}
        />
      </Drawer>

      {/* En-tête */}
      <div className="recettes-header">
        <button className="recettes-back" onClick={onRetour}>← Retour au planning</button>
        <div className="recettes-header__main">
          <h2 className="recettes-titre">Bibliothèque de recettes</h2>
          <span className="recettes-compte">{resultats.length} / {toutesRecettes.length} recettes</span>
          <div className="recettes-header__actions">
            <button className="recettes-action-btn recettes-action-btn--primary" onClick={ouvrirAjout}>
              + Ajouter
            </button>
            <button className="recettes-action-btn" onClick={telecharger} title="Télécharger toute la base en JSON">
              ↓ JSON
            </button>
            <button className="recettes-action-btn" onClick={() => importRef.current?.click()} title="Importer un JSON">
              ↑ Import
            </button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="recettes-filtres">
        <input
          type="search"
          className="recettes-search"
          placeholder="Rechercher un plat ou ingrédient…"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
        <div className="recettes-filtres__row">
          <span className="recettes-filtres__label">Régime</span>
          {['Tous', 'omnivore', 'végétarien', 'végane'].map(r => (
            <Pill key={r} label={r} active={filtreRegime === r} onClick={() => setFiltreRegime(r)} />
          ))}
        </div>
        <div className="recettes-filtres__row">
          <span className="recettes-filtres__label">Thème</span>
          <Pill label="Tous" active={filtreTheme === ''} onClick={() => setFiltreTheme('')} />
          {Object.entries(THEMES).map(([key, t]) => (
            <Pill key={key} label={`${t.emoji} ${t.label}`} active={filtreTheme === key}
              onClick={() => setFiltreTheme(filtreTheme === key ? '' : key)} />
          ))}
        </div>
        <div className="recettes-filtres__row">
          <span className="recettes-filtres__label">Origine</span>
          {origines.map(o => <Pill key={o} label={o} active={filtreOrigine === o} onClick={() => setFiltreOrigine(o)} />)}
        </div>
        <div className="recettes-filtres__row">
          <span className="recettes-filtres__label">Coût max</span>
          {[[0,'Tous'],[3,'≤ 3 $'],[5,'≤ 5 $'],[7,'≤ 7 $']].map(([v,l]) => (
            <Pill key={v} label={l} active={filtreCout === v} onClick={() => setFiltreCout(v)} />
          ))}
          <span className="recettes-filtres__sep" />
          <span className="recettes-filtres__label">Trier</span>
          {[['nom','A–Z'],['cout','Coût ↑'],['temps','Temps ↑'],['note','Note ↓']].map(([v,l]) => (
            <Pill key={v} label={l} active={tri === v} onClick={() => setTri(v)} />
          ))}
        </div>
      </div>

      {/* Grille */}
      <div className="recettes-grid">
        {resultats.map(r => <RecetteCard key={r._id || r.nom} recette={r} onEdit={ouvrirEdition} />)}
        {resultats.length === 0 && (
          <div className="recettes-vide">Aucune recette ne correspond à ces critères.</div>
        )}
      </div>

    </div>
  );
}
