import { useState } from 'react';
import { createPortal } from 'react-dom';
import Anthropic from '@anthropic-ai/sdk';
import { labelOrigine, paysDeZone } from '../utils/zones';

// ── Descriptions des thèmes pour le prompt ───────────────────────────────────
const THEMES_INFO = {
  criiions_poisson: { label: 'Poisson / Fruits de mer',  desc: 'filets de poisson, fruits de mer, crevettes, moules, palourdes — recette savoureuse de la mer' },
  pasta_rapido:     { label: 'Pasta Rapido',              desc: 'pâtes fraîches ou sèches, gnocchi, nouilles — rapide et savoureux' },
  bol_nwich:        { label: 'Bol · Sandwich',            desc: 'bols repas, wraps, sandwichs, tacos, salades-repas garnies' },
  plat_en_sauce:    { label: 'Plat en sauce',             desc: 'ragoût, curry, daube, braisé — plat mijoté avec une belle sauce' },
  confort_grille:   { label: 'Confort grillé',            desc: 'viande ou légumes grillés, burger, BBQ, poulet rôti' },
  pizza:            { label: 'Pizza',                     desc: 'pizza maison, focaccia garnie, flatbread — pâte avec garnitures' },
  slow_chic:        { label: 'Slow Chic',                 desc: 'cuisine raffinée et lente — risotto, côte de bœuf, filet de poisson gastronomique, dîner élaboré du dimanche' },
};

function buildPrompt({ theme, filtres, ingredientsForces, recettesSemaine, regimeNecessaire, origine }) {
  const info = THEMES_INFO[theme] || { label: theme, desc: '' };

  // Régime exact du jour (calculé à partir du quota restant), pas juste le filtre global
  const regimeStr =
    regimeNecessaire === 'végane'
      ? 'végane — OBLIGATOIRE. Zéro produit animal : ni viande, ni poisson, ni œufs, ni produits laitiers.'
    : regimeNecessaire === 'végétarien'
      ? 'végétarien — OBLIGATOIRE. Pas de viande ni poisson ; œufs et produits laitiers permis.'
    : 'omnivore — viande, poisson, tout est permis.';

  const origineAffichee = labelOrigine(origine);
  const origineZonePays = paysDeZone(origine);
  const origineStr = origineAffichee
    ? origineZonePays
      ? `\n- Zone culinaire OBLIGATOIRE : ${origineAffichee} (${origineZonePays.join(', ')}). La recette DOIT venir d'un de ces pays.`
      : `\n- Origine culturelle OBLIGATOIRE : ${origine}. La recette DOIT appartenir à cette tradition culinaire.`
    : '';

  const cout = filtres?.activerCout
    ? `Budget max ${filtres.coutMax}/portion sur l'échelle 1-6 (1=<4$, 2=4-7$, 3=7-12$, 4=12-18$, 5=18-25$, 6=>25$)`
    : 'Budget raisonnable — privilégier 2-3 sur l\'échelle 1-6';

  const temps = filtres?.activerTemps
    ? `Temps max : ${filtres.tempsMax} minutes tout compris (préparation + cuisson).`
    : '';

  const rapideStr = filtres?.nbRapides > 0
    ? '\n- Recette RAPIDE et ÉCONOMIQUE (≤ 25 min, cout ≤ 2 si possible).'
    : '';

  const forcesLine = ingredientsForces?.length
    ? `\n- Inclure au moins un de ces ingrédients si naturel : ${ingredientsForces.join(', ')}`
    : '';

  // Exclure TOUTES les recettes déjà au menu (pas juste 6)
  const eviterLine = recettesSemaine?.length
    ? `\n- ÉVITER ces recettes déjà au menu cette semaine (aucun doublon) : ${recettesSemaine.join(' | ')}`
    : '';

  return `Tu es un chef cuisinier expert et historien de la gastronomie. Je cherche une recette pour le thème "${info.label}".
Description du thème : ${info.desc}.

Contraintes OBLIGATOIRES (respecte-les toutes — c'est critique) :
- Régime : ${regimeStr}${origineStr}
- ${cout}
- ${temps || 'Pas de contrainte de temps.'}${rapideStr}${forcesLine}${eviterLine}

Réponds avec une recette familiale vraiment bonne et avec un fun fact ou anecdote historique sur la recette (champ "anecdote" : 1-2 phrases, pédagogiques, en français, style chaleureux).

Règles :
1. "url" : URL réelle UNIQUEMENT si certain qu'elle existe — sinon ""
2. "nom" : en français, appétissant
3. "origine" : tradition culinaire${origineZonePays ? ` = un pays de ${origineAffichee} OBLIGATOIRE` : origineAffichee ? ` = "${origine}" OBLIGATOIRE` : ' (ex: "France", "Japon", "Liban")'}
4. Thèmes : 1 dans le bon thème, 0 ailleurs
5. "anecdote" : fun fact ou histoire courte sur la recette/origine

Réponds UNIQUEMENT avec ce JSON valide, sans markdown ni explication :
{
  "nom": "Truite meunière au beurre noisette",
  "nom_original": "Trout Meunière",
  "url": "",
  "origine": "France",
  "regime_alimentaire": "omnivore",
  "temps_preparation": 20,
  "cout": 2,
  "ingredients": "filet de truite, beurre, câpres, citron, persil, farine",
  "anecdote": "La meunière tient son nom des meuniers du Moyen Âge qui passaient leurs poissons dans la farine du moulin avant de les frire au beurre — une technique qui transforme n'importe quel poisson de rivière en plat élégant.",
  "theme_pasta_rapido": 0, "theme_bol_nwich": 0, "theme_criiions_poisson": 1,
  "theme_plat_en_sauce": 0, "theme_confort_grille": 0, "theme_pizza": 0, "theme_slow_chic": 0,
  "notes": "Classique français en 20 min — le beurre noisette sublime tout."
}`;
}

// ── Carte de recette générée ──────────────────────────────────────────────────
function RecetteCard({ recette }) {
  const coutLabels = { 1: '<4$', 2: '4-7$', 3: '7-12$', 4: '12-18$', 5: '18-25$', 6: '>25$' };
  return (
    <div className="modal-ia__recette-card">
      <div className="modal-ia__recette-nom">{recette.nom}</div>
      {recette.nom_original && recette.nom_original !== recette.nom && (
        <div className="modal-ia__recette-orig">{recette.nom_original}</div>
      )}
      <div className="modal-ia__recette-meta">
        <span>🌍 {recette.origine}</span>
        <span>⏱ {recette.temps_preparation} min</span>
        <span>💰 {coutLabels[recette.cout] || `${recette.cout}$`}/portion</span>
        <span className="modal-ia__regime">{recette.regime_alimentaire}</span>
      </div>
      {recette.ingredients && (
        <div className="modal-ia__recette-ings">
          <strong>Ingrédients :</strong> {recette.ingredients}
        </div>
      )}
      {recette.anecdote && (
        <div className="modal-ia__recette-anecdote">
          📖 {recette.anecdote}
        </div>
      )}
      {recette.notes && (
        <div className="modal-ia__recette-notes">💡 {recette.notes}</div>
      )}
      {recette.url && (
        <a className="modal-ia__recette-url" href={recette.url} target="_blank" rel="noopener noreferrer">
          🔗 Voir la recette originale
        </a>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function ModalSuggestionIA({ theme, filtres, ingredientsForces, recettesSemaine, regimeNecessaire = 'omnivore', origine = 'Tous', onSauvegarder, onChoisirCeSoir, onClose }) {
  const [statut, setStatut] = useState('idle'); // idle | chargement | resultat | erreur
  const [recette, setRecette] = useState(null);
  const [erreur, setErreur] = useState('');
  const [sauvegardee, setSauvegardee] = useState(false);

  const info = THEMES_INFO[theme] || { label: theme, desc: '' };
  const apiKey = localStorage.getItem('anthropic_key') || '';

  async function suggerer() {
    if (!apiKey) {
      setErreur('Configure ta clé API Anthropic dans la section "Recettes" → formulaire → icône 🔑.');
      setStatut('erreur');
      return;
    }
    setStatut('chargement');
    setRecette(null);
    setErreur('');
    setSauvegardee(false);

    try {
      const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
        timeout: 30000,
      });

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: buildPrompt({ theme, filtres, ingredientsForces, recettesSemaine, regimeNecessaire, origine }) }],
      });
      const text = response.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('La réponse ne contient pas de JSON valide.');
      const parsed = JSON.parse(match[0]);
      setRecette({ ...parsed, source: 'ia_suggestion', _custom: true });
      setStatut('resultat');
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionError) {
        setErreur('Impossible de joindre l\'API. Vérifie ta connexion — ou demande à ton IT de débloquer api.anthropic.com (port 443).');
      } else if (e instanceof Anthropic.AuthenticationError) {
        setErreur('Clé API invalide ou expirée. Vérifie-la dans la section 🔑 de la barre latérale.');
      } else if (e instanceof Anthropic.APITimeoutError) {
        setErreur('La requête a pris trop de temps. Réessaie.');
      } else {
        setErreur(e.message || 'Erreur inattendue.');
      }
      setStatut('erreur');
    }
  }

  function handleSauvegarder() {
    onSauvegarder(recette);
    setSauvegardee(true);
  }

  function handleUtiliserCeSoir() {
    if (!sauvegardee) onSauvegarder(recette);
    onChoisirCeSoir(recette.nom);
    onClose();
  }

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-ia">
        <button className="modal-ia__close" onClick={onClose}>✕</button>

        <div className="modal-ia__header">
          <span className="modal-ia__icon">🤖</span>
          <div>
            <div className="modal-ia__titre">Suggestion IA</div>
            <div className="modal-ia__sous-titre">{info.label}</div>
          </div>
        </div>

        {/* ── Idle ── */}
        {statut === 'idle' && (
          <div className="modal-ia__body">
            <p className="modal-ia__desc">
              L'IA va proposer une recette adaptée à tes filtres, régimes alimentaires et ingrédients à inclure.
              Tu pourras l'accepter, demander une autre suggestion, ou l'ajouter à ta bibliothèque de recettes.
            </p>
            {ingredientsForces?.length > 0 && (
              <p className="modal-ia__context">
                🌿 Ingrédients à inclure : <strong>{ingredientsForces.join(', ')}</strong>
              </p>
            )}
            <button className="modal-ia__btn modal-ia__btn--primary" onClick={suggerer}>
              ✨ Trouver une recette
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {statut === 'chargement' && (
          <div className="modal-ia__body modal-ia__body--center">
            <div className="modal-ia__spinner" />
            <p className="modal-ia__loading-txt">Recherche d'une recette parfaite…</p>
          </div>
        )}

        {/* ── Erreur ── */}
        {statut === 'erreur' && (
          <div className="modal-ia__body">
            <div className="modal-ia__erreur">⚠️ {erreur}</div>
            <button className="modal-ia__btn" onClick={() => setStatut('idle')}>← Retour</button>
          </div>
        )}

        {/* ── Résultat ── */}
        {statut === 'resultat' && recette && (
          <div className="modal-ia__body">
            <RecetteCard recette={recette} />
            <div className="modal-ia__actions">
              <button className="modal-ia__btn modal-ia__btn--ghost" onClick={suggerer}>
                ↻ Autre suggestion
              </button>
              {!sauvegardee ? (
                <button className="modal-ia__btn modal-ia__btn--secondary" onClick={handleSauvegarder}>
                  ＋ Ajouter à mes recettes
                </button>
              ) : (
                <span className="modal-ia__saved">✅ Sauvegardée !</span>
              )}
              <button className="modal-ia__btn modal-ia__btn--primary" onClick={handleUtiliserCeSoir}>
                Utiliser ce soir →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
