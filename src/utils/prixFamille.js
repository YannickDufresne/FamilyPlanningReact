import famille from '../data/famille.json';

// ── Calcule l'âge révolu à une date de référence ──────────────────────────
function calculerAge(naissance, dateRef) {
  const n = new Date(naissance + 'T12:00:00');
  const d = new Date(dateRef + 'T12:00:00');
  let age = d.getFullYear() - n.getFullYear();
  const dm = d.getMonth() - n.getMonth();
  if (dm < 0 || (dm === 0 && d.getDate() < n.getDate())) age--;
  return age;
}

// ── Catégorie tarifaire selon l'âge ─────────────────────────────────────────
function categorieAge(age) {
  if (age < 5)  return { label: 'bébé',   tier: 'bebe'   };
  if (age < 13) return { label: 'enfant', tier: 'enfant' };
  if (age < 18) return { label: 'ado',    tier: 'ado'    };
  return              { label: 'adulte',  tier: 'adulte' };
}

// ── Ratio de fallback quand le tarif par tranche n'est pas connu ─────────────
// Basé sur les tarifs typiques des institutions culturelles au Québec
const RATIO_FALLBACK = { bebe: 0, enfant: 0.55, ado: 0.80, adulte: 1.0 };

// ── Calcule la ventilation tarifaire pour toute la famille ───────────────────
// activite : objet complet avec cout, cout_adulte, cout_enfant, cout_bebe
// dateActivite : chaîne ISO "2026-03-22" pour calculer les âges au bon moment
export function calculerPrixFamille(activite, dateActivite) {
  const {
    cout_adulte,
    cout_enfant,  // null = inconnu (utiliser ratio), 0 = vraiment gratuit
    cout_bebe,
    cout,
  } = activite;

  // Prix adulte de référence : cout_adulte prioritaire, sinon cout
  const prixAdulte = cout_adulte ?? cout ?? 0;

  // Détermine si on a des tarifs réels par tranche (depuis Claude ou TM)
  const hasTieredPricing = cout_adulte !== undefined && cout_adulte !== null;

  return famille.map(m => {
    const age = calculerAge(m.naissance, dateActivite);
    const { label, tier } = categorieAge(age);

    let prix;

    if (hasTieredPricing) {
      // Vrais tarifs disponibles
      if (tier === 'bebe') {
        prix = cout_bebe ?? 0;
      } else if (tier === 'enfant') {
        // null = inconnu → ratio sur adulte; 0 = gratuit
        prix = cout_enfant !== null && cout_enfant !== undefined
          ? cout_enfant
          : Math.round(prixAdulte * RATIO_FALLBACK.enfant);
      } else if (tier === 'ado') {
        // Les ados paient souvent le tarif enfant ou adulte selon les lieux
        // On utilise le tarif enfant si disponible (souvent similaire), sinon 80%
        prix = cout_enfant !== null && cout_enfant !== undefined
          ? Math.round(cout_enfant * 1.1)   // ado légèrement plus que enfant
          : Math.round(prixAdulte * RATIO_FALLBACK.ado);
      } else {
        prix = prixAdulte;
      }
    } else {
      // Fallback : ratio sur cout
      prix = prixAdulte > 0 ? Math.round(prixAdulte * RATIO_FALLBACK[tier]) : 0;
    }

    return { ...m, age, categorie: label, prix };
  });
}

export { famille };
