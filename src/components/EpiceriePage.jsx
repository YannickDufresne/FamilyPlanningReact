import { useMemo } from 'react';
import aubaines from '../data/aubaines.json';
import recettesData from '../data/recettes.json';
import { genererListeEpicerie } from '../utils/planning';
import GroceryList from './GroceryList';

// ── Normalise une chaîne pour comparaison ────────────────────────────────────
function normaliser(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Matching ingrédient ↔ aubaine ─────────────────────────────────────────────
function matchDeal(ingredient, deal) {
  const ingL = normaliser(ingredient);
  return (deal.mots_cles || []).some(mc => {
    const mcL = normaliser(mc);
    return ingL.includes(mcL) || mcL.includes(ingL.split(' ')[0]);
  });
}

// ── Trouve les recettes compatibles avec un deal (via ingrédients) ────────────
function trouverRecettesCompatibles(deal, recettes) {
  const compatible = recettes.filter(r => {
    const ing = (r.ingredients || '').toLowerCase();
    return (deal.mots_cles || []).some(mc => {
      const mcL = normaliser(mc);
      return ing.includes(mcL);
    });
  });
  return compatible.slice(0, 3).map(r => r.nom);
}

// ── Carte d'aubaine ───────────────────────────────────────────────────────────
function AubaineCard({ deal, store, variant = '' }) {
  const recettesCompat = useMemo(
    () => trouverRecettesCompatibles(deal, recettesData),
    [deal]
  );

  return (
    <div className={`aubaine-card aubaine-card--${store}${variant ? ` aubaine-card--${variant}` : ''}`}>
      <div className="aubaine-card__store">{store === 'maxi' ? 'Maxi' : store === 'costco' ? 'Costco' : store}</div>
      <div className="aubaine-card__nom">{deal.nom}</div>
      <div className="aubaine-card__prix">{deal.prix_texte || '—'}</div>
      {deal.rabais && <div className="aubaine-card__rabais">{deal.rabais}</div>}
      {recettesCompat.length > 0 && (
        <div className="aubaine-card__recettes">
          <div className="aubaine-card__recettes-label">Recettes compatibles</div>
          {recettesCompat.map(nom => (
            <span key={nom} className="aubaine-card__recette-pill">{nom}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EpiceriePage({ planning, onRetour }) {
  const ingredients = useMemo(() => genererListeEpicerie(planning), [planning]);

  const allDeals = useMemo(() => [
    ...(aubaines.maxi || []).map(d => ({ ...d, _store: 'maxi' })),
    ...(aubaines.costco || []).map(d => ({ ...d, _store: 'costco' })),
  ], []);

  // Aubaines bonus : deals qui ne matchent AUCUN ingrédient du planning
  const bonusDeals = useMemo(() =>
    allDeals.filter(deal => !ingredients.some(ing => matchDeal(ing, deal))),
    [allDeals, ingredients]
  );

  const maxiDeals = (aubaines.maxi || []);
  const costcoDeals = (aubaines.costco || []);
  const hasAubaines = maxiDeals.length > 0 || costcoDeals.length > 0;

  return (
    <div className="epicerie-page">
      {/* Bouton retour */}
      <button className="epicerie-page__back" onClick={onRetour}>
        ← Retour au planning
      </button>

      <h1 className="aubaines-section__titre" style={{ marginBottom: '32px', fontSize: '2.2rem' }}>
        🛒 Épicerie
      </h1>

      {/* Section Aubaines de la semaine */}
      {hasAubaines && (
        <div className="aubaines-section">
          <h2 className="aubaines-section__titre">Aubaines de la semaine</h2>
          <p className="aubaines-section__sous-titre">
            Soldes Maxi et Costco · semaine du {aubaines.semaine || '—'}
          </p>

          <div className="aubaines-stores-grid">
            {/* Colonne Maxi */}
            {maxiDeals.length > 0 && (
              <div className="aubaines-store-section">
                <div className="aubaines-store-section__header">
                  <span style={{ color: '#e3142c' }}>■</span>
                  <span>Maxi — René-Lévesque</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 400, opacity: 0.6 }}>
                    {maxiDeals.length} soldes
                  </span>
                </div>
                <div className="aubaines-grid">
                  {maxiDeals.map((deal, i) => (
                    <AubaineCard key={i} deal={deal} store="maxi" />
                  ))}
                </div>
              </div>
            )}

            {/* Colonne Costco */}
            {costcoDeals.length > 0 && (
              <div className="aubaines-store-section">
                <div className="aubaines-store-section__header">
                  <span style={{ color: '#00529F' }}>■</span>
                  <span>Costco</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 400, opacity: 0.6 }}>
                    {costcoDeals.length} soldes
                  </span>
                </div>
                <div className="aubaines-grid">
                  {costcoDeals.map((deal, i) => (
                    <AubaineCard key={i} deal={deal} store="costco" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section Aubaines bonus */}
      {bonusDeals.length > 0 && (
        <div className="aubaines-section">
          <h2 className="aubaines-section__titre">💡 Aubaines à saisir cette semaine</h2>
          <p className="aubaines-section__sous-titre">
            Ces produits sont en solde mais pas dans vos recettes — profitez-en !
          </p>
          <div className="aubaines-grid">
            {bonusDeals.map((deal, i) => (
              <AubaineCard key={i} deal={deal} store={deal._store} variant="bonus" />
            ))}
          </div>
        </div>
      )}

      {/* Liste d'épicerie complète */}
      <GroceryList planning={planning} />
    </div>
  );
}
