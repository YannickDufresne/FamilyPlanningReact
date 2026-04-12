import { useState, useMemo, useEffect } from 'react';
import films from '../data/films.json';
import FilmAjoutModal from './FilmAjoutModal';

// ── Drapeaux pays ──────────────────────────────────────────────────────────────
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

// ── Poster via Wikipedia ───────────────────────────────────────────────────────
function useFilmPoster(film) {
  const [url, setUrl] = useState(film.poster_url || null);

  useEffect(() => {
    if (film.poster_url) { setUrl(film.poster_url); return; }
    let cancelled = false;

    async function fetchPoster() {
      // Titres à essayer (fr wiki puis en wiki)
      const titresFr = [film.nom];
      const titresEn = [film.nom];
      if (film.titre_original && film.titre_original !== film.nom) {
        titresFr.push(film.titre_original);
        titresEn.push(film.titre_original);
      }

      const tries = [
        ...titresFr.map(t => ['fr', t]),
        ...titresEn.map(t => ['en', t]),
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
  }, [film.id, film.nom, film.titre_original, film.poster_url]);

  return url;
}

// ── Continents ─────────────────────────────────────────────────────────────────
const CONTINENTS = [
  { val: 'Tout', label: 'Tout' },
  { val: 'Amériques', label: 'Amériques' },
  { val: 'Europe', label: 'Europe' },
  { val: 'Asie', label: 'Asie' },
  { val: 'Afrique', label: 'Afrique' },
];

// ── Décennies ──────────────────────────────────────────────────────────────────
const DECADES = [
  { val: 'Tout', label: 'Tout' },
  { val: '1920', label: '1920s' },
  { val: '1940', label: '40s' },
  { val: '1950', label: '50s' },
  { val: '1960', label: '60s' },
  { val: '1970', label: '70s' },
  { val: '1980', label: '80s' },
  { val: '1990', label: '90s' },
  { val: '2000', label: '2000s' },
  { val: '2010', label: '2010s+' },
];

function decadeOf(annee) {
  return String(Math.floor(annee / 10) * 10);
}

// ── Score tier ─────────────────────────────────────────────────────────────────
function tierScore(score) {
  if (score >= 97) return { label: 'Légendaire',     classe: 'tier--legendaire' };
  if (score >= 92) return { label: 'Incontournable', classe: 'tier--incontournable' };
  if (score >= 85) return { label: 'Essentiel',      classe: 'tier--essentiel' };
  if (score >= 78) return { label: 'Reconnu',        classe: 'tier--reconnu' };
  return                   { label: 'Remarquable',   classe: 'tier--remarquable' };
}

// ── Palmares labels ────────────────────────────────────────────────────────────
const PALMARES_LABELS = {
  imdb_top250:         'IMDB Top 250',
  sight_sound:         'Sight & Sound',
  afi_top100:          'AFI Top 100',
  cannes_palme_dor:    'Palme d\'Or',
  cannes_grand_prix:   'Grand Prix Cannes',
  cannes_jury:         'Prix du Jury',
  cannes_meilleur_realisateur: 'Prix mise en scène',
  cannes_meilleur_scenario: 'Prix scénario Cannes',
  oscar_meilleur_film: 'Oscar Meilleur Film',
  oscar_etranger:      'Oscar Film Étranger',
  oscar_meilleur_film_animation: 'Oscar Animation',
  bafta:               'BAFTA',
  golden_globe:        'Golden Globe',
  berlinale:           'Ours d\'Or Berlin',
  venice:              'Lion d\'Or Venise',
  toronto:             'Prix public TIFF',
  sundance:            'Sundance',
  cesar:               'César',
  iris:                'Prix Iris',
  genie:               'Prix Genie',
  cannes:              'Cannes',
};

// ── Carte film ─────────────────────────────────────────────────────────────────
function FilmCarte({ film, ratings, onNoter }) {
  const [descExpand, setDescExpand] = useState(false);
  const note = ratings[film.id] ?? 0;
  const tier = tierScore(film.score_consensus ?? 70);
  const scoreBar = Math.max(0, Math.min(100, film.score_consensus ?? 70));
  const posterUrl = useFilmPoster(film);

  function handleEtoile(n) {
    onNoter(film.id, n === note ? 0 : n);
  }

  return (
    <div className={`film-carte${film.incontournable ? ' film-carte--incon' : ''}`}>
      {/* Affiche */}
      {posterUrl
        ? <img src={posterUrl} alt={film.nom} className="film-carte__poster" loading="lazy" />
        : <div className="film-carte__poster-placeholder">{drapeauPays(film.pays)}</div>
      }

      {/* En-tête */}
      <div className="film-carte__header">
        <div className="film-carte__flag">{drapeauPays(film.pays)}</div>
        <div className="film-carte__info">
          <div className="film-carte__nom">{film.nom}</div>
          {film.titre_original && film.titre_original !== film.nom && (
            <div className="film-carte__titre-original">{film.titre_original}</div>
          )}
          <div className="film-carte__realisateur">{film.realisateur} · {film.annee}</div>
        </div>
        {film.incontournable && <span className="film-carte__incon-badge">⭐</span>}
      </div>

      {/* Meta */}
      <div className="film-carte__meta">
        <span className="film-carte__pays">{film.pays}</span>
        <span className="film-carte__genre">{film.genre}</span>
        {film.duree && <span className="film-carte__duree">{film.duree} min</span>}
      </div>

      {/* Score */}
      <div className="album-carte__score-bloc">
        <div className="album-carte__score-bar-wrap">
          <div className="album-carte__score-bar" style={{ width: `${scoreBar}%` }} />
        </div>
        <span className={`album-carte__tier ${tier.classe}`}>{tier.label}</span>
      </div>

      {/* Palmares */}
      {film.palmares?.length > 0 && (
        <div className="album-carte__palmares">
          {film.palmares.map(p => {
            const rang = film.palmares_rangs?.[p];
            return (
              <span key={p} className="album-palmares-chip">
                {PALMARES_LABELS[p] || p}
                {rang ? <span className="palmares-chip__rang"> #{rang}</span> : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* Description */}
      {film.description && (
        <div className="film-carte__desc-wrap">
          <div className={`day-album__desc${descExpand ? ' day-album__desc--open' : ''}`}>
            {film.description}
          </div>
          <button
            className="day-album__desc-toggle"
            onClick={() => setDescExpand(v => !v)}
          >
            {descExpand ? 'Moins ▲' : 'Lire ▼'}
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="album-carte__footer">
        <div className="album-carte__etoiles">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => handleEtoile(n)}
              className={n <= note ? 'etoile etoile--active' : 'etoile'}
              title={n === note ? 'Retirer la note' : `Donner ${n} étoile${n > 1 ? 's' : ''}`}
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
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function FilmsPage({ onRetour, ratings = {}, onNoter, filmsCustom = [], onAjouterFilm }) {
  const [continent, setContinent] = useState('Tout');
  const [decade, setDecade] = useState('Tout');
  const [tri, setTri] = useState('consensus');
  const [seulementNotes, setSeulementNotes] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [showAjout, setShowAjout] = useState(false);

  const tousFilms = useMemo(() => [...films, ...filmsCustom], [filmsCustom]);

  const filmsFiltres = useMemo(() => {
    let liste = [...tousFilms];

    if (continent !== 'Tout') {
      liste = liste.filter(f => f.continent === continent);
    }
    if (decade !== 'Tout') {
      liste = liste.filter(f => decadeOf(f.annee) === decade || (decade === '2010' && f.annee >= 2010));
    }
    if (seulementNotes) {
      liste = liste.filter(f => (ratings[f.id] ?? 0) > 0);
    }
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      liste = liste.filter(f =>
        f.nom.toLowerCase().includes(q) ||
        (f.titre_original || '').toLowerCase().includes(q) ||
        f.realisateur.toLowerCase().includes(q) ||
        f.pays.toLowerCase().includes(q) ||
        f.genre.toLowerCase().includes(q)
      );
    }

    if (tri === 'consensus') {
      liste.sort((a, b) => (b.score_consensus ?? 0) - (a.score_consensus ?? 0));
    } else if (tri === 'coups_de_coeur') {
      liste.sort((a, b) => {
        const ra = ratings[a.id] ?? 0, rb = ratings[b.id] ?? 0;
        if (rb !== ra) return rb - ra;
        return (b.score_consensus ?? 0) - (a.score_consensus ?? 0);
      });
    } else if (tri === 'annee') {
      liste.sort((a, b) => b.annee - a.annee);
    }

    return liste;
  }, [continent, decade, tri, seulementNotes, recherche, ratings, tousFilms]);

  const nbNotes = Object.values(ratings).filter(v => v > 0).length;

  return (
    <div className="albums-page">
      <div className="albums-page__header">
        <button className="acti-retour" onClick={onRetour}>← Retour</button>
        <div style={{ flex: 1 }}>
          <h2 className="albums-page__titre">Bibliothèque de films</h2>
          <p className="acti-page__intro">
            <strong>{filmsFiltres.length}</strong> film{filmsFiltres.length > 1 ? 's' : ''} sur {tousFilms.length}
            {filmsCustom.length > 0 && ` · ${filmsCustom.length} ajouté${filmsCustom.length > 1 ? 's' : ''}`}
            {nbNotes > 0 && ` · ${nbNotes} noté${nbNotes > 1 ? 's' : ''}`}
          </p>
        </div>
        {onAjouterFilm && (
          <button className="film-ajout-trigger" onClick={() => setShowAjout(true)}>
            ➕ Ajouter un film
          </button>
        )}
      </div>

      {/* Recherche */}
      <div className="albums-recherche">
        <input
          className="albums-recherche__input"
          type="text"
          placeholder="Rechercher un film, réalisateur, pays..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
        {recherche && (
          <button className="albums-recherche__clear" onClick={() => setRecherche('')}>✕</button>
        )}
      </div>

      {/* Filtres continent */}
      <div className="albums-filtres">
        <span className="albums-filtres__label">Région</span>
        <div className="albums-filtres__groupe">
          {CONTINENTS.map(c => (
            <button
              key={c.val}
              className={`albums-filtre-btn${continent === c.val ? ' albums-filtre-btn--active' : ''}`}
              onClick={() => setContinent(c.val)}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {/* Filtres décennie */}
      <div className="albums-filtres">
        <span className="albums-filtres__label">Époque</span>
        <div className="albums-filtres__groupe">
          {DECADES.map(d => (
            <button
              key={d.val}
              className={`albums-filtre-btn${decade === d.val ? ' albums-filtre-btn--active' : ''}`}
              onClick={() => setDecade(d.val)}
            >{d.label}</button>
          ))}
        </div>
      </div>

      {/* Tri + toggle */}
      <div className="albums-controles">
        <div className="albums-tri">
          <span className="albums-filtres__label">Trier par</span>
          {[
            { val: 'consensus', label: 'Consensus critique' },
            { val: 'coups_de_coeur', label: 'Mes coups de cœur' },
            { val: 'annee', label: 'Année' },
          ].map(t => (
            <button
              key={t.val}
              className={`albums-filtre-btn${tri === t.val ? ' albums-filtre-btn--active' : ''}`}
              onClick={() => setTri(t.val)}
            >{t.label}</button>
          ))}
        </div>
        <label className="albums-toggle">
          <input type="checkbox" checked={seulementNotes} onChange={e => setSeulementNotes(e.target.checked)} />
          <span>Seulement mes évaluations</span>
        </label>
      </div>

      {/* Grille */}
      {filmsFiltres.length === 0 ? (
        <div className="albums-vide">Aucun film ne correspond à ces critères.</div>
      ) : (
        <div className="albums-grille films-grille">
          {filmsFiltres.map(film => (
            <FilmCarte key={film.id} film={film} ratings={ratings} onNoter={onNoter} />
          ))}
        </div>
      )}

      {showAjout && (
        <FilmAjoutModal
          filmsExistants={tousFilms}
          onSauvegarder={(film) => {
            if (onAjouterFilm) onAjouterFilm(film);
            setShowAjout(false);
          }}
          onFermer={() => setShowAjout(false)}
        />
      )}
    </div>
  );
}
