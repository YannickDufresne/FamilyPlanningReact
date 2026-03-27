import { useState } from 'react';
import aubaines from '../data/aubaines.json';
import { genererListeEpicerie } from '../utils/planning';

// ── Matching ingrédient ↔ aubaine ─────────────────────────────────────────────
function trouverAubaine(ingredient, deals) {
  const ingLower = ingredient.toLowerCase();
  return deals.find(deal =>
    deal.mots_cles?.some(mc => {
      const mcL = mc.toLowerCase();
      return ingLower.includes(mcL) || mcL.includes(ingLower.split(' ')[0]);
    })
  );
}

function trouverMagasin(ingredient, parMagasin) {
  const ingLower = ingredient.toLowerCase();
  for (const [magasin, liste] of Object.entries(parMagasin)) {
    if (liste.some(item => ingLower.includes(item.toLowerCase()) || item.toLowerCase().includes(ingLower.split(' ')[0]))) {
      return magasin;
    }
  }
  return 'autres';
}

// ── Badge d'aubaine ─────────────────────────────────────────────────────────
function AubaineBadge({ deal }) {
  if (!deal) return null;
  return (
    <span className="aubaine-badge" title={`${deal.prix_texte || ''}${deal.rabais ? ` · ${deal.rabais}` : ''}`}>
      🏷️ {deal.prix_texte || 'Solde'}{deal.rabais ? ` · ${deal.rabais}` : ''}
    </span>
  );
}

// ── Section par magasin ───────────────────────────────────────────────────────
function SectionMagasin({ label, emoji, ingredients, deals, couleur }) {
  const [cochees, setCochees] = useState(new Set());
  if (ingredients.length === 0) return null;

  return (
    <div className="epicerie-magasin" style={{ '--magasin-couleur': couleur }}>
      <div className="epicerie-magasin__header">
        <span className="epicerie-magasin__emoji">{emoji}</span>
        <span className="epicerie-magasin__nom">{label}</span>
        <span className="epicerie-magasin__count">{ingredients.length} items</span>
      </div>

      {/* Soldes disponibles pour ce magasin */}
      {deals.length > 0 && (
        <div className="epicerie-soldes">
          <div className="epicerie-soldes__titre">🏷️ Soldes cette semaine</div>
          {deals.map((deal, i) => (
            <div key={i} className="epicerie-solde-item">
              <span className="epicerie-solde-nom">{deal.nom}</span>
              {deal.prix_texte && <span className="epicerie-solde-prix">{deal.prix_texte}</span>}
              {deal.rabais && <span className="epicerie-solde-rabais">{deal.rabais}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Liste d'ingrédients */}
      <ul className="epicerie-items">
        {ingredients.map((ing, i) => {
          const deal = trouverAubaine(ing, deals);
          const coche = cochees.has(ing);
          return (
            <li
              key={i}
              className={`epicerie-item ${coche ? 'epicerie-item--coche' : ''} ${deal ? 'epicerie-item--solde' : ''}`}
              onClick={() => setCochees(prev => {
                const n = new Set(prev);
                if (n.has(ing)) n.delete(ing); else n.add(ing);
                return n;
              })}
            >
              <span className="epicerie-item__check">{coche ? '☑' : '☐'}</span>
              <span className="epicerie-item__nom">{ing}</span>
              {deal && <AubaineBadge deal={deal} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Section Lufa ──────────────────────────────────────────────────────────────
function SectionLufa({ items, totalEstime, minAtteint }) {
  const [cochees, setCochees] = useState(new Set());

  const toggle = (nom) => setCochees(prev => {
    const n = new Set(prev); if (n.has(nom)) n.delete(nom); else n.add(nom); return n;
  });

  const totalCoche = items.filter(i => cochees.has(i.nom)).reduce((s, i) => {
    return s + (parseFloat(i.prix_estime) || 0);
  }, 0);

  return (
    <div className="epicerie-magasin epicerie-magasin--lufa">
      <div className="epicerie-magasin__header">
        <span className="epicerie-magasin__emoji">🥦</span>
        <span className="epicerie-magasin__nom">Lufa — commande en ligne</span>
        <span className="epicerie-magasin__count">{items.length} items</span>
      </div>

      <div className="lufa-alerte">
        <span className="lufa-alerte__icon">⚠️</span>
        <div>
          <strong>Passe ta commande Lufa cette semaine !</strong>
          <div className="lufa-alerte__detail">
            Total estimé : <strong>{totalEstime || '—'}</strong>
            {totalCoche > 0 && <span> · Coché : <strong>{totalCoche.toFixed(2)}$</strong></span>}
            {!minAtteint && <span className="lufa-min-warning"> · Vérifie le minimum de commande</span>}
          </div>
        </div>
      </div>

      <ul className="epicerie-items epicerie-items--lufa">
        {items.map((item, i) => {
          const coche = cochees.has(item.nom);
          return (
            <li
              key={i}
              className={`epicerie-item epicerie-item--lufa ${coche ? 'epicerie-item--coche' : ''}`}
              onClick={() => toggle(item.nom)}
            >
              <span className="epicerie-item__check">{coche ? '☑' : '☐'}</span>
              <div className="epicerie-item__lufa-content">
                <span className="epicerie-item__nom">{item.nom}</span>
                {item.unite && <span className="epicerie-item__unite">{item.unite}</span>}
                {item.prix_estime && <span className="epicerie-item__prix">{item.prix_estime}</span>}
                {item.raison && <span className="epicerie-item__raison">{item.raison}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function GroceryList({ planning }) {
  const ingredients = genererListeEpicerie(planning);
  const valides = (planning || []).filter(j => !j.recette.nom.startsWith('⚠️'));
  if (!planning || ingredients.length === 0) return null;

  const hasAubaines = aubaines.semaine !== '';
  const allDeals = [...(aubaines.maxi || []), ...(aubaines.costco || [])];

  // Organiser les ingrédients par magasin
  const parMagasin = { maxi: [], costco: [], lufa: [], autres: [] };
  if (hasAubaines && aubaines.par_magasin) {
    for (const ing of ingredients) {
      const mag = trouverMagasin(ing, aubaines.par_magasin);
      (parMagasin[mag] || parMagasin.autres).push(ing);
    }
  }

  return (
    <section>
      <h2 className="section-heading">Liste d'épicerie</h2>

      <div className="epicerie-container">
        {/* En-tête avec statut */}
        <div className="epicerie-header">
          <span style={{ fontSize: '1.1rem' }}>🛒</span>
          <span className="epicerie-header-title">Provisions de la semaine</span>
          {hasAubaines && aubaines.economies_estimees && (
            <span className="epicerie-economies">💰 Économies estimées : {aubaines.economies_estimees}</span>
          )}
        </div>

        {/* Analyse IA */}
        {hasAubaines && aubaines.analyse ? (
          <div className="epicerie-analyse">
            <div className="epicerie-analyse__icon">✦</div>
            <p>{aubaines.analyse}</p>
          </div>
        ) : (
          <div className="epicerie-note-aubaines">
            <span>📅</span>
            <span>Les aubaines Maxi, Costco et la liste Lufa seront générées automatiquement chaque vendredi soir.</span>
          </div>
        )}

        {valides.length < 7 && (
          <p className="epicerie-note">Liste basée sur {valides.length} recettes valides.</p>
        )}

        {hasAubaines ? (
          // Vue organisée par magasin
          <div className="epicerie-magasins">
            <SectionMagasin
              label="Maxi — René-Lévesque"
              emoji="🏪"
              ingredients={parMagasin.maxi}
              deals={aubaines.maxi || []}
              couleur="#e3142c"
            />
            <SectionMagasin
              label="Costco"
              emoji="🏬"
              ingredients={parMagasin.costco}
              deals={aubaines.costco || []}
              couleur="#00529F"
            />
            {aubaines.lufa?.length > 0 && (
              <SectionLufa
                items={aubaines.lufa}
                totalEstime={aubaines.lufa_total_estime}
                minAtteint={aubaines.lufa_min_atteint}
              />
            )}
            <SectionMagasin
              label="Autres"
              emoji="📦"
              ingredients={parMagasin.autres}
              deals={[]}
              couleur="#888"
            />
          </div>
        ) : (
          // Vue classique (avant la première génération)
          <div className="epicerie-list">
            <ul>
              {ingredients.map(ing => <li key={ing}>{ing}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
