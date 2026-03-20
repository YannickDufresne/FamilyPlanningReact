import { genererListeEpicerie } from '../utils/planning';

export default function GroceryList({ planning }) {
  const ingredients = genererListeEpicerie(planning);
  if (!planning || ingredients.length === 0) return null;

  const valides = planning.filter(j => !j.recette.nom.startsWith('⚠️'));

  return (
    <div className="epicerie-container">
      <div className="epicerie-header">🛒 Liste d'épicerie de la semaine</div>
      <div className="epicerie-content">
        {valides.length < 7 && (
          <p style={{ color: '#6c757d', fontStyle: 'italic', marginBottom: 10, fontSize: 12 }}>
            Liste basée sur {valides.length} recettes valides
          </p>
        )}
        <div className="epicerie-list">
          <ul>
            {ingredients.map(ing => <li key={ing}>{ing}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
