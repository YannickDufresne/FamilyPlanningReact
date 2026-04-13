import { useState, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';

const PALMARES_VALIDES = [
  'cannes_palme_dor', 'cannes_grand_prix', 'cannes_jury', 'cannes_meilleur_realisateur',
  'cannes_meilleur_scenario', 'oscar_meilleur_film', 'oscar_etranger',
  'oscar_meilleur_film_animation', 'bafta', 'golden_globe', 'berlinale', 'venice',
  'toronto', 'sundance', 'cesar', 'iris', 'jutra', 'genie', 'imdb_top250', 'afi_top100',
  'sight_sound', 'japan_critics', 'silver_bear',
];

const PALMARES_LABELS = {
  cannes_palme_dor: 'Palme d\'Or', oscar_meilleur_film: 'Oscar Meilleur Film',
  oscar_etranger: 'Oscar Film Étranger', berlinale: 'Ours d\'Or Berlin',
  venice: 'Lion d\'Or Venise', sight_sound: 'Sight & Sound',
  imdb_top250: 'IMDB Top 250', jutra: 'Prix Jutra', iris: 'Prix Iris',
  cesar: 'César', silver_bear: 'Ours d\'argent',
};

function genererID(nom) {
  return 'custom_' + (nom || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function sanitizeFilm(data) {
  data.palmares = (data.palmares || []).filter(p => PALMARES_VALIDES.includes(p));
  data.palmares_rangs = data.palmares_rangs || {};
  data.tags = data.tags || [];
  data.saisons = data.saisons || ['tout'];
  data.poster_url = null;
  data.score_consensus = Math.max(0, Math.min(100, parseInt(data.score_consensus) || 70));
  data.score_rt = data.score_rt != null ? parseInt(data.score_rt) : null;
  data.score_imdb = data.score_imdb != null ? parseFloat(data.score_imdb) : null;
  data.score_metacritic = data.score_metacritic != null ? parseInt(data.score_metacritic) : null;
  data.annee = parseInt(data.annee) || new Date().getFullYear();
  data.duree = parseInt(data.duree) || null;
  data.incontournable = Boolean(data.incontournable);
  data.id = genererID(data.nom);
  return data;
}

export default function FilmDecouverteModal({ origineHint, filmsExistants = [], onSauvegarderTous, onFermer }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selection, setSelection] = useState(new Set());

  useEffect(() => { decouvrir(); }, []);

  async function decouvrir() {
    const apiKey = localStorage.getItem('anthropic_key');
    if (!apiKey) {
      setError('Clé API Anthropic requise — configure-la dans la barre latérale (🔑).');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSelection(new Set());

    const exIds = new Set(filmsExistants.map(f => f.id));

    const prompt = `Tu es un expert en cinéma mondial. Recommande 3 films exceptionnels liés à l'origine culturelle "${origineHint}".

Critères de sélection :
- Très haute qualité critique (score consensus ≥ 85)
- Mix obligatoire : au moins 1 classique intemporel (avant 2000) ET au moins 1 film récent (après 2005)
- Films ayant une résonance culturelle forte avec "${origineHint}"
- Priorité aux films primés (Cannes, Oscars, Berlinale, Venise, etc.)
- Inclure des films peu connus mais remarquables, pas seulement les plus célèbres

Réponds UNIQUEMENT avec un tableau JSON de 3 objets, sans markdown :
[
  {
    "nom": "Titre en français (ou titre original si aucune traduction officielle)",
    "titre_original": "Titre dans la langue originale",
    "realisateur": "Prénom Nom",
    "annee": 1993,
    "pays": "Pays principal de production",
    "continent": "Amériques ou Europe ou Asie ou Afrique",
    "genre": "Genre principal",
    "langue": "Langue principale",
    "duree": 120,
    "palmares": ["clés exactes parmi: cannes_palme_dor, cannes_grand_prix, cannes_jury, cannes_meilleur_realisateur, cannes_meilleur_scenario, oscar_meilleur_film, oscar_etranger, oscar_meilleur_film_animation, bafta, golden_globe, berlinale, venice, toronto, sundance, cesar, iris, jutra, genie, imdb_top250, afi_top100, sight_sound, japan_critics, silver_bear"],
    "palmares_rangs": {"imdb_top250": 42, "sight_sound": 8},
    "score_consensus": 92,
    "score_rt": 97,
    "score_imdb": 8.2,
    "score_metacritic": 89,
    "incontournable": true,
    "origines_cinema": ["${origineHint}"],
    "imdb_url": "https://www.imdb.com/title/tt0000000/",
    "description": "2-3 phrases en français liant ce film à une tradition culinaire ET à un style musical de son origine culturelle.",
    "rang_mondial": 200,
    "tags": ["tag1", "tag2"],
    "saisons": ["tout"]
  }
]

Règles strictes :
- palmares : UNIQUEMENT les prix vraiment remportés (pas les nominations)
- score_rt et score_imdb : valeurs réelles connues, null si vraiment inconnu
- description : toujours mentionner un plat ou pratique culinaire ET un style/artiste musical
- saisons : ["tout"] sauf film fortement saisonnier`;

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 45000 });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Format JSON inattendu — réessaie.');
      let data = JSON.parse(match[0]);

      data = data.map(sanitizeFilm).filter(f => !exIds.has(f.id));

      if (data.length === 0) {
        setError('Tous ces films sont déjà dans ta bibliothèque !');
      } else {
        setSuggestions(data);
        setSelection(new Set(data.map(f => f.id))); // tout sélectionné par défaut
      }
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        setError('Clé API invalide — vérifie-la dans 🔑.');
      } else if (e instanceof Anthropic.APITimeoutError) {
        setError('Délai dépassé — réessaie.');
      } else {
        setError(e.message || 'Erreur inattendue.');
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id) {
    setSelection(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAjouter() {
    const choisis = suggestions.filter(f => selection.has(f.id));
    onSauvegarderTous(choisis);
    onFermer();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="film-decouverte-modal">

        <div className="film-ajout-modal__header">
          <h3 className="film-ajout-modal__titre">✨ Films {origineHint} recommandés</h3>
          <button className="modal-close" style={{ position: 'static' }} onClick={onFermer}>✕</button>
        </div>

        <p className="film-ajout-modal__intro">
          Claude sélectionne 3 films de très haute qualité — un mélange de classiques et de découvertes récentes — à ajouter définitivement à ta bibliothèque.
        </p>

        {loading && (
          <div className="film-decouverte__loading">
            <span className="film-decouverte__spinner">🎬</span>
            Claude analyse le cinéma {origineHint}…
          </div>
        )}

        {error && (
          <div className="film-ajout-modal__error">
            {error}
            <button className="film-decouverte__retry-inline" onClick={decouvrir}>↺ Réessayer</button>
          </div>
        )}

        {suggestions.length > 0 && (
          <>
            <div className="film-decouverte__cards">
              {suggestions.map(film => {
                const checked = selection.has(film.id);
                return (
                  <label
                    key={film.id}
                    className={`film-decouverte__card${checked ? ' film-decouverte__card--on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(film.id)}
                      className="film-decouverte__check"
                    />
                    <div className="film-decouverte__card-body">
                      <div className="film-decouverte__card-top">
                        <span className="film-decouverte__nom">{film.nom}</span>
                        {film.titre_original && film.titre_original !== film.nom && (
                          <span className="film-decouverte__original"> — {film.titre_original}</span>
                        )}
                        <span className="film-decouverte__meta">
                          {film.realisateur} · {film.annee} · {film.genre}
                        </span>
                      </div>
                      <div className="film-decouverte__scores">
                        {film.score_rt != null && <span className="fds-score-chip fds-score-chip--rt">🍅 {film.score_rt}%</span>}
                        {film.score_imdb != null && <span className="fds-score-chip fds-score-chip--imdb">⭐ {film.score_imdb}/10</span>}
                        {film.score_metacritic != null && <span className="fds-score-chip fds-score-chip--meta">M {film.score_metacritic}</span>}
                        {!film.score_rt && !film.score_imdb && (
                          <span className="film-decouverte__score-fallback">{film.score_consensus}/100</span>
                        )}
                      </div>
                      {film.palmares?.length > 0 && (
                        <div className="film-decouverte__palmares">
                          {film.palmares.slice(0, 3).map(p => (
                            <span key={p} className="album-palmares-chip" style={{ fontSize: '0.7rem', padding: '2px 7px' }}>
                              {PALMARES_LABELS[p] || p}
                              {film.palmares_rangs?.[p] ? ` #${film.palmares_rangs[p]}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {film.description && (
                        <p className="film-decouverte__desc">{film.description}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="film-decouverte__actions">
              <button
                className="film-ajout-preview__save"
                onClick={handleAjouter}
                disabled={selection.size === 0}
              >
                ✅ Ajouter {selection.size} film{selection.size > 1 ? 's' : ''} à la bibliothèque
              </button>
              <button
                className="film-ajout-preview__retry"
                onClick={decouvrir}
                disabled={loading}
              >
                {loading ? '⏳…' : '↺ Nouvelles suggestions'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
