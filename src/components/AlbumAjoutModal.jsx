import { useState } from 'react';

const CONTINENTS = ['Amériques', 'Europe', 'Asie', 'Afrique', 'Moyen-Orient', 'Océanie'];
const GENRES = ['', 'Jazz', 'Rock', 'Folk', 'Classique', 'Électronique', 'Hip-hop', 'R&B / Soul',
  'Reggae', 'Blues', 'Country', 'Pop', 'Métal', 'Punk', 'Bossa nova', 'Tango', 'Flamenco',
  'Musique du monde', 'Musique traditionnelle', 'Ambient', 'Indie'];

const VIDE = {
  nom: '', artiste: '', annee: '', pays: '', origine: '', continent: '',
  genre: '', description: '', artwork_url: '', score_consensus: '',
};

function buildPrompt(anthropicKey) {
  // placeholder — IA appelée dans le composant
  return anthropicKey;
}

export default function AlbumAjoutModal({ albumsExistants = [], onSauvegarder, onFermer }) {
  const [form, setForm] = useState({ ...VIDE });
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [query, setQuery] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function chercherIA() {
    if (!query.trim()) return;
    const anthropicKey = localStorage.getItem('anthropic_key');
    if (!anthropicKey) { setErreur('Clé API Anthropic requise.'); return; }
    setLoading(true);
    setErreur('');
    setSuggestions([]);

    const exNoms = albumsExistants.map(a => `${a.artiste} — ${a.nom}`).join('\n');
    const prompt = `Tu es un expert en musique mondiale. L'utilisateur cherche un album correspondant à : "${query}".

Albums déjà dans la bibliothèque (à EXCLURE) :
${exNoms || '(aucun)'}

Propose 3 albums de haute qualité (classiques reconnus ou incontournables), en JSON uniquement, format :
[
  {
    "nom": "Titre de l'album",
    "artiste": "Nom de l'artiste",
    "annee": 1972,
    "pays": "Pays d'origine",
    "origine": "Pays ou région culturelle",
    "continent": "Amériques|Europe|Asie|Afrique|Moyen-Orient|Océanie",
    "genre": "Genre musical",
    "score_consensus": 85,
    "description": "2-3 phrases : contexte historique, importance culturelle, anecdote."
  }
]

Règles :
- score_consensus entre 70 et 99 selon la reconnaissance critique
- description en français
- Aucun album déjà dans la liste ci-dessus`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Réponse inattendue');
      const parsed = JSON.parse(match[0]);
      setSuggestions(parsed.map((a, i) => ({ ...a, id: `custom-album-${Date.now()}-${i}`, _source: 'local' })));
    } catch (e) {
      setErreur('Erreur lors de la recherche IA. Vérifiez votre clé Anthropic.');
    }
    setLoading(false);
  }

  function selectionner(album) {
    setForm({
      nom: album.nom || '',
      artiste: album.artiste || '',
      annee: album.annee || '',
      pays: album.pays || '',
      origine: album.origine || '',
      continent: album.continent || '',
      genre: album.genre || '',
      description: album.description || '',
      artwork_url: album.artwork_url || '',
      score_consensus: album.score_consensus || '',
    });
    setSuggestions([]);
  }

  function sauvegarder() {
    if (!form.nom.trim() || !form.artiste.trim()) { setErreur('Nom et artiste requis.'); return; }
    const album = {
      ...form,
      id: `custom-album-${Date.now()}`,
      annee: parseInt(form.annee) || new Date().getFullYear(),
      score_consensus: parseFloat(form.score_consensus) || 70,
      _source: 'local',
    };
    onSauvegarder(album);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="ajout-modal">
        <button className="ajout-modal__close" onClick={onFermer}>✕</button>
        <h2 className="ajout-modal__titre">Ajouter un album</h2>

        {/* Recherche IA */}
        <div className="ajout-modal__ia-row">
          <input
            className="ajout-modal__ia-input"
            placeholder="Chercher un album ou artiste avec l'IA…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && chercherIA()}
          />
          <button className="ajout-modal__ia-btn" onClick={chercherIA} disabled={loading}>
            {loading ? '…' : '✨ IA'}
          </button>
        </div>

        {erreur && <p className="ajout-modal__erreur">{erreur}</p>}

        {/* Suggestions IA */}
        {suggestions.length > 0 && (
          <div className="ajout-modal__suggestions">
            {suggestions.map((s, i) => (
              <div key={i} className="ajout-modal__suggestion" onClick={() => selectionner(s)}>
                <div className="ajout-modal__sug-titre">{s.artiste} — <em>{s.nom}</em> ({s.annee})</div>
                <div className="ajout-modal__sug-detail">{s.pays} · {s.genre} · Score {s.score_consensus}</div>
                {s.description && <div className="ajout-modal__sug-desc">{s.description}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Formulaire */}
        <div className="ajout-modal__form">
          <div className="ajout-modal__row">
            <label>Titre <span className="ajout-modal__req">*</span></label>
            <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom de l'album" />
          </div>
          <div className="ajout-modal__row">
            <label>Artiste <span className="ajout-modal__req">*</span></label>
            <input value={form.artiste} onChange={e => set('artiste', e.target.value)} placeholder="Nom de l'artiste" />
          </div>
          <div className="ajout-modal__row2">
            <div className="ajout-modal__row">
              <label>Année</label>
              <input type="number" value={form.annee} onChange={e => set('annee', e.target.value)} placeholder="1972" />
            </div>
            <div className="ajout-modal__row">
              <label>Score (0-100)</label>
              <input type="number" value={form.score_consensus} onChange={e => set('score_consensus', e.target.value)} placeholder="85" />
            </div>
          </div>
          <div className="ajout-modal__row2">
            <div className="ajout-modal__row">
              <label>Pays</label>
              <input value={form.pays} onChange={e => set('pays', e.target.value)} placeholder="Japon" />
            </div>
            <div className="ajout-modal__row">
              <label>Continent</label>
              <select value={form.continent} onChange={e => set('continent', e.target.value)}>
                <option value="">—</option>
                {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="ajout-modal__row">
            <label>Genre</label>
            <select value={form.genre} onChange={e => set('genre', e.target.value)}>
              {GENRES.map(g => <option key={g} value={g}>{g || '—'}</option>)}
            </select>
          </div>
          <div className="ajout-modal__row">
            <label>Origine culturelle</label>
            <input value={form.origine} onChange={e => set('origine', e.target.value)} placeholder="Japon, France, Mali…" />
          </div>
          <div className="ajout-modal__row">
            <label>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Contexte historique, importance culturelle…" />
          </div>
        </div>

        <div className="ajout-modal__actions">
          <button className="ajout-modal__btn-annuler" onClick={onFermer}>Annuler</button>
          <button className="ajout-modal__btn-sauver" onClick={sauvegarder}>✓ Ajouter l'album</button>
        </div>
      </div>
    </div>
  );
}
