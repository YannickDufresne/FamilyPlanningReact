import { genererListeEpicerie } from '../utils/planning';

export default function GroceryList({ planning }) {
  const ingredients = genererListeEpicerie(planning);
  if (!planning || ingredients.length === 0) return null;

  const valides = planning.filter(j => !j.recette.nom.startsWith('⚠️'));

  return (
    <section>
      <h2 className="section-heading">Liste d'épicerie</h2>
      <div className="epicerie-container">
        <div className="epicerie-header">
          <span style={{ fontSize: '1.1rem' }}>🛒</span>
          <span className="epicerie-header-title">Provisions de la semaine</span>
        </div>
        <div className="epicerie-content">
          {valides.length < 7 && (
            <p className="epicerie-note">
              Liste établie sur la base de {valides.length} recettes valides.
            </p>
          )}
          <div className="epicerie-list">
            <ul>
              {ingredients.map(ing => <li key={ing}>{ing}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
