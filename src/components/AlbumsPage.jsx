import { useState, useMemo } from 'react';
import albums from '../data/albums.json';

// ── Drapeaux pays ─────────────────────────────────────────────────────────────
const DRAPEAUX = {
  'États-Unis': '🇺🇸', 'Royaume-Uni': '🇬🇧', 'France': '🇫🇷', 'Canada': '🇨🇦',
  'Japon': '🇯🇵', 'Brésil': '🇧🇷', 'Allemagne': '🇩🇪', 'Italie': '🇮🇹',
  'Espagne': '🇪🇸', 'Mexique': '🇲🇽', 'Cuba': '🇨🇺', 'Argentine': '🇦🇷',
  'Chili': '🇨🇱', 'Nigeria': '🇳🇬', 'Mali': '🇲🇱', 'Sénégal': '🇸🇳',
  'Afrique du Sud': '🇿🇦', 'Éthiopie': '🇪🇹', 'Égypte': '🇪🇬', 'Tunisie': '🇹🇳',
  'Algérie': '🇩🇿', 'Maroc': '🇲🇦', 'Liban': '🇱🇧', 'Turquie': '🇹🇷',
  'Syrie': '🇸🇾', 'Iran': '🇮🇷', 'Pakistan': '🇵🇰', 'Inde': '🇮🇳',
  'Corée du Sud': '🇰🇷', 'Chine': '🇨🇳', 'Taïwan': '🇹🇼', 'Viêtnam': '🇻🇳',
  'Thaïlande': '🇹🇭', 'Islande': '🇮🇸', 'Norvège': '🇳🇴', 'Suède': '🇸🇪',
  'Portugal': '🇵🇹', 'Australie': '🇦🇺', 'Haïti': '🇭🇹', 'Jamaïque': '🇯🇲',
  'Porto Rico': '🇵🇷', 'Venezuela': '🇻🇪',
  'Hawaï (États-Unis)': '🇺🇸',
};

function drapeauPays(pays) {
  return DRAPEAUX[pays] || '🌍';
}

// ── Continents pour filtre ────────────────────────────────────────────────────
const CONTINENTS = [
  { val: 'Tout', label: 'Tout' },
  { val: 'Amériques', label: 'Amériques' },
  { val: 'Europe', label: 'Europe' },
  { val: 'Asie', label: 'Asie' },
  { val: 'Afrique', label: 'Afrique' },
  { val: 'Moyen-Orient', label: 'Moyen-Orient' },
  { val: 'Océanie', label: 'Océanie' },
];

// ── Décennies ─────────────────────────────────────────────────────────────────
const DECADES = [
  { val: 'Tout', label: 'Tout' },
  { val: '1950', label: '1950s' },
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

// ── Carte album ───────────────────────────────────────────────────────────────
function AlbumCarte({ album, ratings, onNoter }) {
  const note = ratings[album.id] ?? 0;

  function handleEtoile(n) {
    if (n === note) {
      onNoter(album.id, 0); // désélectionner
    } else {
      onNoter(album.id, n);
    }
  }

  return (
    <div className={`album-carte${album.incontournable ? ' album-carte--incon' : ''}`}>
      <div className="album-carte__top">
        <div className="album-carte__info">
          <div className="album-carte__nom">{album.nom}</div>
          <div className="album-carte__artiste">{album.artiste}</div>
        </div>
        <div className="album-carte__annee">{album.annee}</div>
      </div>

      <div className="album-carte__meta">
        <span className="album-carte__pays">{drapeauPays(album.pays)} {album.pays}</span>
        <span className="album-carte__genre">{album.genre}</span>
      </div>

      {album.description && (
        <div className="album-carte__desc">{album.description}</div>
      )}

      <div className="album-carte__footer">
        <div className="album-carte__etoiles">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => handleEtoile(n)}
              className={n <= note ? 'etoile etoile--active' : 'etoile'}
              title={n <= note && n === note ? 'Retirer la note' : `Donner ${n} étoile${n > 1 ? 's' : ''}`}
            >★</button>
          ))}
        </div>
        <div className="album-carte__actions">
          {album.url_apple_music && (
            <a
              href={album.url_apple_music}
              target="_blank"
              rel="noopener noreferrer"
              className="album-apple-link"
            >🎵 Apple Music</a>
          )}
          {album.incontournable && (
            <span className="album-badge--incon">⭐ Incontournable</span>
          )}
          {album.score_consensus != null && (
            <span className="album-badge--score">{album.score_consensus}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AlbumsPage({ onRetour, ratings = {}, onNoter }) {
  const [continent, setContinent] = useState('Tout');
  const [decade, setDecade] = useState('Tout');
  const [tri, setTri] = useState('consensus'); // 'consensus' | 'coups_de_coeur' | 'annee'
  const [seulementNotes, setSeulementNotes] = useState(false);
  const [recherche, setRecherche] = useState('');

  const albumsFiltres = useMemo(() => {
    let liste = [...albums];

    // Filtre continent
    if (continent !== 'Tout') {
      liste = liste.filter(a => a.continent === continent);
    }

    // Filtre décennie
    if (decade !== 'Tout') {
      liste = liste.filter(a => decadeOf(a.annee) === decade || (decade === '2010' && a.annee >= 2010));
    }

    // Filtre seulement notés
    if (seulementNotes) {
      liste = liste.filter(a => (ratings[a.id] ?? 0) > 0);
    }

    // Recherche texte
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      liste = liste.filter(a =>
        a.nom.toLowerCase().includes(q) ||
        a.artiste.toLowerCase().includes(q) ||
        a.pays.toLowerCase().includes(q) ||
        a.genre.toLowerCase().includes(q)
      );
    }

    // Tri
    if (tri === 'consensus') {
      liste.sort((a, b) => (b.score_consensus ?? 0) - (a.score_consensus ?? 0));
    } else if (tri === 'coups_de_coeur') {
      liste.sort((a, b) => {
        const ra = ratings[a.id] ?? 0;
        const rb = ratings[b.id] ?? 0;
        if (rb !== ra) return rb - ra;
        return (b.score_consensus ?? 0) - (a.score_consensus ?? 0);
      });
    } else if (tri === 'annee') {
      liste.sort((a, b) => b.annee - a.annee);
    }

    return liste;
  }, [continent, decade, tri, seulementNotes, recherche, ratings]);

  const nbNotes = Object.values(ratings).filter(v => v > 0).length;

  return (
    <div className="albums-page">
      {/* En-tête */}
      <div className="albums-page__header">
        <button className="acti-retour" onClick={onRetour}>← Retour</button>
        <div style={{ flex: 1 }}>
          <h2 className="albums-page__titre">Bibliothèque musicale</h2>
          <p className="acti-page__intro">
            <strong>{albumsFiltres.length}</strong> album{albumsFiltres.length > 1 ? 's' : ''} sur {albums.length}
            {nbNotes > 0 && ` · ${nbNotes} noté${nbNotes > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="albums-recherche">
        <input
          className="albums-recherche__input"
          type="text"
          placeholder="Rechercher un album, artiste, pays..."
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

      {/* Contrôles tri + toggle */}
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
          <input
            type="checkbox"
            checked={seulementNotes}
            onChange={e => setSeulementNotes(e.target.checked)}
          />
          <span>Seulement mes évaluations</span>
        </label>
      </div>

      {/* Grille d'albums */}
      {albumsFiltres.length === 0 ? (
        <div className="albums-vide">Aucun album ne correspond à ces critères.</div>
      ) : (
        <div className="albums-grille">
          {albumsFiltres.map(album => (
            <AlbumCarte
              key={album.id}
              album={album}
              ratings={ratings}
              onNoter={onNoter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
