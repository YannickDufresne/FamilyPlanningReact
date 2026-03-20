import DayCard from './DayCard';

export default function WeeklyPlanning({ planning }) {
  if (!planning) {
    return (
      <div className="alert-warning">
        <h5>⚠️ Planning impossible avec ces contraintes</h5>
        <p>Suggestions :</p>
        <ul>
          <li>Réduire le nombre de repas végétariens/véganes</li>
          <li>Augmenter le coût maximum par recette</li>
          <li>Augmenter le temps total de cuisine</li>
          <li>Choisir une autre origine culturelle</li>
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h4>Calendrier de la semaine</h4>
      <div className="week-grid">
        {planning.map(jour => (
          <DayCard key={jour.jour} jour={jour} />
        ))}
      </div>
    </div>
  );
}
