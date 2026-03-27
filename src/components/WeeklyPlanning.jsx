import { useState } from 'react';
import DayCard from './DayCard';

export default function WeeklyPlanning({ planning, profils = [], joursVerrouilles = new Set(), onToggleLockJour, lectureSeule, recettes = [], recettesForcees, onChoisirRecette, filtres = {} }) {
  const [modesActivite, setModesActivite] = useState(() =>
    Object.fromEntries((planning || []).map(j => [j.jour, 'famille']))
  );

  if (!planning) {
    return (
      <div className="alert-warning">
        <h5>⚠️ Planning impossible avec ces contraintes</h5>
        <ul>
          <li>Réduire le nombre de repas végétariens ou véganes</li>
          <li>Augmenter le coût maximum par recette</li>
          <li>Augmenter le temps total de cuisine</li>
          <li>Choisir une autre origine culturelle</li>
        </ul>
      </div>
    );
  }

  return (
    <section>
      <h2 className="section-heading">Calendrier de la semaine</h2>
      <div className="week-grid">
        {planning.map((jour, i) => (
          <DayCard
            key={jour.jour}
            jour={jour}
            index={i}
            modeActivite={modesActivite[jour.jour] ?? 'famille'}
            onToggleModeActivite={(mode) =>
              setModesActivite(prev => ({ ...prev, [jour.jour]: mode }))
            }
            profils={profils}
            estVerrouille={joursVerrouilles.has(i)}
            onToggleLock={onToggleLockJour && !lectureSeule ? () => onToggleLockJour(i) : null}
            recettes={recettes}
            filtres={filtres}
            recetteForceNom={recettesForcees?.get(i) || null}
            onChoisirRecette={onChoisirRecette ? (recetteNom) => onChoisirRecette(i, recetteNom) : null}
          />
        ))}
      </div>
    </section>
  );
}
