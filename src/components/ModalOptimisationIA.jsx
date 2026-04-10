import { useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';

const JOURS_NOMS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ── Construit le prompt avec planning actuel + alternatives par thème ─────────
function buildPrompt(planning, toutesRecettes, obligations = []) {
  const EVAL_KEYS = ['eval_patricia', 'eval_yannick', 'eval_joseph', 'eval_mika', 'eval_luce'];

  const lignes = (planning || []).map((jour, i) => {
    if (!jour?.recette || jour.recette.nom.startsWith('⚠️')) return null;
    const r = jour.recette;
    const themeCol = `theme_${jour.theme}`;

    // Évaluations famille
    const evals = EVAL_KEYS.map(k => r[k]).filter(v => v != null && v !== '');
    const evalStr = evals.length > 0 ? ` · Éval famille: ${evals.join('/')} /5` : '';

    // Ingrédients pour suggérer des substitutions d'ingrédients
    const ingrStr = r.ingredients ? `\n  Ingrédients: ${r.ingredients}` : '';

    const alternatives = (toutesRecettes || [])
      .filter(alt =>
        alt[themeCol] === 1 &&
        alt.nom !== r.nom &&
        (alt.cout < r.cout || alt.temps_preparation < r.temps_preparation)
      )
      .sort((a, b) => (a.cout + a.temps_preparation / 10) - (b.cout + b.temps_preparation / 10))
      .slice(0, 4)
      .map(alt => {
        const altIngr = alt.ingredients ? ` (${alt.ingredients.split(',').slice(0, 3).join(', ')})` : '';
        return `  • "${alt.nom}" — cout ${alt.cout}/6 — ${alt.temps_preparation} min${altIngr}`;
      });

    return `Jour ${i} (${jour.jour}) — "${r.nom}"
  Coût: ${r.cout}/6 · Temps: ${r.temps_preparation} min${evalStr}${ingrStr}
  Alternatives même thème:
${alternatives.length > 0 ? alternatives.join('\n') : '  (aucune)'}`;
  }).filter(Boolean);

  const totalCout = (planning || []).reduce((s, j) => s + (j?.recette?.cout || 0), 0);
  const totalTemps = (planning || []).reduce((s, j) => s + (j?.recette?.temps_preparation || 0), 0);

  const contraintesStr = obligations.length > 0
    ? `\nContraintes horaires :\n${obligations.map(o => {
        const jour = JOURS_NOMS[o.jourSemaine] || '';
        return `- ${jour} : ${o.membre || 'Membre'} absent(e) ${o.heureDebut}–${o.heureFin} (${o.titre}) → repas rapide ou préparable à l'avance`;
      }).join('\n')}`
    : '';

  return `Tu aides une famille québécoise à optimiser son planning repas.
Coût total: ${totalCout}/42 · Temps total: ${Math.floor(totalTemps / 60)}h${totalTemps % 60}min${contraintesStr}

ÉCHELLE DE COÛT : 1=<4$/portion, 2=4-7$, 3=7-12$, 4=12-18$, 5=18-25$, 6=>25$

${lignes.join('\n\n')}

MISSION : Propose 2-3 optimisations concrètes pour réduire budget ou temps.

RÈGLES CRITIQUES (dans cet ordre de priorité) :
1. SUBSTITUTION D'INGRÉDIENT en priorité : si les ingrédients d'une recette incluent quelque chose de coûteux (saumon frais, homard, veau, etc.), suggère de le remplacer par une alternative similaire (truite, crevettes, poulet). La "recetteProposee" reste le même nom et "type" = "ingredient".
2. ÉCHANGE DE RECETTE uniquement si le gain est significatif ET si l'alternative est culinairement équivalente (même niveau de complexité, même esprit). Ne dégrade pas l'expérience : pas de saucisses à la place d'un plat gastronomique.
3. Respecte les évaluations : ne remplace pas une recette bien notée (≥4) par une inconnue.
4. Contraintes horaires : priorise les économies de temps ces jours-là.

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
[
  {
    "jourIndex": 0,
    "jour": "Lundi",
    "recetteActuelle": "Nom exact actuel",
    "recetteProposee": "Nom exact proposé (ou même nom si substitution ingrédient)",
    "economie_cout": 2,
    "economie_temps": 0,
    "raison": "Remplace le saumon par de la truite : même saveur, -3$/portion",
    "type": "ingredient"
  }
]
("type" : "ingredient" = substitution dans la recette, "recette" = échange complet)`;
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ModalOptimisationIA({ planning, toutesRecettes, obligations = [], onAppliquer, onClose }) {
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
      prompt = buildPrompt(planning, toutesRecettes, obligations);
    } catch (e) {
      setErreur('Erreur lors de la préparation du planning : ' + e.message);
      setEtat('erreur');
      return;
    }

    try {
      const client = new Anthropic({
        apiKey: apiKey.trim(),
        dangerouslyAllowBrowser: true,
        timeout: 30000,
      });

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const texte = message.content?.[0]?.text || '';

      // Regex greedy pour matcher le tableau JSON complet (pas lazy)
      const jsonMatch = texte.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Format inattendu — réessaie.');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Aucune suggestion retournée.');

      setSuggestions(parsed);
      setEtat('resultat');
    } catch (e) {
      if (e instanceof Anthropic.APITimeoutError) {
        setErreur('La requête a pris trop de temps. Réessaie.');
      } else if (e instanceof Anthropic.APIConnectionError) {
        setErreur('Impossible de joindre l\'API. Vérifie ta connexion — ou demande à ton IT de débloquer api.anthropic.com (port 443).');
      } else if (e instanceof Anthropic.AuthenticationError) {
        setErreur('Clé API invalide ou expirée. Vérifie-la dans la section 🔑.');
      } else {
        setErreur(e.message || 'Erreur inattendue.');
      }
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
