import { useState, useMemo } from 'react';
import aubaines from '../data/aubaines.json';
import { genererListeEpicerie } from '../utils/planning';

// ── Routage par magasin (client-side, toujours à jour) ───────────────────────
// Règles par priorité décroissante. Tout le reste → Maxi.
function routerMagasin(ingredient) {
  const ing = ingredient.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sans accents pour matching

  // LUFA : produits frais locaux, bio, laitiers, oeufs, herbes fraîches
  if (/\b(carotte|courgette|brocoli|chou|laitue|concombre|poivron|celeri|radis|betterave|navet|poireau|asperge|haricot vert|endive|roquette|mesclun|epinard|potiron|courge|butternut|fenouil|panais|aubergine|artichaut)\b/.test(ing)) return 'lufa';
  if (/\b(tomate fraiche|tomate cerise|tomates fraiches)\b/.test(ing)) return 'lufa';
  if (/\b(basilic|persil|coriandre|menthe|aneth|estragon|ciboulette|sarriette)\b/.test(ing) && !/seche|sec|poudre|moulu/.test(ing)) return 'lufa';
  if (/\b(pomme|poire|fraise|bleuet|framboise|mure|cerise|abricot|peche|prune)\b/.test(ing)) return 'lufa';
  if (/\b(oeuf|oeufs)\b/.test(ing)) return 'lufa';
  if (/\b(lait(?! de coco| concentre| evapore))\b/.test(ing)) return 'lufa';
  if (/\b(yogourt|kefir|creme sure|fromage frais|ricotta|quark|cottage)\b/.test(ing)) return 'lufa';
  if (/\b(pain artisan|pain de campagne|baguette|pain au levain)\b/.test(ing)) return 'lufa';

  // COSTCO : achats en gros habituels, grands formats
  if (/\b(parmesan|pecorino|parmigiano|romano)\b/.test(ing)) return 'costco';
  if (/\b(huile (d.)?olive|huile olive)\b/.test(ing)) return 'costco';
  if (/\b(saumon(?! fume))\b/.test(ing)) return 'costco';
  if (/\b(crevette|crevettes)\b/.test(ing)) return 'costco';
  if (/\b(noix(?! de coco| de cajou| muscade))\b/.test(ing)) return 'costco';
  if (/\b(amande|cajou|pistache|noisette|pacane|pecan)\b/.test(ing)) return 'costco';
  if (/\b(pignon)\b/.test(ing)) return 'costco';
  if (/\b(thon en conserve|thon en boite)\b/.test(ing)) return 'costco';
  if (/\b(beurre d.arachide|beurre d'amande)\b/.test(ing)) return 'costco';
  if (/\b(vinaigre balsamique)\b/.test(ing)) return 'costco';

  // AUTRES : ingrédients spécialisés, épiceries ethniques ou en ligne
  if (/\b(capre|anchois|miso|wakame|nori|wasabi|sriracha|tahini|harissa|sumac|za.atar|tamari|sauce poisson|fish sauce|citronnelle|galanga|kaffir|chermoula|dukkah|ras el hanout|gochujang|doubanjiang|shaoxing|mirin|dashi|kombu|bonito)\b/.test(ing)) return 'autres';
  if (/\b(fleur de sel|sel de guerande|truffe|huile de truffe)\b/.test(ing)) return 'autres';

  return 'maxi';
}

// ── Prix Lufa estimés par catégorie ───────────────────────────────────────────
function estimerPrixLufa(ingredient) {
  const ing = ingredient.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/oeuf/.test(ing))                               return { prix: 6.99, unite: '12 unités' };
  if (/lait/.test(ing))                               return { prix: 4.49, unite: '2L' };
  if (/basilic|persil|coriandre|herbe/.test(ing))     return { prix: 2.99, unite: 'bouquet' };
  if (/fromage frais|ricotta|cottage/.test(ing))      return { prix: 7.99, unite: '250g' };
  if (/yogourt/.test(ing))                            return { prix: 5.99, unite: '500g' };
  if (/creme sure/.test(ing))                         return { prix: 3.99, unite: '250ml' };
  if (/epinard|roquette|mesclun/.test(ing))           return { prix: 4.99, unite: '150g' };
  if (/tomate fraiche|tomate cerise/.test(ing))       return { prix: 4.49, unite: '500g' };
  if (/carotte/.test(ing))                            return { prix: 3.49, unite: '1kg' };
  if (/pomme|poire/.test(ing))                        return { prix: 5.99, unite: '1kg' };
  if (/fraise|framboise|bleuet/.test(ing))            return { prix: 5.49, unite: '250g' };
  if (/brocoli|choufleur|fenouil|poireau/.test(ing))  return { prix: 3.99, unite: '1 unité' };
  if (/courgette|aubergine|poivron/.test(ing))        return { prix: 2.99, unite: '2 unités' };
  if (/pain/.test(ing))                               return { prix: 6.99, unite: '1 miche' };
  return { prix: 3.79, unite: '1 unité' };
}

// ── Matching ingrédient ↔ aubaine (Maxi ou Costco) ───────────────────────────
function trouverAubaine(ingredient, deals) {
  const ingLower = ingredient.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return deals.find(deal =>
    (deal.mots_cles || []).some(mc => {
      const mcL = mc.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return ingLower.includes(mcL) || mcL.includes(ingLower.split(' ')[0]);
    })
  );
}

// ── Construire la liste Lufa depuis les ingrédients réels du planning ─────────
function construireListe(ingredients, planning) {
  // Reverse index : ingrédient → liste de recettes qui l'utilisent
  const ingToRecettes = {};
  for (const jour of (planning || [])) {
    if (!jour.recette || jour.recette.nom.startsWith('⚠️')) continue;
    for (const ing of (jour.recette.ingredients || '').split(',').map(s => s.trim()).filter(Boolean)) {
      if (!ingToRecettes[ing]) ingToRecettes[ing] = [];
      if (!ingToRecettes[ing].includes(jour.recette.nom)) {
        ingToRecettes[ing].push(jour.recette.nom);
      }
    }
  }

  return ingredients.map(ing => {
    const { prix, unite } = estimerPrixLufa(ing);
    const recettes = ingToRecettes[ing] || [];
    const raison = recettes.length > 0
      ? recettes.slice(0, 2).join(', ')
      : '';
    return { nom: ing, prix_estime: `${prix.toFixed(2)}$`, unite, raison };
  });
}

// ── Badge d'aubaine ───────────────────────────────────────────────────────────
function AubaineBadge({ deal }) {
  if (!deal) return null;
  return (
    <span className="aubaine-badge" title={deal.rabais || ''}>
      🏷️ {deal.prix_texte || 'Solde'}{deal.rabais ? ` · ${deal.rabais}` : ''}
    </span>
  );
}

// ── Section aubaines d'un magasin (sans routing d'ingrédients) ───────────────
function SectionAubainesStore({ label, emoji, deals, couleur }) {
  if (!deals || deals.length === 0) return null;
  // Filtrer les deals avec un prix réel seulement
  const avecPrix = deals.filter(d => d.prix || d.prix_texte);
  if (avecPrix.length === 0) return null;

  return (
    <div className="epicerie-magasin epicerie-magasin--aubaines-only" style={{ '--magasin-couleur': couleur }}>
      <div className="epicerie-magasin__header">
        <span className="epicerie-magasin__emoji">{emoji}</span>
        <span className="epicerie-magasin__nom">{label}</span>
        <span className="epicerie-magasin__count">{avecPrix.length} soldes</span>
      </div>
      <div className="epicerie-soldes">
        <div className="epicerie-soldes__titre">🏷️ Meilleures aubaines cette semaine</div>
        {avecPrix.slice(0, 8).map((deal, i) => (
          <div key={i} className="epicerie-solde-item">
            <span className="epicerie-solde-nom">{deal.nom}</span>
            {deal.prix_texte && <span className="epicerie-solde-prix">{deal.prix_texte}</span>}
            {deal.rabais && <span className="epicerie-solde-rabais">{deal.rabais}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section par magasin ───────────────────────────────────────────────────────
function SectionMagasin({ label, emoji, ingredients, deals, couleur }) {
  const [cochees, setCochees] = useState(new Set());
  if (ingredients.length === 0) return null;

  const toggle = (ing) => setCochees(prev => {
    const n = new Set(prev); if (n.has(ing)) n.delete(ing); else n.add(ing); return n;
  });

  // Soldes pertinents pour cette section : ceux dont un ingrédient de la liste matche
  const soldesActifs = deals.filter(deal =>
    ingredients.some(ing => trouverAubaine(ing, [deal]))
  );

  return (
    <div className="epicerie-magasin" style={{ '--magasin-couleur': couleur }}>
      <div className="epicerie-magasin__header">
        <span className="epicerie-magasin__emoji">{emoji}</span>
        <span className="epicerie-magasin__nom">{label}</span>
        <span className="epicerie-magasin__count">{ingredients.length} items</span>
      </div>

      {soldesActifs.length > 0 && (
        <div className="epicerie-soldes">
          <div className="epicerie-soldes__titre">🏷️ Soldes cette semaine</div>
          {soldesActifs.map((deal, i) => (
            <div key={i} className="epicerie-solde-item">
              <span className="epicerie-solde-nom">{deal.nom}</span>
              {deal.prix_texte && <span className="epicerie-solde-prix">{deal.prix_texte}</span>}
              {deal.rabais && <span className="epicerie-solde-rabais">{deal.rabais}</span>}
            </div>
          ))}
        </div>
      )}

      <ul className="epicerie-items">
        {ingredients.map((ing, i) => {
          const deal = trouverAubaine(ing, deals);
          const coche = cochees.has(ing);
          return (
            <li
              key={i}
              className={`epicerie-item ${coche ? 'epicerie-item--coche' : ''} ${deal ? 'epicerie-item--solde' : ''}`}
              onClick={() => toggle(ing)}
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
function SectionLufa({ items }) {
  const [cochees, setCochees] = useState(new Set());

  const toggle = (nom) => setCochees(prev => {
    const n = new Set(prev); if (n.has(nom)) n.delete(nom); else n.add(nom); return n;
  });

  const totalEstime = items.reduce((s, i) => s + (parseFloat(i.prix_estime) || 0), 0);
  const totalCoche  = items.filter(i => cochees.has(i.nom)).reduce((s, i) => s + (parseFloat(i.prix_estime) || 0), 0);
  const minOk = totalEstime >= 50;

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
            Total estimé : <strong>{totalEstime.toFixed(2)}$</strong>
            {totalCoche > 0 && <span> · Coché : <strong>{totalCoche.toFixed(2)}$</strong></span>}
            {!minOk && <span className="lufa-min-warning"> · Ajoute des items pour atteindre le minimum</span>}
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
                {item.prix_estime && <span className="epicerie-item__prix">~{item.prix_estime}</span>}
                {item.raison && <span className="epicerie-item__raison">→ {item.raison}</span>}
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

  // Routage dynamique : chaque ingrédient → son magasin, calculé en temps réel
  const parMagasin = useMemo(() => {
    const result = { maxi: [], costco: [], lufa: [], autres: [] };
    for (const ing of ingredients) {
      const mag = routerMagasin(ing);
      result[mag].push(ing);
    }
    return result;
  }, [ingredients]);

  // Liste Lufa construite depuis les ingrédients réels du planning
  const lufaItems = useMemo(() =>
    construireListe(parMagasin.lufa, planning),
  [parMagasin.lufa, planning]);

  const allDeals = [...(aubaines.maxi || []), ...(aubaines.metro || []), ...(aubaines.adonis || []), ...(aubaines.costco || [])];
  const nbSoldesActifs = ingredients.filter(ing => trouverAubaine(ing, allDeals)).length;

  return (
    <section>
      <h2 className="section-heading">Liste d'épicerie</h2>

      <div className="epicerie-container">
        <div className="epicerie-header">
          <span style={{ fontSize: '1.1rem' }}>🛒</span>
          <span className="epicerie-header-title">Provisions de la semaine</span>
          {hasAubaines && nbSoldesActifs > 0 && aubaines.economies_estimees && (
            <span className="epicerie-economies">💰 {nbSoldesActifs} items en solde · économies ~{aubaines.economies_estimees}</span>
          )}
        </div>

        {hasAubaines && aubaines.analyse ? (
          <div className="epicerie-analyse">
            <div className="epicerie-analyse__icon">✦</div>
            <p>{aubaines.analyse}</p>
          </div>
        ) : (
          <div className="epicerie-note-aubaines">
            <span>📅</span>
            <span>Les soldes Maxi, Metro, Adonis et Costco s'afficheront automatiquement chaque vendredi soir.</span>
          </div>
        )}

        {valides.length < 7 && (
          <p className="epicerie-note">Liste basée sur {valides.length} recettes valides.</p>
        )}

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
          {lufaItems.length > 0 && (
            <SectionLufa items={lufaItems} />
          )}
          {parMagasin.autres.length > 0 && (
            <SectionMagasin
              label="Autres / épiceries spécialisées"
              emoji="📦"
              ingredients={parMagasin.autres}
              deals={[]}
              couleur="#888"
            />
          )}
          <SectionAubainesStore
            label="Metro — Aubaines de la semaine"
            emoji="🏪"
            deals={aubaines.metro || []}
            couleur="#e8000d"
          />
          <SectionAubainesStore
            label="Adonis — Aubaines de la semaine"
            emoji="🫒"
            deals={aubaines.adonis || []}
            couleur="#2d6a2d"
          />
        </div>
      </div>
    </section>
  );
}
