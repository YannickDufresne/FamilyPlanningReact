import { useMemo, useState } from 'react';
import aubaines from '../data/aubaines.json';
import GroceryList from './GroceryList';

function norm(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extractRabaisPct(deal) {
  if (deal.rabais) {
    const m = deal.rabais.match(/(\d+)\s*%/);
    if (m) return parseInt(m[1]);
  }
  if (deal.prix_regulier && deal.prix && deal.prix > 0) {
    return Math.round((1 - deal.prix / deal.prix_regulier) * 100);
  }
  return 0;
}

const STORES = [
  { key: 'maxi',   label: 'Maxi',   couleur: '#e3142c', emoji: '🏪' },
  { key: 'metro',  label: 'Metro',  couleur: '#e8000d', emoji: '🏪' },
  { key: 'adonis', label: 'Adonis', couleur: '#2d6a2d', emoji: '🫒' },
  { key: 'costco', label: 'Costco', couleur: '#00529F', emoji: '🏬' },
];

// ── Carte d'aubaine flashy ────────────────────────────────────────────────────
function AubaineCard({ deal, pct, couleur, onAddIngredient, ingredientsForces = [] }) {
  const motCle = (deal.mots_cles || [])[0] || deal.nom;
  const dejaForce = ingredientsForces.includes(motCle);

  return (
    <div className="aub-card" style={{ '--aub-color': couleur }}>
      {pct >= 20 && (
        <div className="aub-card__badge">−{pct}%</div>
      )}
      <div className="aub-card__nom">{deal.nom}</div>
      <div className="aub-card__prix-row">
        <span className="aub-card__prix">{deal.prix_texte || '—'}</span>
        {deal.prix_regulier_texte && (
          <span className="aub-card__reg">{deal.prix_regulier_texte}</span>
        )}
      </div>
      {deal.rabais && !String(deal.rabais).includes('%') && (
        <div className="aub-card__rabais-txt">{deal.rabais}</div>
      )}
      {onAddIngredient && (
        <button
          className={`aub-card__add ${dejaForce ? 'aub-card__add--done' : ''}`}
          onClick={() => !dejaForce && onAddIngredient(motCle)}
          disabled={dejaForce}
        >
          {dejaForce ? '✓ Inclus' : '+ Inclure'}
        </button>
      )}
    </div>
  );
}

// ── Section par enseigne ──────────────────────────────────────────────────────
function StoreSection({ store, deals, onAddIngredient, ingredientsForces }) {
  const [expanded, setExpanded] = useState(true);
  if (!deals || deals.length === 0) return null;

  const sorted = [...deals]
    .map(d => ({ ...d, pct: extractRabaisPct(d) }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="aub-store-section" style={{ '--store-color': store.couleur }}>
      <button className="aub-store-header" onClick={() => setExpanded(e => !e)}>
        <span className="aub-store-header__emoji">{store.emoji}</span>
        <span className="aub-store-header__nom">{store.label}</span>
        <span className="aub-store-header__count">{deals.length} soldes</span>
        <span className="aub-store-header__toggle">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="aub-store-grid">
          {sorted.map((deal, i) => (
            <AubaineCard
              key={i}
              deal={deal}
              pct={deal.pct}
              couleur={store.couleur}
              onAddIngredient={onAddIngredient}
              ingredientsForces={ingredientsForces}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EpiceriePage({ planning, joursChoisis, ingredientsForces = [], onAddIngredientForce, onRetour }) {
  const storesWithDeals = STORES.filter(s => (aubaines[s.key] || []).length > 0);
  const hasAubaines = storesWithDeals.length > 0;

  return (
    <div className="epicerie-page">
      <button className="epicerie-page__back" onClick={onRetour}>
        ← Retour au planning
      </button>

      <h1 className="epicerie-page__titre">🛒 Épicerie de la semaine</h1>

      {/* ── Liste d'épicerie ───────────────────────────────────────────────── */}
      <GroceryList
        planning={planning}
        joursChoisis={joursChoisis}
        ingredientsForces={ingredientsForces}
        onAddIngredientForce={onAddIngredientForce}
      />

      {/* ── Aubaines incontournables ──────────────────────────────────────── */}
      {hasAubaines && (
        <section className="aubaines-top-section">
          <div className="aubaines-top-section__header">
            <h2 className="aubaines-top-section__titre">🏷️ Aubaines de la semaine</h2>
            <p className="aubaines-top-section__sous">
              Tous commerces · semaine du {aubaines.semaine || '—'}
            </p>
          </div>

          <div className="aub-stores-list">
            {storesWithDeals.map(store => (
              <StoreSection
                key={store.key}
                store={store}
                deals={aubaines[store.key] || []}
                onAddIngredient={onAddIngredientForce}
                ingredientsForces={ingredientsForces}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
