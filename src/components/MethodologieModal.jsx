export default function MethodologieModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="methode-modal">
        <button className="methode-modal__close" onClick={onClose}>✕</button>
        <div className="methode-modal__titre">Comment fonctionne le planning</div>
        <p className="methode-modal__intro">
          Une semaine de vie familiale, organisée automatiquement chaque semaine — repas, entraînements,
          sorties et musique — avec des données mises à jour chaque vendredi soir.
        </p>

        <div className="methode-section">
          <div className="methode-section__titre">🍽️ Repas — 7 thèmes fixes</div>
          <p className="methode-section__texte">
            Chaque jour de la semaine a un thème culinaire : <strong>Pasta Rapido</strong> (lundi),
            <strong> Bol · Sandwich</strong> (mardi), <strong>Poisson</strong> (mercredi),
            <strong> Plat en sauce</strong> (jeudi), <strong>Confort grillé</strong> (vendredi),
            <strong> Pizza</strong> (samedi), <strong>Slow Chic</strong> (dimanche).
            La recette est choisie aléatoirement dans le catalogue (~340 recettes) en respectant
            les objectifs de régime (végane/végétarien), sans doublon sur la semaine.
            Les ingrédients en spécial peuvent être forcés via la sidebar.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🏋️ Entraînement fonctionnel</div>
          <p className="methode-section__texte">
            Programme structuré en 5 fonctions (échauffement → musculaire → cardio → finition → récupération)
            les lundi, mercredi et vendredi. Les autres jours sont des jours de repos.
            Les exercices sont sélectionnés par phase avec un seed déterministe — stable entre appareils.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🗺 Activités Québec</div>
          <p className="methode-section__texte">
            Événements récupérés chaque semaine via <strong>Ticketmaster</strong> et des
            suggestions <strong>Claude IA</strong>. Chaque activité reçoit un score de pertinence
            famille (0–100) calculé par l'IA selon les préférences des membres.
            Anti-doublon cross-jour : une même activité ne peut pas être proposée deux jours de suite.
            Les activités gratuites sont priorisées les jours désignés dans les préférences.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🎵 Musique</div>
          <p className="methode-section__texte">
            L'album ou artiste suggéré correspond à l'<strong>origine culturelle de la recette du jour</strong>
            (ex: recette italienne → musique italienne). En cas de filtre d'origine actif, toute la semaine
            reste dans cette couleur musicale.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🛒 Épicerie</div>
          <p className="methode-section__texte">
            La liste d'épicerie est générée automatiquement à partir des recettes confirmées (verrouillées).
            Les recettes non confirmées apparaissent en grisé avec leur total séparé.
            Les aubaines de <strong>Maxi, Metro, Adonis et Costco</strong> sont récupérées chaque vendredi
            et un bouton <em>+ Inclure</em> permet de forcer un ingrédient en spécial dans le planning.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">✨ Suggestions IA (recettes manquantes)</div>
          <p className="methode-section__texte">
            Quand aucune recette n'est disponible pour un thème avec les filtres actuels, un bouton
            active <strong>Claude Haiku</strong> qui propose une recette de qualité (NYT Cooking, Ricardo,
            Bon Appétit…) adaptée au régime, au budget et aux ingrédients à inclure.
            La recette peut être sauvegardée définitivement dans la bibliothèque.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🔄 Mise à jour hebdomadaire</div>
          <p className="methode-section__texte">
            Chaque vendredi soir, un script GitHub Actions régénère automatiquement les données :
            activités de la semaine suivante, aubaines des épiceries, nouvelles suggestions IA.
            Le planning passe alors à la nouvelle semaine. Les semaines passées restent accessibles
            en historique (lecture seule).
          </p>
        </div>
      </div>
    </div>
  );
}
