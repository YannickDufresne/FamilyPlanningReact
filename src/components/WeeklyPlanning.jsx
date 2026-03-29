import { useState, useMemo } from 'react';
import DayCard from './DayCard';

export default function WeeklyPlanning({ planning, profils = [], joursVerrouilles = new Set(), joursAutoVerrouilles = new Set(), onToggleLockJour, lectureSeule, recettes = [], recettesForcees, recettesExplicites, onChoisirRecette, filtres = {}, ingredientsForces = [], onSauvegarderRecette }) {
  const [modesActivite, setModesActivite] = useState(() =>
    Object.fromEntries((planning || []).map(j => [j.jour, 'famille']))
  );

  const recettesSemaine = useMemo(
    () => (planning || []).map(j => j?.recette?.nom).filter(n => n && !n.startsWith('⚠️')),
    [planning]
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
            estAutoVerrouille={joursAutoVerrouilles.has(i)}
            onToggleLock={onToggleLockJour && !lectureSeule && !joursAutoVerrouilles.has(i) ? () => onToggleLockJour(i) : null}
            recettes={recettes}
            filtres={filtres}
            recetteForceNom={recettesExplicites?.has(i) ? (recettesForcees?.get(i) || null) : null}
            onChoisirRecette={onChoisirRecette ? (recetteNom) => onChoisirRecette(i, recetteNom) : null}
            ingredientsForces={ingredientsForces}
            onSauvegarderRecette={onSauvegarderRecette}
            recettesSemaine={recettesSemaine}
          />
        ))}
      </div>
    </section>
  );
}
