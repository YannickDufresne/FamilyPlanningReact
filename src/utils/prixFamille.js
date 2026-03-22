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

// ── Catégorie tarifaire selon l'âge ──────────────────────────────────────
// Basé sur les tarifs typiques des institutions culturelles au Québec :
//   0–4  : bébé/tout-petit → gratuit
//   5–12 : enfant          → ~55 % du tarif adulte
//   13–17: adolescent      → ~80 % (tarif étudiant souvent)
//   18+  : adulte          → tarif plein
function categorieAge(age) {
  if (age < 5)  return { label: 'bébé',   ratio: 0    };
  if (age < 13) return { label: 'enfant', ratio: 0.55 };
  if (age < 18) return { label: 'ado',    ratio: 0.80 };
  return              { label: 'adulte',  ratio: 1.0  };
}

// ── Calcule la ventilation tarifaire pour toute la famille ───────────────
// coutAdulte : prix adulte de l'activité (champ `cout` dans activites.json)
// dateActivite : date ISO "2026-03-22" pour calculer les âges au bon moment
export function calculerPrixFamille(coutAdulte, dateActivite) {
  return famille.map(m => {
    const age = calculerAge(m.naissance, dateActivite);
    const { label, ratio } = categorieAge(age);
    const prix = coutAdulte > 0 ? Math.round(coutAdulte * ratio) : 0;
    return { ...m, age, categorie: label, prix };
  });
}

export { famille };
