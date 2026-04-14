import { useState, useMemo, useEffect } from 'react';
import albums from '../data/albums.json';
import AlbumAjoutModal from './AlbumAjoutModal';

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

// ── Fetch artwork iTunes (fallback si artwork_url absent) ─────────────────────
function useArtworkFallback(artiste, nom, existingUrl) {
  const [url, setUrl] = useState(existingUrl || null);
  useEffect(() => {
    if (existingUrl || !artiste || !nom) return;
    let cancelled = false;
    const terme = encodeURIComponent(`${artiste} ${nom}`);
    const artistMots = artiste.toLowerCase().split(/\s+/).slice(0, 2);
    const validMatch = r => r.artworkUrl100 &&
      artistMots.some(mot => mot.length >= 3 && r.artistName?.toLowerCase().includes(mot));

    async function fetchArtwork() {
      for (const country of ['ca', 'us', 'jp', 'gb', 'fr', 'br']) {
        if (cancelled) return;
        try {
          const res = await fetch(`https://itunes.apple.com/search?term=${terme}&entity=album&limit=5&country=${country}`);
          const d = await res.json();
          const match = (d.results || []).find(validMatch);
          if (match) { if (!cancelled) setUrl(match.artworkUrl100.replace('100x100bb', '400x400bb')); return; }
        } catch (_) {}
      }
    }
    fetchArtwork();
    return () => { cancelled = true; };
  }, [artiste, nom, existingUrl]);
  return url;
}

// ── Tier de reconnaissance ────────────────────────────────────────────────────
function tierScore(score) {
  if (score >= 95) return { label: 'Légendaire',     classe: 'tier--legendaire'     };
  if (score >= 85) return { label: 'Incontournable', classe: 'tier--incontournable' };
  if (score >= 75) return { label: 'Essentiel',      classe: 'tier--essentiel'      };
  if (score >= 65) return { label: 'Reconnu',        classe: 'tier--reconnu'        };
  return                   { label: 'Remarquable',   classe: 'tier--remarquable'    };
}

// ── Labels pour les palmarès ──────────────────────────────────────────────────
const PALMARES_LABELS = {
  rolling_stone_1:          'RS #1',
  rolling_stone_top10:      'RS Top 10',
  rolling_stone_top50:      'RS Top 50',
  rolling_stone_top500:     'Rolling Stone 500',
  rs_500:                   'Rolling Stone 500',
  acclaimed_music:          'Acclaimed Music',
  acclaimed_top100:         'Acclaimed Top 100',
  rate_your_music:          'Rate Your Music',
  rym_top50:                'RYM Top 50',
  pitchfork:                'Pitchfork',
  pitchfork_top100:         'Pitchfork Top 100',
  nme:                      'NME',
  grammy_hall_of_fame:      'Grammy HOF',
  ecm:                      'Label ECM',
  ecm_essential:            'ECM Essential',
  songlines:                'Songlines',
  womex:                    'WOMEX',
};

// ── Carte album ───────────────────────────────────────────────────────────────
function AlbumCarte({ album, ratings, onNoter, isCustom, onSupprimer }) {
  const [confirming, setConfirming] = useState(false);
  const note = ratings[album.id] ?? 0;

  function handleDeleteClick() {
    if (confirming) { onSupprimer(album.id); }
    else { setConfirming(true); setTimeout(() => setConfirming(false), 4000); }
  }
  const artworkUrl = useArtworkFallback(album.artiste, album.nom, album.artwork_url);
  const tier = tierScore(album.score_consensus ?? 60);

  function handleEtoile(n) {
    if (n === note) {
      onNoter(album.id, 0); // désélectionner
    } else {
      onNoter(album.id, n);
    }
  }

  const scoreBar = Math.max(0, Math.min(100, album.score_consensus ?? 60));

  return (
    <div className={`album-carte${album.incontournable ? ' album-carte--incon' : ''}`}>
      {/* Artwork */}
      <div className="album-carte__artwork">
        {artworkUrl
          ? <img src={artworkUrl} alt={album.nom} loading="lazy" />
          : <div className="album-carte__artwork-placeholder">{drapeauPays(album.pays)}</div>
        }
        {album.incontournable && <span className="album-carte__incon-badge">⭐</span>}
      </div>

      {/* Infos principales */}
      <div className="album-carte__body">
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

        {/* Indice de reconnaissance */}
        <div className="album-carte__score-bloc">
          <div className="album-carte__score-bar-wrap">
            <div className="album-carte__score-bar" style={{ width: `${scoreBar}%` }} />
          </div>
          <span className={`album-carte__tier ${tier.classe}`}>{tier.label}</span>
          {album.rang_mondial && (
            <span className="album-carte__rang">Top {album.rang_mondial} mondial</span>
          )}
        </div>

        {/* Palmarès */}
        {album.palmares?.length > 0 && (
          <div className="album-carte__palmares">
            {album.palmares.map(p => {
              const rang = album.palmares_rangs?.[p];
              return (
                <span key={p} className="album-palmares-chip">
                  {PALMARES_LABELS[p] || p}
                  {rang ? <span className="palmares-chip__rang"> #{rang}</span> : ''}
                </span>
              );
            })}
          </div>
        )}

        {/* Description / fun fact */}
        {album.description && (
          <div className="album-carte__desc">{album.description}</div>
        )}

        {/* Footer */}
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
          {album.url_apple_music && (
            <a href={album.url_apple_music} target="_blank" rel="noopener noreferrer" className="album-apple-link">
              🎵 Écouter
            </a>
          )}
          {isCustom && onSupprimer && (
            confirming
              ? <button className="carte-del-btn carte-del-btn--confirm" onClick={handleDeleteClick}>Supprimer ?</button>
              : <button className="carte-del-btn" onClick={handleDeleteClick} title="Supprimer cet album">🗑</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function AlbumsPage({ onRetour, ratings = {}, onNoter, albumsCustom = [], onAjouterAlbum, onSupprimerAlbum }) {
  const [continent, setContinent] = useState('Tout');
  const [showAjout, setShowAjout] = useState(false);
  const [decade, setDecade] = useState('Tout');
  const [tri, setTri] = useState('consensus'); // 'consensus' | 'coups_de_coeur' | 'annee'
  const [seulementNotes, setSeulementNotes] = useState(false);
  const [recherche, setRecherche] = useState('');

  const tousAlbums = useMemo(() => [...albums, ...albumsCustom], [albumsCustom]);

  const albumsFiltres = useMemo(() => {
    let liste = [...tousAlbums];

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
  }, [continent, decade, tri, seulementNotes, recherche, ratings, tousAlbums]);

  const nbNotes = Object.values(ratings).filter(v => v > 0).length;

  return (
    <div className="albums-page">
      {/* En-tête */}
      <div className="albums-page__header">
        <button className="acti-retour" onClick={onRetour}>← Retour</button>
        <div style={{ flex: 1 }}>
          <h2 className="albums-page__titre">Bibliothèque musicale</h2>
          <p className="acti-page__intro">
            <strong>{albumsFiltres.length}</strong> album{albumsFiltres.length > 1 ? 's' : ''} sur {tousAlbums.length}
            {albumsCustom.length > 0 && ` · ${albumsCustom.length} ajouté${albumsCustom.length > 1 ? 's' : ''}`}
            {nbNotes > 0 && ` · ${nbNotes} noté${nbNotes > 1 ? 's' : ''}`}
          </p>
        </div>
        {onAjouterAlbum && (
          <button className="film-ajout-trigger" onClick={() => setShowAjout(true)}>
            ➕ Ajouter un album
          </button>
        )}
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
              isCustom={albumsCustom.some(a => a.id === album.id)}
              onSupprimer={onSupprimerAlbum}
            />
          ))}
        </div>
      )}

      {showAjout && (
        <AlbumAjoutModal
          albumsExistants={tousAlbums}
          onSauvegarder={(album) => { if (onAjouterAlbum) onAjouterAlbum(album); setShowAjout(false); }}
          onFermer={() => setShowAjout(false)}
        />
      )}
    </div>
  );
}
