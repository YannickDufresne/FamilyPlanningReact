import { useState, useMemo, useEffect } from 'react';
import DayCard from './DayCard';
import { getFilmsCandidats, getFilmIndexInitial } from '../utils/filmSemaine';
import films from '../data/films.json';

// ── Palmares labels (mini) ─────────────────────────────────────────────────────
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
      return PALMARES_LABELS[p] + (rang ? ` #${rang}` : '');
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

function drapeauPays(pays) {
  return DRAPEAUX[pays] || '🌍';
}

// ── Poster Wikipedia ───────────────────────────────────────────────────────────
function useFilmPosterMini(film) {
  const [url, setUrl] = useState(film?.poster_url || null);

  useEffect(() => {
    if (!film) return;
    if (film.poster_url) { setUrl(film.poster_url); return; }
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

// ── Film de la semaine card ─────────────────────────────────────────────────────
function FilmSemaineCard({ pool, filmIndex, onPrev, onNext, filmRatings, onNoterFilm }) {
  const [descExpand, setDescExpand] = useState(false);

  const film = pool[filmIndex] || null;
  const posterUrl = useFilmPosterMini(film);

  // Reset desc expand when film changes
  useEffect(() => { setDescExpand(false); }, [filmIndex]);

  if (!film || pool.length === 0) return null;

  const note = filmRatings?.[film.id] ?? 0;
  const topPalmares = meilleurPalmares(film);

  function handleEtoile(n) {
    if (onNoterFilm) onNoterFilm(film.id, n === note ? 0 : n);
  }

  return (
    <div className="film-semaine-card">
      <div className="film-semaine-card__label">
        🎬 Film de la semaine
      </div>

      <div className="film-semaine-card__body">
        {/* Affiche */}
        <div className="film-semaine-card__poster-wrap">
          {posterUrl
            ? <img src={posterUrl} alt={film.nom} className="film-semaine-card__poster" />
            : <div className="film-semaine-card__poster-placeholder">{drapeauPays(film.pays)}</div>
          }
        </div>

        <div className="film-semaine-card__info">
          {/* Navigation ‹ N/total › */}
          <div className="film-semaine-card__nav">
            <button
              className="film-nav-btn"
              onClick={onPrev}
              disabled={pool.length <= 1}
              aria-label="Film précédent"
            >‹</button>
            <span className="film-nav-count">{filmIndex + 1}/{pool.length}</span>
            <button
              className="film-nav-btn"
              onClick={onNext}
              disabled={pool.length <= 1}
              aria-label="Film suivant"
            >›</button>
          </div>

          <div className="film-semaine-card__nom">{film.nom}</div>
          {film.titre_original && film.titre_original !== film.nom && (
            <div className="film-semaine-card__titre-original">{film.titre_original}</div>
          )}
          <div className="film-semaine-card__meta">
            {drapeauPays(film.pays)} {film.realisateur} · {film.annee}
          </div>
          <div className="film-semaine-card__genre">{film.genre}</div>

          {topPalmares && (
            <div className="film-semaine-card__palmares">{topPalmares}</div>
          )}

          {film.description && (
            <div className="film-semaine-card__desc-wrap">
              <div className={`day-album__desc${descExpand ? ' day-album__desc--open' : ''}`}>
                {film.description}
              </div>
              <button className="day-album__desc-toggle" onClick={() => setDescExpand(v => !v)}>
                {descExpand ? 'Moins ▲' : 'Lire ▼'}
              </button>
            </div>
          )}

          <div className="film-semaine-card__footer">
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
              <a href={film.imdb_url} target="_blank" rel="noopener noreferrer" className="album-apple-link">
                🎬 IMDB
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyPlanning({ planning, profils = [], joursVerrouilles = new Set(), joursAutoVerrouilles = new Set(), onToggleLockJour, lectureSeule, recettes = [], recettesForcees, recettesExplicites, onChoisirRecette, filtres = {}, ingredientsForces = [], onSauvegarderRecette, classiques, onToggleClassique, albumRatings = {}, filmRatings = {}, onNoterFilm, semaineDebut = '' }) {
  const [modesActivite, setModesActivite] = useState(() =>
    Object.fromEntries((planning || []).map(j => [j.jour, 'famille']))
  );

  const recettesSemaine = useMemo(
    () => (planning || []).map(j => j?.recette?.nom).filter(n => n && !n.startsWith('⚠️')),
    [planning]
  );

  // Origine culturelle active pour sélectionner le film
  const origineActive = filtres.origine && filtres.origine !== 'Tous' ? filtres.origine : null;

  // Liste des films candidats (filtrés par saison + origine)
  const filmPool = useMemo(
    () => getFilmsCandidats(semaineDebut, origineActive, films),
    [semaineDebut, origineActive]
  );

  // Index courant — déterministe par seed de semaine, navigable par l'utilisateur
  const [filmIndex, setFilmIndex] = useState(() =>
    getFilmIndexInitial(semaineDebut, filmPool)
  );

  // Recalculer l'index quand les filtres ou la semaine changent
  useEffect(() => {
    const pool = getFilmsCandidats(semaineDebut, origineActive, films);
    setFilmIndex(getFilmIndexInitial(semaineDebut, pool));
  }, [semaineDebut, origineActive]);

  function filmPrev() {
    setFilmIndex(i => (i - 1 + filmPool.length) % filmPool.length);
  }
  function filmNext() {
    setFilmIndex(i => (i + 1) % filmPool.length);
  }

  if (!planning) {
    return (
      <div className="alert-warning">
        <h5>⚠️ Planning impossible avec ces contraintes</h5>
        <ul>
          <li>Réduire le nombre de repas végétariens ou véganes</li>
          <li>Augmenter le coût maximum par recette</li>
          <li>Augmenter le temps total de cuisine</li>
          <li>Choisir une autre origine culturelle</li>
        </ul>
      </div>
    );
  }

  return (
    <section>
      <h2 className="section-heading">Calendrier de la semaine</h2>
      <div className="week-grid">
        {planning.map((jour, i) => (
          <DayCard
            key={jour.jour}
            jour={jour}
            index={i}
            modeActivite={modesActivite[jour.jour] ?? 'famille'}
            onToggleModeActivite={(mode) =>
              setModesActivite(prev => ({ ...prev, [jour.jour]: mode }))
            }
            profils={profils}
            estVerrouille={joursVerrouilles.has(i)}
            estAutoVerrouille={joursAutoVerrouilles.has(i)}
            onToggleLock={onToggleLockJour && !lectureSeule && !joursAutoVerrouilles.has(i) ? () => onToggleLockJour(i) : null}
            recettes={recettes}
            filtres={filtres}
            recetteForceNom={recettesExplicites?.has(i) ? (recettesForcees?.get(i) || null) : null}
            onChoisirRecette={onChoisirRecette ? (recetteNom) => onChoisirRecette(i, recetteNom) : null}
            ingredientsForces={ingredientsForces}
            onSauvegarderRecette={onSauvegarderRecette}
            recettesSemaine={recettesSemaine}
            classiques={classiques}
            onToggleClassique={onToggleClassique}
            albumRatings={albumRatings}
            jourIndex={(() => {
              let h = 5381;
              for (const c of semaineDebut) h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
              const weekSeed = h % 997;
              return i + weekSeed * 7;
            })()}
          />
        ))}
      </div>

      {/* Film de la semaine */}
      {filmPool.length > 0 && (
        <FilmSemaineCard
          pool={filmPool}
          filmIndex={filmIndex}
          onPrev={filmPrev}
          onNext={filmNext}
          filmRatings={filmRatings}
          onNoterFilm={onNoterFilm}
        />
      )}
    </section>
  );
}
