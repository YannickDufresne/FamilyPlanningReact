import { useState, useMemo } from 'react';
import DayCard from './DayCard';
import { choisirFilmDeSemaine } from '../utils/filmSemaine';
import films from '../data/films.json';

// ── Palmares labels (mini) ─────────────────────────────────────────────────────
const PALMARES_LABELS = {
  cannes_palme_dor:    'Palme d\'Or',
  cannes_grand_prix:   'Grand Prix Cannes',
  cannes_jury:         'Prix Jury Cannes',
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

// ── Film de la semaine card ─────────────────────────────────────────────────────
function FilmSemaineCard({ film, filmRatings, onNoterFilm }) {
  const [descExpand, setDescExpand] = useState(false);
  if (!film) return null;

  const note = filmRatings?.[film.id] ?? 0;
  const topPalmares = meilleurPalmares(film);

  function handleEtoile(n) {
    if (onNoterFilm) onNoterFilm(film.id, n === note ? 0 : n);
  }

  return (
    <div className="film-semaine-card">
      <div className="film-semaine-card__label">🎬 Film de la semaine</div>
      <div className="film-semaine-card__body">
        <div className="film-semaine-card__flag">{drapeauPays(film.pays)}</div>
        <div className="film-semaine-card__info">
          <div className="film-semaine-card__nom">{film.nom}</div>
          {film.titre_original && film.titre_original !== film.nom && (
            <div className="film-semaine-card__titre-original">{film.titre_original}</div>
          )}
          <div className="film-semaine-card__meta">
            {film.realisateur} · {film.annee} · {film.pays}
          </div>
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

  const filmSemaine = useMemo(
    () => choisirFilmDeSemaine(semaineDebut, origineActive, films, filmRatings),
    [semaineDebut, origineActive, filmRatings]
  );

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
      {filmSemaine && (
        <FilmSemaineCard
          film={filmSemaine}
          filmRatings={filmRatings}
          onNoterFilm={onNoterFilm}
        />
      )}
    </section>
  );
}
