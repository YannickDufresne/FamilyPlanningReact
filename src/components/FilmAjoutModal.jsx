import { useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';

// ── Clés palmarès valides ──────────────────────────────────────────────────────
const PALMARES_VALIDES = [
  'cannes_palme_dor', 'cannes_grand_prix', 'cannes_jury', 'cannes_meilleur_realisateur',
  'cannes_meilleur_scenario', 'oscar_meilleur_film', 'oscar_etranger',
  'oscar_meilleur_film_animation', 'bafta', 'golden_globe', 'berlinale', 'venice',
  'toronto', 'sundance', 'cesar', 'iris', 'genie', 'imdb_top250', 'afi_top100', 'sight_sound',
];

const PALMARES_LABELS = {
  cannes_palme_dor:    'Palme d\'Or',
  cannes_grand_prix:   'Grand Prix Cannes',
  cannes_jury:         'Prix du Jury',
  cannes_meilleur_realisateur: 'Prix mise en scène',
  cannes_meilleur_scenario: 'Prix scénario',
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
  imdb_top250:         'IMDB Top 250',
  afi_top100:          'AFI Top 100',
  sight_sound:         'Sight & Sound',
};

function genererID(nom) {
  return 'custom_' + (nom || '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function FilmAjoutModal({ onSauvegarder, onFermer, filmsExistants = [], origineHint = null }) {
  const [titre, setTitre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [film, setFilm] = useState(null);

  async function rechercher() {
    if (!titre.trim()) return;
    const apiKey = localStorage.getItem('anthropic_key');
    if (!apiKey) {
      setError('Clé API Anthropic requise — configure-la dans la barre latérale (🔑).');
      return;
    }
    setLoading(true);
    setError(null);
    setFilm(null);

    const origineCtx = origineHint ? ` Ce film est lié à l'origine culturelle "${origineHint}" — assure-toi que origines_cinema le reflète.` : '';
    const prompt = `Tu es un expert en cinéma mondial. Pour le film "${titre.trim()}", génère un objet JSON complet.${origineCtx} Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour :

{
  "nom": "Titre en français (ou titre original si aucune traduction officielle)",
  "titre_original": "Titre dans la langue originale du film",
  "realisateur": "Prénom Nom du réalisateur principal",
  "annee": 1985,
  "pays": "Pays principal de production (ex: France, États-Unis, Japon, Corée du Sud)",
  "continent": "Amériques ou Europe ou Asie ou Afrique",
  "genre": "Genre principal (Drame, Comédie, Science-fiction, Thriller, Animation, Documentaire, etc.)",
  "langue": "Langue principale parlée dans le film",
  "duree": 120,
  "palmares": ["liste des prix RÉELLEMENT remportés parmi ces clés exactes: cannes_palme_dor, cannes_grand_prix, cannes_jury, cannes_meilleur_realisateur, cannes_meilleur_scenario, oscar_meilleur_film, oscar_etranger, oscar_meilleur_film_animation, bafta, golden_globe, berlinale, venice, toronto, sundance, cesar, iris, genie, imdb_top250, afi_top100, sight_sound"],
  "palmares_rangs": {"imdb_top250": 42, "sight_sound": 8},
  "score_consensus": 89,
  "incontournable": true,
  "origines_cinema": ["France"],
  "imdb_url": "https://www.imdb.com/title/tt0000000/",
  "description": "2-3 phrases poétiques en français liant ce film à une tradition culinaire ET à un style musical qui lui correspondent culturellement.",
  "rang_mondial": 150,
  "tags": ["tag pertinent 1", "tag pertinent 2"],
  "saisons": ["tout"]
}

Règles importantes :
- score_consensus : 0-100 basé sur le consensus critique (Rotten Tomatoes, Metacritic, Letterboxd, etc.)
- incontournable : true si score >= 90 OU si le film a remporté un grand prix international
- palmares : UNIQUEMENT les prix vraiment remportés (pas les nominations)
- palmares_rangs : uniquement pour imdb_top250 et sight_sound (rang numérique réel)
- saisons : ["tout"] par défaut, sauf si le film est fortement lié à une saison (["hiver"] pour films de Noël, etc.)
- description : mention d'un plat ou d'une pratique culinaire ET d'un style ou artiste musical lié au film`;

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 30000 });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Format JSON inattendu — réessaie.');
      const data = JSON.parse(match[0]);

      // Sanitize
      data.palmares = (data.palmares || []).filter(p => PALMARES_VALIDES.includes(p));
      data.palmares_rangs = data.palmares_rangs || {};
      data.tags = data.tags || [];
      data.saisons = data.saisons || ['tout'];
      data.poster_url = null;
      data.score_consensus = Math.max(0, Math.min(100, parseInt(data.score_consensus) || 70));
      data.annee = parseInt(data.annee) || new Date().getFullYear();
      data.duree = parseInt(data.duree) || null;
      data.incontournable = Boolean(data.incontournable);
      data.id = genererID(data.nom || titre);

      setFilm(data);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        setError('Clé API invalide — vérifie-la dans 🔑.');
      } else if (e instanceof Anthropic.APITimeoutError) {
        setError('Délai dépassé — réessaie dans un moment.');
      } else {
        setError(e.message || 'Erreur inattendue.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSauvegarder() {
    if (!film) return;
    const doublon = filmsExistants.find(
      f => f.id === film.id || f.nom.toLowerCase() === film.nom.toLowerCase()
    );
    if (doublon) {
      setError(`"${doublon.nom}" est déjà dans ta bibliothèque.`);
      return;
    }
    onSauvegarder(film);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="film-ajout-modal">

        <div className="film-ajout-modal__header">
          <h3 className="film-ajout-modal__titre">➕ Ajouter un film</h3>
          <button className="modal-close" style={{ position: 'static' }} onClick={onFermer}>✕</button>
        </div>

        <p className="film-ajout-modal__intro">
          Entre le titre d'un film — Claude remplira automatiquement toutes les métadonnées (réalisateur, palmarès, score, description avec liens cuisine &amp; musique).
        </p>
        {origineHint && (
          <div className="film-ajout-modal__hint">
            🌍 Origine culturelle ciblée : <strong>{origineHint}</strong>
          </div>
        )}

        <div className="film-ajout-modal__search">
          <input
            className="film-ajout-modal__input"
            type="text"
            value={titre}
            onChange={e => setTitre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && titre.trim() && rechercher()}
            placeholder="Ex: Parasite, Les 400 coups, Spirited Away…"
            autoFocus
          />
          <button
            className="film-ajout-modal__btn"
            onClick={rechercher}
            disabled={loading || !titre.trim()}
          >
            {loading ? '⏳ Recherche…' : '✨ Auto-remplir'}
          </button>
        </div>

        {error && <div className="film-ajout-modal__error">{error}</div>}

        {film && (
          <div className="film-ajout-preview">
            <div className="film-ajout-preview__grid">

              <label className="film-ajout-preview__label">Titre français</label>
              <input className="film-ajout-preview__input" value={film.nom}
                onChange={e => setFilm(f => ({ ...f, nom: e.target.value }))} />

              <label className="film-ajout-preview__label">Titre original</label>
              <input className="film-ajout-preview__input" value={film.titre_original || ''}
                onChange={e => setFilm(f => ({ ...f, titre_original: e.target.value }))} />

              <label className="film-ajout-preview__label">Réalisateur</label>
              <input className="film-ajout-preview__input" value={film.realisateur}
                onChange={e => setFilm(f => ({ ...f, realisateur: e.target.value }))} />

              <label className="film-ajout-preview__label">Année</label>
              <input className="film-ajout-preview__input" type="number" min="1888" max="2099"
                value={film.annee}
                onChange={e => setFilm(f => ({ ...f, annee: parseInt(e.target.value) || f.annee }))} />

              <label className="film-ajout-preview__label">Pays</label>
              <input className="film-ajout-preview__input" value={film.pays}
                onChange={e => setFilm(f => ({ ...f, pays: e.target.value }))} />

              <label className="film-ajout-preview__label">Genre</label>
              <input className="film-ajout-preview__input" value={film.genre}
                onChange={e => setFilm(f => ({ ...f, genre: e.target.value }))} />

              <label className="film-ajout-preview__label">Score critique</label>
              <div className="film-ajout-preview__score-row">
                <input type="range" min="0" max="100"
                  value={film.score_consensus}
                  onChange={e => setFilm(f => ({ ...f, score_consensus: parseInt(e.target.value) }))} />
                <span className="film-ajout-preview__score-val">{film.score_consensus}/100</span>
              </div>

              <label className="film-ajout-preview__label">Incontournable</label>
              <label className="film-ajout-preview__check">
                <input type="checkbox" checked={film.incontournable}
                  onChange={e => setFilm(f => ({ ...f, incontournable: e.target.checked }))} />
                <span>⭐ Classique incontournable</span>
              </label>

              <label className="film-ajout-preview__label">Lien IMDB</label>
              <input className="film-ajout-preview__input" value={film.imdb_url || ''}
                onChange={e => setFilm(f => ({ ...f, imdb_url: e.target.value }))} />

            </div>

            <label className="film-ajout-preview__label" style={{ marginTop: '10px', display: 'block' }}>
              Description
            </label>
            <textarea className="film-ajout-preview__textarea"
              value={film.description || ''}
              onChange={e => setFilm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />

            {film.palmares?.length > 0 && (
              <div className="film-ajout-preview__palmares">
                <div className="film-ajout-preview__label">Palmarès détecté</div>
                <div className="film-ajout-preview__chips">
                  {film.palmares.map(p => (
                    <span key={p} className="album-palmares-chip">
                      {PALMARES_LABELS[p] || p}
                      {film.palmares_rangs?.[p]
                        ? <span className="palmares-chip__rang"> #{film.palmares_rangs[p]}</span>
                        : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="film-ajout-preview__actions">
              <button className="film-ajout-preview__save" onClick={handleSauvegarder}>
                ✅ Ajouter à ma bibliothèque
              </button>
              <button className="film-ajout-preview__retry" onClick={rechercher} disabled={loading}>
                {loading ? '⏳…' : '↺ Regénérer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
