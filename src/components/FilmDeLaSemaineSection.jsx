import { useState, useMemo, useEffect } from 'react';
import films from '../data/films.json';
import { getFilmsCandidats, getFilmIndexInitial } from '../utils/filmSemaine';
import FilmAjoutModal from './FilmAjoutModal';
import FilmDecouverteModal from './FilmDecouverteModal';

// ── Palmarès ───────────────────────────────────────────────────────────────────
const PALMARES_LABELS = {
  cannes_palme_dor:    'Palme d\'Or',
  cannes_grand_prix:   'Grand Prix Cannes',
  cannes_jury:         'Prix du Jury',
  oscar_meilleur_film: 'Oscar Meilleur Film',
  oscar_etranger:      'Oscar Film Étranger',
  sight_sound:         'Sight & Sound',
  berlinale:           'Ours d\'Or Berlin',
  venice:              'Lion d\'Or Venise',
  imdb_top250:         'IMDB Top 250',
  afi_top100:          'AFI Top 100',
};

function meilleurPalmares(film) {
  if (!film.palmares?.length) return null;
  const priority = ['cannes_palme_dor', 'oscar_meilleur_film', 'sight_sound', 'oscar_etranger',
    'berlinale', 'venice', 'cannes_grand_prix', 'cannes_jury', 'imdb_top250', 'afi_top100'];
  for (const p of priority) {
    if (film.palmares.includes(p)) {
      const rang = film.palmares_rangs?.[p];
      return (PALMARES_LABELS[p] || p) + (rang ? ` #${rang}` : '');
    }
  }
  const p = film.palmares[0];
  const rang = film.palmares_rangs?.[p];
  return (PALMARES_LABELS[p] || p) + (rang ? ` #${rang}` : '');
}

// ── Drapeaux ───────────────────────────────────────────────────────────────────
const DRAPEAUX = {
  'États-Unis': '🇺🇸', 'Royaume-Uni': '🇬🇧', 'France': '🇫🇷',
  'Canada': '🇨🇦', 'Canada (Québec)': '🇨🇦', 'Japon': '🇯🇵',
  'Brésil': '🇧🇷', 'Allemagne': '🇩🇪', 'Italie': '🇮🇹',
  'Espagne': '🇪🇸', 'Mexique': '🇲🇽', 'Argentine': '🇦🇷',
  'Corée du Sud': '🇰🇷', 'Chine': '🇨🇳', 'Taïwan': '🇹🇼',
  'Hong Kong': '🇭🇰', 'Inde': '🇮🇳', 'Iran': '🇮🇷',
  'Sénégal': '🇸🇳', 'Mali': '🇲🇱', 'Mauritanie': '🇲🇷',
  'Algérie': '🇩🇿', 'Égypte': '🇪🇬', 'Palestine': '🇵🇸',
  'Liban': '🇱🇧', 'Suède': '🇸🇪', 'Danemark': '🇩🇰',
  'Norvège': '🇳🇴', 'Roumanie': '🇷🇴', 'Pologne': '🇵🇱',
  'Hongrie': '🇭🇺', 'Belgique': '🇧🇪', 'Russie (URSS)': '🇷🇺',
  'Colombie': '🇨🇴',
};

function drapeau(pays) { return DRAPEAUX[pays] || '🌍'; }

// ── Tier score ─────────────────────────────────────────────────────────────────
function tierScore(score) {
  if (score >= 97) return { label: 'Légendaire',     classe: 'tier--legendaire' };
  if (score >= 92) return { label: 'Incontournable', classe: 'tier--incontournable' };
  if (score >= 85) return { label: 'Essentiel',      classe: 'tier--essentiel' };
  if (score >= 78) return { label: 'Reconnu',        classe: 'tier--reconnu' };
  return                   { label: 'Remarquable',   classe: 'tier--remarquable' };
}

// ── Poster Wikipedia ───────────────────────────────────────────────────────────
function usePoster(film) {
  const [url, setUrl] = useState(film?.poster_url || null);

  useEffect(() => {
    if (!film) return;
    if (film.poster_url) { setUrl(film.poster_url); return; }
    setUrl(null);
    let cancelled = false;

    async function fetchPoster() {
      const tries = [
        ['fr', film.nom],
        ...(film.titre_original && film.titre_original !== film.nom
          ? [['fr', film.titre_original], ['en', film.titre_original]]
          : []),
        ['en', film.nom],
      ];
      for (const [lang, titre] of tries) {
        if (cancelled) return;
        try {
          const res = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titre)}`
          );
          if (!res.ok) continue;
          const data = await res.json();
          if (data.thumbnail?.source) {
            if (!cancelled) setUrl(data.thumbnail.source);
            return;
          }
        } catch (_) {}
      }
    }
    fetchPoster();
    return () => { cancelled = true; };
  }, [film?.id]);

  return url;
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function FilmDeLaSemaineSection({
  semaineVue,
  filtresOrigine,
  filmRatings = {},
  onNoterFilm,
  filmsCustom = [],
  onAjouterFilm,
}) {
  const tousFilms = useMemo(() => [...films, ...filmsCustom], [filmsCustom]);
  const origineActive = filtresOrigine && filtresOrigine !== 'Tous' ? filtresOrigine : null;

  const filmPool = useMemo(
    () => getFilmsCandidats(semaineVue, origineActive, tousFilms),
    [semaineVue, origineActive, tousFilms]
  );

  const [filmIndex, setFilmIndex] = useState(() =>
    getFilmIndexInitial(semaineVue, filmPool)
  );
  const [descExpand, setDescExpand] = useState(false);
  const [showAjout, setShowAjout] = useState(false);   // modal manuel
  const [showDecouverte, setShowDecouverte] = useState(false); // modal IA

  // Recalculer quand l'origine ou la semaine change
  useEffect(() => {
    const pool = getFilmsCandidats(semaineVue, origineActive, tousFilms);
    setFilmIndex(getFilmIndexInitial(semaineVue, pool));
    setDescExpand(false);
  }, [semaineVue, origineActive, tousFilms]);

  // Reset description quand on change de film
  useEffect(() => { setDescExpand(false); }, [filmIndex]);

  const film = filmPool[filmIndex] || null;
  const posterUrl = usePoster(film);

  if (!film) {
    // Pool vide avec filtre d'origine actif → état vide avec offre d'ajout
    if (origineActive) {
      return (
        <div className="fds-section">
          <div className="fds-header">
            <div className="fds-header__left">
              <span className="fds-header__icon">🎬</span>
              <span className="fds-header__titre">Film de la semaine</span>
              <span className="fds-header__origine">{origineActive}</span>
            </div>
          </div>
          <div className="fds-empty">
            <span className="fds-empty__icon">🎞️</span>
            <p className="fds-empty__msg">
              Aucun film <strong>{origineActive}</strong> dans la bibliothèque.
            </p>
            {onAjouterFilm && (
              <div className="fds-empty__btns">
                <button className="fds-empty__add fds-empty__add--ia" onClick={() => setShowDecouverte(true)}>
                  ✨ Découvrir des films {origineActive}
                </button>
                <button className="fds-empty__add fds-empty__add--manuel" onClick={() => setShowAjout(true)}>
                  ➕ Ajouter un titre précis
                </button>
              </div>
            )}
          </div>
          {showDecouverte && (
            <FilmDecouverteModal
              origineHint={origineActive}
              filmsExistants={tousFilms}
              onSauvegarderTous={liste => liste.forEach(f => onAjouterFilm(f))}
              onFermer={() => setShowDecouverte(false)}
            />
          )}
          {showAjout && (
            <FilmAjoutModal
              origineHint={origineActive}
              filmsExistants={tousFilms}
              onSauvegarder={f => { onAjouterFilm(f); setShowAjout(false); }}
              onFermer={() => setShowAjout(false)}
            />
          )}
        </div>
      );
    }
    return null;
  }

  const note = filmRatings?.[film.id] ?? 0;
  const topPalmares = meilleurPalmares(film);
  const score = film.score_consensus ?? 70;
  const tier = tierScore(score);

  function handleEtoile(n) {
    if (onNoterFilm) onNoterFilm(film.id, n === note ? 0 : n);
  }

  return (
    <div className="fds-section">

      {/* En-tête */}
      <div className="fds-header">
        <div className="fds-header__left">
          <span className="fds-header__icon">🎬</span>
          <span className="fds-header__titre">Film de la semaine</span>
          {origineActive && (
            <span className="fds-header__origine">{origineActive}</span>
          )}
        </div>
        <div className="fds-header__nav">
          {onAjouterFilm && (
            <button
              className="film-nav-btn fds-discover-btn"
              onClick={() => setShowDecouverte(true)}
              title="Découvrir des films avec l'IA"
            >✨</button>
          )}
          <button
            className="film-nav-btn"
            onClick={() => setFilmIndex(i => (i - 1 + filmPool.length) % filmPool.length)}
            disabled={filmPool.length <= 1}
          >←</button>
          <span className="film-nav-count">{filmIndex + 1} / {filmPool.length}</span>
          <button
            className="film-nav-btn"
            onClick={() => setFilmIndex(i => (i + 1) % filmPool.length)}
            disabled={filmPool.length <= 1}
          >→</button>
        </div>
      </div>

      {/* Corps */}
      <div className="fds-body">

        {/* Affiche */}
        <div className="fds-poster">
          {posterUrl
            ? <img src={posterUrl} alt={film.nom} className="fds-poster__img" />
            : <div className="fds-poster__placeholder">{drapeau(film.pays)}</div>
          }
        </div>

        {/* Infos */}
        <div className="fds-info">
          <div className="fds-info__nom">{film.nom}</div>
          {film.titre_original && film.titre_original !== film.nom && (
            <div className="fds-info__original">{film.titre_original}</div>
          )}
          <div className="fds-info__meta">
            {drapeau(film.pays)} {film.realisateur} · {film.annee} · {film.genre}
          </div>

          {/* Barre de score consensus + tier */}
          <div className="fds-score">
            <div className="album-carte__score-bar-wrap fds-score__bar-wrap">
              <div className="album-carte__score-bar" style={{ width: `${score}%` }} />
            </div>
            <span className={`album-carte__tier ${tier.classe}`}>{tier.label}</span>
          </div>

          {/* Scores externes */}
          {(film.score_rt != null || film.score_imdb != null || film.score_metacritic != null) && (
            <div className="fds-scores-ext">
              {film.score_rt != null && (
                <span className="fds-score-chip fds-score-chip--rt">
                  🍅 {film.score_rt}%
                </span>
              )}
              {film.score_imdb != null && (
                <span className="fds-score-chip fds-score-chip--imdb">
                  ⭐ {film.score_imdb}/10
                </span>
              )}
              {film.score_metacritic != null && (
                <span className="fds-score-chip fds-score-chip--meta">
                  M {film.score_metacritic}
                </span>
              )}
            </div>
          )}

          {topPalmares && (
            <div className="fds-palmares">{topPalmares}</div>
          )}

          {film.description && (
            <div className="fds-desc">
              <div className={`fds-desc__text${descExpand ? ' fds-desc__text--open' : ''}`}>
                {film.description}
              </div>
              <button className="day-album__desc-toggle" onClick={() => setDescExpand(v => !v)}>
                {descExpand ? 'Moins ▲' : 'Lire ▼'}
              </button>
            </div>
          )}

          <div className="fds-footer">
            <div className="album-carte__etoiles">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => handleEtoile(n)}
                  className={n <= note ? 'etoile etoile--active' : 'etoile'}
                  title={`${n} étoile${n > 1 ? 's' : ''}`}
                >★</button>
              ))}
            </div>
            {film.imdb_url && (
              <a href={film.imdb_url} target="_blank" rel="noopener noreferrer"
                className="album-apple-link">
                🎬 IMDB
              </a>
            )}
          </div>
        </div>
      </div>

      {showDecouverte && (
        <FilmDecouverteModal
          origineHint={origineActive}
          filmsExistants={tousFilms}
          onSauvegarderTous={liste => liste.forEach(f => onAjouterFilm(f))}
          onFermer={() => setShowDecouverte(false)}
        />
      )}
      {showAjout && (
        <FilmAjoutModal
          origineHint={origineActive}
          filmsExistants={tousFilms}
          onSauvegarder={f => { onAjouterFilm(f); setShowAjout(false); }}
          onFermer={() => setShowAjout(false)}
        />
      )}
    </div>
  );
}
