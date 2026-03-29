import { useMemo } from 'react';
import aubaines from '../data/aubaines.json';
import GroceryList from './GroceryList';

// ── Normalise une chaîne pour comparaison ────────────────────────────────────
function norm(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Extraire le % de rabais d'un deal ─────────────────────────────────────────
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

// Couleur par magasin
const STORE_COULEUR = {
  Maxi:   '#e3142c',
  Costco: '#00529F',
  Metro:  '#e8000d',
  Adonis: '#2d6a2d',
};

// ── Carte d'aubaine incontournable ───────────────────────────────────────────
function AubaineTopCard({ deal, pct, onAddIngredient }) {
  const couleur = STORE_COULEUR[deal.magasin] || '#666';
  const motCle = (deal.mots_cles || [])[0] || deal.nom;

  return (
    <div className="aubaine-top-card" style={{ '--store-color': couleur }}>
      <div className="aubaine-top-card__store" style={{ background: couleur }}>
        {deal.magasin}
      </div>
      <div className="aubaine-top-card__body">
        <div className="aubaine-top-card__nom">{deal.nom}</div>
        <div className="aubaine-top-card__prix-row">
          <span className="aubaine-top-card__prix">{deal.prix_texte || '—'}</span>
          {deal.prix_regulier_texte && (
            <span className="aubaine-top-card__reg">{deal.prix_regulier_texte}</span>
          )}
        </div>
        {pct > 0 && (
          <div className="aubaine-top-card__badge">−{pct}%</div>
        )}
        {deal.rabais && !deal.rabais.includes('%') && (
          <div className="aubaine-top-card__rabais">{deal.rabais}</div>
        )}
      </div>
      {onAddIngredient && (
        <button
          className="aubaine-top-card__add"
          onClick={() => onAddIngredient(motCle)}
          title={`Ajouter "${motCle}" aux ingrédients à inclure`}
        >
          + Inclure
        </button>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function EpiceriePage({ planning, joursChoisis, ingredientsForces = [], onAddIngredientForce, onRetour }) {

  // Tous les deals de toutes les enseignes
  const tousDeals = useMemo(() => [
    ...(aubaines.maxi   || []).map(d => ({ ...d, magasin: 'Maxi'   })),
    ...(aubaines.metro  || []).map(d => ({ ...d, magasin: 'Metro'  })),
    ...(aubaines.adonis || []).map(d => ({ ...d, magasin: 'Adonis' })),
    ...(aubaines.costco || []).map(d => ({ ...d, magasin: 'Costco' })),
  ], []);

  // Top aubaines : triées par % rabais décroissant, avec prix réel
  const topAubaines = useMemo(() => {
    return tousDeals
      .filter(d => d.prix || d.prix_texte)
      .map(d => ({ deal: d, pct: extractRabaisPct(d) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 20);
  }, [tousDeals]);

  const hasAubaines = topAubaines.length > 0;

  return (
    <div className="epicerie-page">
      <button className="epicerie-page__back" onClick={onRetour}>
        ← Retour au planning
      </button>

      <h1 className="epicerie-page__titre">🛒 Épicerie de la semaine</h1>

      {/* ── Section 1 : Ma liste d'épicerie ─────────────────────────────── */}
      <GroceryList
        planning={planning}
        joursChoisis={joursChoisis}
        ingredientsForces={ingredientsForces}
        onAddIngredientForce={onAddIngredientForce}
      />

      {/* ── Section 2 : Aubaines incontournables ─────────────────────────── */}
      {hasAubaines && (
        <section className="aubaines-top-section">
          <div className="aubaines-top-section__header">
            <h2 className="aubaines-top-section__titre">🏷️ Aubaines incontournables</h2>
            <p className="aubaines-top-section__sous">
              Meilleures offres tous commerces · semaine du {aubaines.semaine || '—'}
            </p>
          </div>
          <div className="aubaines-top-grid">
            {topAubaines.map(({ deal, pct }, i) => (
              <AubaineTopCard
                key={i}
                deal={deal}
                pct={pct}
                onAddIngredient={onAddIngredientForce}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
