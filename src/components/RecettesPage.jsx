import { useState, useMemo } from 'react';
import recettes from '../data/recettes.json';

// ── Métadonnées des thèmes ──────────────────────────────────────────────────
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
  omnivore:   { label: 'Omnivore',    color: '#5C3D22' }, /* bark */
  végétarien: { label: 'Végétarien', color: '#3A5C26' }, /* forest */
  végane:     { label: 'Végane',      color: '#6E9050' }, /* sage */
};

// ── Carte recette ──────────────────────────────────────────────────────────
function RecetteCard({ recette }) {
  const themes = Object.entries(THEMES).filter(([key]) => recette[key] === 1);

  const evalsValides = MEMBRES.filter(m => recette[m.key] != null && recette[m.key] !== '' && !isNaN(parseFloat(recette[m.key])));
  const hasRatings = evalsValides.length > 0;
  const avgRating = hasRatings
    ? (evalsValides.reduce((s, m) => s + parseFloat(recette[m.key]), 0) / evalsValides.length).toFixed(1)
    : null;

  const regime = REGIME_CONFIG[recette.regime_alimentaire];
  const dollarSigns = '$'.repeat(Math.min(recette.cout || 1, 6));

  return (
    <article className="recette-card">
      <div className="recette-card__top">
        {themes.map(([key, t]) => (
          <span key={key} className="recette-tag recette-tag--theme">{t.emoji} {t.label}</span>
        ))}
        {regime && (
          <span className="recette-tag recette-tag--regime" style={{ color: regime.color }}>
            {regime.label}
          </span>
        )}
      </div>

      <h3 className="recette-card__nom">{recette.nom}</h3>

      <div className="recette-card__meta">
        <span className="recette-card__cout">{dollarSigns}</span>
        <span className="recette-card__dot">·</span>
        <span>{recette.temps_preparation} min</span>
        {recette.origine && (
          <>
            <span className="recette-card__dot">·</span>
            <span>{recette.origine}</span>
          </>
        )}
        {avgRating && (
          <>
            <span className="recette-card__dot">·</span>
            <span className="recette-card__avg">★ {avgRating}</span>
          </>
        )}
      </div>

      {recette.ingredients && (
        <p className="recette-card__ingredients">{recette.ingredients}</p>
      )}

      {hasRatings && (
        <div className="recette-card__evals">
          {evalsValides.map(m => (
            <span key={m.key} className="recette-eval-chip">
              {m.emoji} {recette[m.key]}
            </span>
          ))}
        </div>
      )}

      {recette.livre && (
        <div className="recette-card__livre">📖 {recette.livre}</div>
      )}
    </article>
  );
}

// ── Bouton filtre pill ─────────────────────────────────────────────────────
function Pill({ label, active, onClick }) {
  return (
    <button className={`filtre-pill ${active ? 'filtre-pill--active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

// ── Page principale ────────────────────────────────────────────────────────
export default function RecettesPage({ onRetour }) {
  const [recherche, setRecherche] = useState('');
  const [filtreRegime, setFiltreRegime] = useState('Tous');
  const [filtreTheme, setFiltreTheme] = useState('');
  const [filtreOrigine, setFiltreOrigine] = useState('Tous');
  const [filtreCout, setFiltreCout] = useState(0);
  const [tri, setTri] = useState('nom'); // 'nom' | 'cout' | 'temps' | 'note'

  const origines = useMemo(() =>
    ['Tous', ...[...new Set(recettes.map(r => r.origine).filter(Boolean))].sort()], []);

  const resultats = useMemo(() => {
    let liste = recettes.filter(r => {
      if (filtreRegime !== 'Tous' && r.regime_alimentaire !== filtreRegime) return false;
      if (filtreTheme && !r[filtreTheme]) return false;
      if (filtreOrigine !== 'Tous' && r.origine !== filtreOrigine) return false;
      if (filtreCout > 0 && r.cout > filtreCout) return false;
      if (recherche.trim()) {
        const q = recherche.trim().toLowerCase();
        const inNom = r.nom.toLowerCase().includes(q);
        const inIng = (r.ingredients || '').toLowerCase().includes(q);
        if (!inNom && !inIng) return false;
      }
      return true;
    });

    // Tri
    liste = [...liste].sort((a, b) => {
      if (tri === 'cout')   return (a.cout || 0) - (b.cout || 0);
      if (tri === 'temps')  return (a.temps_preparation || 0) - (b.temps_preparation || 0);
      if (tri === 'note') {
        const noteA = MEMBRES.filter(m => a[m.key] != null && !isNaN(parseFloat(a[m.key])));
        const noteB = MEMBRES.filter(m => b[m.key] != null && !isNaN(parseFloat(b[m.key])));
        const avgA = noteA.length ? noteA.reduce((s, m) => s + parseFloat(a[m.key]), 0) / noteA.length : 0;
        const avgB = noteB.length ? noteB.reduce((s, m) => s + parseFloat(b[m.key]), 0) / noteB.length : 0;
        return avgB - avgA;
      }
      return a.nom.localeCompare(b.nom, 'fr');
    });

    return liste;
  }, [filtreRegime, filtreTheme, filtreOrigine, filtreCout, recherche, tri]);

  return (
    <div className="recettes-page">

      {/* En-tête */}
      <div className="recettes-header">
        <button className="recettes-back" onClick={onRetour}>← Retour au planning</button>
        <div className="recettes-header__main">
          <h2 className="recettes-titre">Bibliothèque de recettes</h2>
          <span className="recettes-compte">{resultats.length} / {recettes.length} recettes</span>
        </div>
      </div>

      {/* Filtres sticky */}
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
          {origines.map(o => (
            <Pill key={o} label={o} active={filtreOrigine === o} onClick={() => setFiltreOrigine(o)} />
          ))}
        </div>

        <div className="recettes-filtres__row">
          <span className="recettes-filtres__label">Coût max</span>
          {[[0, 'Tous'], [3, '≤ 3 $'], [5, '≤ 5 $'], [7, '≤ 7 $']].map(([v, l]) => (
            <Pill key={v} label={l} active={filtreCout === v} onClick={() => setFiltreCout(v)} />
          ))}
          <span className="recettes-filtres__sep" />
          <span className="recettes-filtres__label">Trier</span>
          {[['nom', 'A–Z'], ['cout', 'Coût ↑'], ['temps', 'Temps ↑'], ['note', 'Note ↓']].map(([v, l]) => (
            <Pill key={v} label={l} active={tri === v} onClick={() => setTri(v)} />
          ))}
        </div>

      </div>

      {/* Grille */}
      <div className="recettes-grid">
        {resultats.map((r, i) => <RecetteCard key={i} recette={r} />)}
        {resultats.length === 0 && (
          <div className="recettes-vide">Aucune recette ne correspond à ces critères.</div>
        )}
      </div>

    </div>
  );
}
