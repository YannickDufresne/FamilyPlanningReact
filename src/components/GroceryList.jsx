import { useState, useMemo } from 'react';
import aubaines from '../data/aubaines.json';

// ── Normalisation ─────────────────────────────────────────────────────────────
function norm(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── Routage par magasin ───────────────────────────────────────────────────────
function routerMagasin(ingredient) {
  const ing = norm(ingredient);

  if (/\b(carotte|courgette|brocoli|chou|laitue|concombre|poivron|celeri|radis|betterave|navet|poireau|asperge|haricot vert|endive|roquette|mesclun|epinard|potiron|courge|butternut|fenouil|panais|aubergine|artichaut)\b/.test(ing)) return 'lufa';
  if (/\b(tomate fraiche|tomate cerise|tomates fraiches)\b/.test(ing)) return 'lufa';
  if (/\b(basilic|persil|coriandre|menthe|aneth|estragon|ciboulette|sarriette)\b/.test(ing) && !/seche|sec|poudre|moulu/.test(ing)) return 'lufa';
  if (/\b(pomme|poire|fraise|bleuet|framboise|mure|cerise|abricot|peche|prune)\b/.test(ing)) return 'lufa';
  if (/\b(oeuf|oeufs)\b/.test(ing)) return 'lufa';
  if (/\b(lait(?! de coco| concentre| evapore))\b/.test(ing)) return 'lufa';
  if (/\b(yogourt|kefir|creme sure|fromage frais|ricotta|quark|cottage)\b/.test(ing)) return 'lufa';
  if (/\b(pain artisan|pain de campagne|baguette|pain au levain)\b/.test(ing)) return 'lufa';

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

  if (/\b(capre|anchois|miso|wakame|nori|wasabi|sriracha|tahini|harissa|sumac|za.atar|tamari|sauce poisson|fish sauce|citronnelle|galanga|kaffir|chermoula|dukkah|ras el hanout|gochujang|doubanjiang|shaoxing|mirin|dashi|kombu|bonito)\b/.test(ing)) return 'autres';
  if (/\b(fleur de sel|sel de guerande|truffe|huile de truffe)\b/.test(ing)) return 'autres';

  return 'maxi';
}

// ── Prix Lufa estimés par catégorie ──────────────────────────────────────────
function estimerPrixLufa(ingredient) {
  const ing = norm(ingredient);
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

// ── Matching ingrédient ↔ aubaine ─────────────────────────────────────────────
function trouverAubaine(ingredient, deals) {
  const ingL = norm(ingredient);
  return deals.find(deal =>
    (deal.mots_cles || []).some(mc => {
      const mcL = norm(mc);
      return ingL.includes(mcL) || mcL.includes(ingL.split(' ')[0]);
    })
  );
}

// ── Construire items Lufa depuis planning ─────────────────────────────────────
function construireLufa(ingredients, planning) {
  const ingToRecettes = {};
  for (const jour of (planning || [])) {
    if (!jour.recette || jour.recette.nom.startsWith('⚠️')) continue;
    for (const ing of (jour.recette.ingredients || '').split(',').map(s => s.trim()).filter(Boolean)) {
      if (!ingToRecettes[ing]) ingToRecettes[ing] = [];
      if (!ingToRecettes[ing].includes(jour.recette.nom)) ingToRecettes[ing].push(jour.recette.nom);
    }
  }
  return ingredients.map(ing => {
    const { prix, unite } = estimerPrixLufa(ing);
    return { nom: ing, prix_estime: prix, unite, raison: (ingToRecettes[ing] || []).slice(0, 2).join(', ') };
  });
}

// ── Section Magasin ───────────────────────────────────────────────────────────
function SectionMagasin({ label, emoji, couleur, ingredientsChoisis, ingredientsProposés, deals, cochees, onToggle }) {
  const tous = [...ingredientsChoisis, ...ingredientsProposés];
  if (tous.length === 0) return null;

  const nbCochees = tous.filter(ing => cochees.has(ing)).length;

  return (
    <div className="epicerie-magasin" style={{ '--magasin-couleur': couleur }}>
      <div className="epicerie-magasin__header">
        <span className="epicerie-magasin__emoji">{emoji}</span>
        <span className="epicerie-magasin__nom">{label}</span>
        <span className="epicerie-magasin__count">
          {nbCochees > 0
            ? <>{tous.length - nbCochees} à acheter · <span className="epicerie-magasin__coche">{nbCochees} déjà à la maison</span></>
            : <>{tous.length} items</>
          }
        </span>
      </div>
      <ul className="epicerie-items">
        {ingredientsChoisis.map((ing, i) => {
          const deal = trouverAubaine(ing, deals);
          const coche = cochees.has(ing);
          return (
            <li key={`c-${i}`} className={`epicerie-item ${coche ? 'epicerie-item--coche' : ''} ${deal ? 'epicerie-item--solde' : ''}`} onClick={() => onToggle(ing)}>
              <span className="epicerie-item__check">{coche ? '☑' : '☐'}</span>
              <span className="epicerie-item__nom">{ing}</span>
              {deal && <span className="aubaine-badge">🏷️ {deal.prix_texte || 'Solde'}</span>}
            </li>
          );
        })}
        {ingredientsProposés.map((ing, i) => {
          const deal = trouverAubaine(ing, deals);
          const coche = cochees.has(ing);
          return (
            <li key={`p-${i}`} className={`epicerie-item epicerie-item--propose ${coche ? 'epicerie-item--coche' : ''} ${deal ? 'epicerie-item--solde' : ''}`} onClick={() => onToggle(ing)}>
              <span className="epicerie-item__check">{coche ? '☑' : '☐'}</span>
              <span className="epicerie-item__nom">{ing}</span>
              {deal && <span className="aubaine-badge">🏷️ {deal.prix_texte || 'Solde'}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Section Lufa ──────────────────────────────────────────────────────────────
function SectionLufa({ items, onAddIngredientForce, onRemoveIngredientForce, ingredientsForces = [], cochees, onToggle }) {
  const totalEstime = items.reduce((s, i) => s + i.prix_estime, 0);
  const deductionLufa = items.filter(i => cochees.has(i.nom)).reduce((s, i) => s + i.prix_estime, 0);
  const totalNet = totalEstime - deductionLufa;
  const minOk = totalNet >= 50;

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
            Total estimé : <strong>{totalNet.toFixed(2)}$</strong>
            {deductionLufa > 0 && <span className="lufa-deduction"> (−{deductionLufa.toFixed(2)}$ déjà à la maison)</span>}
            {!minOk && <span className="lufa-min-warning"> · Ajoute des items (min. 50$)</span>}
          </div>
        </div>
      </div>

      <ul className="epicerie-items epicerie-items--lufa">
        {items.map((item, i) => {
          const coche = cochees.has(item.nom);
          const dejaForce = ingredientsForces.includes(item.nom);
          return (
            <li key={i} className={`epicerie-item epicerie-item--lufa ${coche ? 'epicerie-item--coche' : ''}`} onClick={() => onToggle(item.nom)}>
              <span className="epicerie-item__check">{coche ? '☑' : '☐'}</span>
              <div className="epicerie-item__lufa-content">
                <span className="epicerie-item__nom">{item.nom}</span>
                {item.unite && <span className="epicerie-item__unite">{item.unite}</span>}
                <span className="epicerie-item__prix">~{item.prix_estime.toFixed(2)}$</span>
                {item.raison && <span className="epicerie-item__raison">→ {item.raison}</span>}
              </div>
              {onAddIngredientForce && !dejaForce && (
                <button
                  className="epicerie-item__force-btn"
                  onClick={e => { e.stopPropagation(); onAddIngredientForce(item.nom); }}
                  title="Inclure dans les recettes"
                >+ Inclure</button>
              )}
              {dejaForce && (
                <button
                  className="epicerie-item__force-active epicerie-item__force-active--btn"
                  onClick={e => { e.stopPropagation(); onRemoveIngredientForce && onRemoveIngredientForce(item.nom); }}
                  title="Retirer l'inclusion forcée"
                >✓ Inclus ✕</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function GroceryList({ planning, joursChoisis, ingredientsForces = [], onAddIngredientForce, onRemoveIngredientForce }) {
  const [cochees, setCochees] = useState(new Set());

  const toggle = (ing) => setCochees(prev => {
    const n = new Set(prev);
    n.has(ing) ? n.delete(ing) : n.add(ing);
    return n;
  });

  // Séparer les ingrédients par statut
  const { ingredientsChoisisSet, ingredientsProposésSet } = useMemo(() => {
    const choisis = new Set();
    const proposes = new Set();
    for (let i = 0; i < (planning || []).length; i++) {
      const jour = planning[i];
      if (!jour?.recette || jour.recette.nom.startsWith('⚠️')) continue;
      const ings = (jour.recette.ingredients || '').split(',').map(s => s.trim()).filter(Boolean);
      const estChoisi = joursChoisis?.has(i);
      for (const ing of ings) {
        if (estChoisi) choisis.add(ing);
        else proposes.add(ing);
      }
    }
    proposes.forEach(ing => { if (choisis.has(ing)) proposes.delete(ing); });
    return { ingredientsChoisisSet: choisis, ingredientsProposésSet: proposes };
  }, [planning, joursChoisis]);

  const tousIngredients = useMemo(() =>
    [...ingredientsChoisisSet, ...ingredientsProposésSet],
  [ingredientsChoisisSet, ingredientsProposésSet]);

  const valides = (planning || []).filter(j => !j?.recette?.nom?.startsWith('⚠️'));
  if (!planning || tousIngredients.length === 0) return null;

  // Routage par magasin
  const parMagasin = useMemo(() => {
    const r = { maxi: { c: [], p: [] }, costco: { c: [], p: [] }, lufa: { c: [], p: [] }, autres: { c: [], p: [] } };
    for (const ing of ingredientsChoisisSet)  r[routerMagasin(ing)].c.push(ing);
    for (const ing of ingredientsProposésSet) r[routerMagasin(ing)].p.push(ing);
    return r;
  }, [ingredientsChoisisSet, ingredientsProposésSet]);

  const lufaItems = useMemo(() =>
    construireLufa([...parMagasin.lufa.c, ...parMagasin.lufa.p], planning),
  [parMagasin.lufa, planning]);

  // Totaux par type de jour
  const { totalChoisi, totalPropose } = useMemo(() => {
    let choisi = 0, propose = 0;
    (planning || []).forEach((j, i) => {
      if (!j?.recette || j.recette.nom.startsWith('⚠️')) return;
      const cout = j.recette.cout || 0;
      if (joursChoisis?.has(i)) choisi += cout;
      else propose += cout;
    });
    return { totalChoisi: choisi, totalPropose: propose };
  }, [planning, joursChoisis]);

  // Déduction proportionnelle pour items bifés (hors Lufa — Lufa gère la sienne)
  const deductionRecettes = useMemo(() => {
    if (cochees.size === 0) return 0;
    let total = 0;
    for (const jour of (planning || [])) {
      if (!jour?.recette || jour.recette.nom.startsWith('⚠️')) continue;
      const ings = (jour.recette.ingredients || '').split(',').map(s => s.trim()).filter(Boolean);
      if (ings.length === 0) continue;
      // Ne compter que les ingrédients non-Lufa bifés
      const nbBiffes = ings.filter(ing => cochees.has(ing) && routerMagasin(ing) !== 'lufa').length;
      const nbNonLufa = ings.filter(ing => routerMagasin(ing) !== 'lufa').length;
      if (nbBiffes > 0 && nbNonLufa > 0) {
        total += (nbBiffes / nbNonLufa) * (jour.recette.cout || 0);
      }
    }
    return total;
  }, [cochees, planning]);

  const deductionLufaTotal = useMemo(() =>
    lufaItems.filter(item => cochees.has(item.nom)).reduce((s, item) => s + item.prix_estime, 0),
  [cochees, lufaItems]);

  const deductionTotale = deductionRecettes + deductionLufaTotal;

  const allDeals = [...(aubaines.maxi || []), ...(aubaines.metro || []), ...(aubaines.adonis || []), ...(aubaines.costco || [])];
  const nbSoldesChoisis = [...ingredientsChoisisSet].filter(ing => trouverAubaine(ing, allDeals)).length;

  // Partager vers Rappels Apple (Web Share API → clipboard fallback)
  function partagerVersRappels() {
    const aAcheter = tousIngredients.filter(ing => !cochees.has(ing));
    const texte = aAcheter.join('\n');
    if (navigator.share) {
      navigator.share({ title: '🛒 Épicerie famille', text: texte }).catch(() => {});
    } else {
      navigator.clipboard.writeText(texte).then(() => {
        alert('✅ Liste copiée ! Colle-la dans l\'app Rappels.');
      }).catch(() => {
        alert('Impossible de copier automatiquement. Voici la liste :\n\n' + texte);
      });
    }
  }

  return (
    <section className="epicerie-liste-section">
      <div className="epicerie-container">
        <div className="epicerie-header">
          <span style={{ fontSize: '1.1rem' }}>📋</span>
          <span className="epicerie-header-title">Ma liste d'épicerie</span>
          {nbSoldesChoisis > 0 && (
            <span className="epicerie-economies">🏷️ {nbSoldesChoisis} item{nbSoldesChoisis > 1 ? 's' : ''} en solde</span>
          )}
          <button className="epicerie-rappels-btn" onClick={partagerVersRappels} title="Envoyer vers l'app Rappels">
            📲 Rappels
          </button>
        </div>

        {/* Totaux */}
        <div className="epicerie-totaux">
          {joursChoisis && joursChoisis.size > 0 ? (
            <>
              <div className="epicerie-total epicerie-total--choisi">
                <span className="epicerie-total__label">Recettes confirmées</span>
                <span className="epicerie-total__montant">{totalChoisi.toFixed(0)} $</span>
              </div>
              {totalPropose > 0 && (
                <div className="epicerie-total epicerie-total--propose">
                  <span className="epicerie-total__label">Recettes proposées</span>
                  <span className="epicerie-total__montant">+ {totalPropose.toFixed(0)} $</span>
                </div>
              )}
            </>
          ) : (
            <div className="epicerie-total">
              <span className="epicerie-total__label">Estimation semaine</span>
              <span className="epicerie-total__montant">{(totalChoisi + totalPropose).toFixed(0)} $</span>
            </div>
          )}
          {deductionTotale > 1 && (
            <div className="epicerie-total epicerie-total--deduction">
              <span className="epicerie-total__label">Déjà à la maison ({cochees.size} items)</span>
              <span className="epicerie-total__montant">−{deductionTotale.toFixed(0)} $</span>
            </div>
          )}
        </div>

        {valides.length < 7 && (
          <p className="epicerie-note">Liste basée sur {valides.length} recettes valides.</p>
        )}

        {/* Légende si mix choisi/proposé */}
        {joursChoisis && joursChoisis.size > 0 && ingredientsProposésSet.size > 0 && (
          <div className="epicerie-legende">
            <span className="epicerie-legende__choisi">● Recette confirmée</span>
            <span className="epicerie-legende__propose">● En attente de confirmation</span>
          </div>
        )}

        <div className="epicerie-magasins">
          <SectionMagasin
            label="Maxi — René-Lévesque"
            emoji="🏪"
            couleur="#e3142c"
            ingredientsChoisis={parMagasin.maxi.c}
            ingredientsProposés={parMagasin.maxi.p}
            deals={[...(aubaines.maxi || []), ...(aubaines.metro || [])]}
            cochees={cochees}
            onToggle={toggle}
          />
          <SectionMagasin
            label="Costco"
            emoji="🏬"
            couleur="#00529F"
            ingredientsChoisis={parMagasin.costco.c}
            ingredientsProposés={parMagasin.costco.p}
            deals={aubaines.costco || []}
            cochees={cochees}
            onToggle={toggle}
          />
          {lufaItems.length > 0 && (
            <SectionLufa
              items={lufaItems}
              onAddIngredientForce={onAddIngredientForce}
              onRemoveIngredientForce={onRemoveIngredientForce}
              ingredientsForces={ingredientsForces}
              cochees={cochees}
              onToggle={toggle}
            />
          )}
          {(parMagasin.autres.c.length > 0 || parMagasin.autres.p.length > 0) && (
            <SectionMagasin
              label="Épiceries spécialisées"
              emoji="📦"
              couleur="#888"
              ingredientsChoisis={parMagasin.autres.c}
              ingredientsProposés={parMagasin.autres.p}
              deals={[]}
              cochees={cochees}
              onToggle={toggle}
            />
          )}
        </div>
      </div>
    </section>
  );
}
