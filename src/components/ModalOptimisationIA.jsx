import { useState } from 'react';

// ── Construit le prompt avec planning actuel + alternatives par thème ─────────
function buildPrompt(planning, toutesRecettes) {
  const lignes = (planning || []).map((jour, i) => {
    if (!jour?.recette || jour.recette.nom.startsWith('⚠️')) return null;
    const r = jour.recette;
    const themeCol = `theme_${jour.theme}`;

    const alternatives = (toutesRecettes || [])
      .filter(alt =>
        alt[themeCol] === 1 &&
        alt.nom !== r.nom &&
        (alt.cout < r.cout || alt.temps_preparation < r.temps_preparation)
      )
      .sort((a, b) => (a.cout + a.temps_preparation / 10) - (b.cout + b.temps_preparation / 10))
      .slice(0, 5)
      .map(alt => `  • "${alt.nom}" — ${alt.cout}$ — ${alt.temps_preparation} min`);

    return `Jour ${i} (${jour.jour}) — Thème: ${jour.theme}
  Actuel: "${r.nom}" — ${r.cout}$ — ${r.temps_preparation} min
  Alternatives disponibles:
${alternatives.length > 0 ? alternatives.join('\n') : '  (aucune alternative disponible)'}`;
  }).filter(Boolean);

  const totalCout = (planning || []).reduce((s, j) => s + (j?.recette?.cout || 0), 0);
  const totalTemps = (planning || []).reduce((s, j) => s + (j?.recette?.temps_preparation || 0), 0);

  return `Tu aides une famille québécoise à optimiser son planning de repas hebdomadaire.

Situation actuelle: ${totalCout}$ au total — ${Math.floor(totalTemps / 60)}h${totalTemps % 60}min de cuisine.

Planning avec alternatives disponibles:
${lignes.join('\n\n')}

Suggère EXACTEMENT 2 ou 3 échanges de recettes (utilise UNIQUEMENT les alternatives listées ci-dessus). Priorise les économies les plus significatives.

Réponds UNIQUEMENT avec ce JSON (aucun autre texte):
[
  {
    "jourIndex": 0,
    "jour": "Lundi",
    "recetteActuelle": "Nom exact de la recette actuelle",
    "recetteProposee": "Nom exact de l'alternative choisie",
    "economie_cout": 5,
    "economie_temps": 10,
    "raison": "Explication courte (max 12 mots)"
  }
]`;
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ModalOptimisationIA({ planning, toutesRecettes, onAppliquer, onClose }) {
  const [etat, setEtat] = useState('idle'); // idle | chargement | resultat | erreur
  const [suggestions, setSuggestions] = useState([]);
  const [erreur, setErreur] = useState('');
  const [appliques, setAppliques] = useState(new Set());

  async function fetchSuggestions() {
    setEtat('chargement');
    setErreur('');
    setAppliques(new Set());

    const apiKey = localStorage.getItem('anthropic_key') || '';
    if (!apiKey) {
      setErreur('Clé API Anthropic manquante. Configure-la dans la section Recettes → icône 🔑.');
      setEtat('erreur');
      return;
    }

    let prompt = '';
    try {
      prompt = buildPrompt(planning, toutesRecettes);
    } catch (e) {
      setErreur('Erreur lors de la préparation du planning : ' + e.message);
      setEtat('erreur');
      return;
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-client-side-api-key-allowed': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Erreur API ${res.status}${errBody ? ' — ' + errBody.slice(0, 120) : ''}`);
      }

      const data = await res.json();
      const texte = data.content?.[0]?.text || '';

      const jsonMatch = texte.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) throw new Error('Format inattendu de la réponse Claude');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Aucune suggestion retournée');

      setSuggestions(parsed);
      setEtat('resultat');
    } catch (e) {
      const msg = e instanceof TypeError
        ? 'Erreur réseau (connexion ou CORS) — réessaie dans quelques secondes.'
        : e.message;
      setErreur(msg);
      setEtat('erreur');
    }
  }

  function appliquer(s) {
    onAppliquer(s.jourIndex, s.recetteProposee);
    setAppliques(prev => new Set([...prev, s.jourIndex]));
  }

  const totalEconomieCout  = suggestions.reduce((s, r) => s + (r.economie_cout  || 0), 0);
  const totalEconomieTemps = suggestions.reduce((s, r) => s + (r.economie_temps || 0), 0);

  return (
    <div className="modal-ia-overlay" onClick={onClose}>
      <div className="modal-optim" onClick={e => e.stopPropagation()}>

        <div className="modal-optim__header">
          <div>
            <span className="modal-optim__titre">✨ Optimisation IA</span>
            <span className="modal-optim__sous">Réduire le budget et le temps de cuisine</span>
          </div>
          <button className="modal-ia__close" onClick={onClose}>✕</button>
        </div>

        {/* ── Idle : bouton de démarrage ── */}
        {etat === 'idle' && (
          <div className="modal-optim__idle">
            <p className="modal-optim__idle-txt">
              L'IA va analyser tes 7 recettes et proposer des échanges concrets pour réduire le budget ou le temps de cuisine.
            </p>
            <button className="optim-card__btn" style={{ alignSelf: 'stretch', padding: '12px' }} onClick={fetchSuggestions}>
              ✨ Lancer l'analyse
            </button>
          </div>
        )}

        {/* ── Chargement ── */}
        {etat === 'chargement' && (
          <div className="modal-ia__loading">
            <div className="modal-ia__spinner" />
            <span>Analyse du planning en cours…</span>
          </div>
        )}

        {/* ── Erreur ── */}
        {etat === 'erreur' && (
          <div className="modal-ia__error">
            <p>Erreur : {erreur}</p>
            <button className="modal-ia__retry" onClick={fetchSuggestions}>↻ Réessayer</button>
          </div>
        )}

        {/* ── Résultats ── */}
        {etat === 'resultat' && (
          <div className="modal-optim__body">

            {/* Résumé global */}
            {(totalEconomieCout > 0 || totalEconomieTemps > 5) && (
              <div className="optim-resume">
                <span className="optim-resume__label">Si tu appliques tout :</span>
                {totalEconomieCout > 0 && (
                  <span className="optim-resume__gain optim-resume__gain--cout">−{totalEconomieCout}$</span>
                )}
                {totalEconomieTemps > 5 && (
                  <span className="optim-resume__gain optim-resume__gain--temps">−{totalEconomieTemps} min</span>
                )}
              </div>
            )}

            {/* Cartes de suggestions */}
            {suggestions.map((s, i) => {
              const estApplique = appliques.has(s.jourIndex);
              const hasCout  = (s.economie_cout  || 0) > 0;
              const haTemps  = (s.economie_temps || 0) > 5;
              return (
                <div key={i} className={`optim-card ${estApplique ? 'optim-card--applique' : ''}`}>
                  <div className="optim-card__jour">{s.jour}</div>
                  <div className="optim-card__swap">
                    <span className="optim-card__avant">{s.recetteActuelle}</span>
                    <span className="optim-card__fleche">→</span>
                    <span className="optim-card__apres">{s.recetteProposee}</span>
                  </div>
                  <div className="optim-card__gains">
                    {hasCout  && <span className="optim-card__gain optim-card__gain--cout">−{s.economie_cout}$</span>}
                    {haTemps  && <span className="optim-card__gain optim-card__gain--temps">−{s.economie_temps} min</span>}
                  </div>
                  {s.raison && <div className="optim-card__raison">{s.raison}</div>}
                  {estApplique ? (
                    <div className="optim-card__applique-label">✅ Appliqué</div>
                  ) : (
                    <button className="optim-card__btn" onClick={() => appliquer(s)}>
                      Appliquer →
                    </button>
                  )}
                </div>
              );
            })}

            <button className="modal-ia__retry" onClick={fetchSuggestions}>
              ↻ Nouvelles suggestions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
