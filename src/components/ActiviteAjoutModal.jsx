import { useState } from 'react';

const VIDE = {
  nom: '', description: '', lieu: '', date: '', date_fin: '',
  cout_adulte: '', gratuit: false, pourQui: 'famille', source: 'local',
  url: '',
};

export default function ActiviteAjoutModal({ onSauvegarder, onFermer }) {
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

    const prompt = `Tu es un assistant familial à Québec. L'utilisateur cherche des activités correspondant à : "${query}".

Propose 3 activités en JSON uniquement :
[
  {
    "nom": "Nom de l'activité",
    "description": "Description courte (1-2 phrases)",
    "lieu": "Lieu ou adresse approximative à Québec",
    "cout_adulte": 0,
    "gratuit": true,
    "pourQui": "famille",
    "url": ""
  }
]

Règles :
- pourQui : "famille", "adultes" ou "enfants"
- gratuit : true si cout_adulte est 0
- Activités réalistes à Québec ou région
- Répondre uniquement en JSON, sans texte avant ni après`;

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
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Réponse inattendue');
      setSuggestions(JSON.parse(match[0]));
    } catch {
      setErreur('Erreur lors de la recherche IA. Vérifiez votre clé Anthropic.');
    }
    setLoading(false);
  }

  function selectionner(a) {
    setForm({
      nom: a.nom || '',
      description: a.description || '',
      lieu: a.lieu || '',
      date: a.date || '',
      date_fin: a.date_fin || '',
      cout_adulte: a.cout_adulte ?? '',
      gratuit: !!a.gratuit,
      pourQui: a.pourQui || 'famille',
      source: 'local',
      url: a.url || '',
    });
    setSuggestions([]);
  }

  function sauvegarder() {
    if (!form.nom.trim()) { setErreur('Le nom est requis.'); return; }
    const activite = {
      ...form,
      id: `custom-activite-${Date.now()}`,
      cout_adulte: parseFloat(form.cout_adulte) || 0,
      gratuit: form.gratuit || form.cout_adulte === 0 || form.cout_adulte === '',
      _source: 'local',
    };
    onSauvegarder(activite);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onFermer()}>
      <div className="ajout-modal">
        <button className="ajout-modal__close" onClick={onFermer}>✕</button>
        <h2 className="ajout-modal__titre">Ajouter une activité</h2>

        {/* Recherche IA */}
        <div className="ajout-modal__ia-row">
          <input
            className="ajout-modal__ia-input"
            placeholder="Décrire l'activité souhaitée…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && chercherIA()}
          />
          <button className="ajout-modal__ia-btn" onClick={chercherIA} disabled={loading}>
            {loading ? '…' : '✨ IA'}
          </button>
        </div>

        {erreur && <p className="ajout-modal__erreur">{erreur}</p>}

        {suggestions.length > 0 && (
          <div className="ajout-modal__suggestions">
            {suggestions.map((s, i) => (
              <div key={i} className="ajout-modal__suggestion" onClick={() => selectionner(s)}>
                <div className="ajout-modal__sug-titre">{s.nom}</div>
                <div className="ajout-modal__sug-detail">{s.lieu} · {s.gratuit ? 'Gratuit' : `${s.cout_adulte}$/adulte`} · {s.pourQui}</div>
                {s.description && <div className="ajout-modal__sug-desc">{s.description}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="ajout-modal__form">
          <div className="ajout-modal__row">
            <label>Nom <span className="ajout-modal__req">*</span></label>
            <input value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Nom de l'activité" />
          </div>
          <div className="ajout-modal__row">
            <label>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Courte description" />
          </div>
          <div className="ajout-modal__row">
            <label>Lieu</label>
            <input value={form.lieu} onChange={e => set('lieu', e.target.value)} placeholder="Adresse ou lieu" />
          </div>
          <div className="ajout-modal__row">
            <label>URL</label>
            <input value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://…" />
          </div>
          <div className="ajout-modal__row2">
            <div className="ajout-modal__row">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="ajout-modal__row">
              <label>Date fin</label>
              <input type="date" value={form.date_fin} onChange={e => set('date_fin', e.target.value)} />
            </div>
          </div>
          <div className="ajout-modal__row2">
            <div className="ajout-modal__row">
              <label>Coût / adulte ($)</label>
              <input type="number" value={form.cout_adulte} onChange={e => set('cout_adulte', e.target.value)} placeholder="0" min="0" />
            </div>
            <div className="ajout-modal__row">
              <label>Pour qui</label>
              <select value={form.pourQui} onChange={e => set('pourQui', e.target.value)}>
                <option value="famille">Famille</option>
                <option value="adultes">Adultes</option>
                <option value="enfants">Enfants</option>
              </select>
            </div>
          </div>
          <label className="ajout-modal__checkbox">
            <input type="checkbox" checked={form.gratuit} onChange={e => set('gratuit', e.target.checked)} />
            Activité gratuite
          </label>
        </div>

        <div className="ajout-modal__actions">
          <button className="ajout-modal__btn-annuler" onClick={onFermer}>Annuler</button>
          <button className="ajout-modal__btn-sauver" onClick={sauvegarder}>✓ Ajouter l'activité</button>
        </div>
      </div>
    </div>
  );
}
