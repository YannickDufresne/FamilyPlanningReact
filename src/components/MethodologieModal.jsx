export default function MethodologieModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="methode-modal">
        <button className="methode-modal__close" onClick={onClose}>✕</button>
        <div className="methode-modal__titre">Comment fonctionne le planning</div>
        <p className="methode-modal__intro">
          Une semaine de vie familiale, organisée automatiquement — repas, entraînements,
          sorties et musique — avec des données mises à jour chaque vendredi soir.
        </p>

        <div className="methode-section">
          <div className="methode-section__titre">🍽️ Repas — 7 thèmes fixes</div>
          <p className="methode-section__texte">
            Chaque jour a un thème culinaire : <strong>Pasta Rapido</strong> (lundi),{' '}
            <strong>Bol · Sandwich</strong> (mardi), <strong>Poisson</strong> (mercredi),{' '}
            <strong>Plat en sauce</strong> (jeudi), <strong>Confort grillé</strong> (vendredi),{' '}
            <strong>Pizza</strong> (samedi), <strong>Slow Chic</strong> (dimanche).
            La recette est choisie dans le catalogue (~340 recettes) en respectant les objectifs
            de régime (végane/végétarien) et sans doublon sur la semaine.
          </p>
          <p className="methode-section__texte">
            <strong>Flèches de navigation ‹ N/total ›</strong> — chaque carte affiche le nombre de
            recettes disponibles pour le thème et les filtres actifs. Les flèches permettent de
            les parcourir une par une. Le bouton <strong>+</strong> ouvre le formulaire pour créer
            une recette manuellement ou via l'IA.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🏋️ Entraînement fonctionnel</div>
          <p className="methode-section__texte">
            Programme structuré en 5 phases (échauffement → musculaire → cardio → finition → récupération)
            les lundi, mercredi et vendredi. Les exercices sont sélectionnés avec un seed déterministe
            — stable entre appareils.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🗓️ Activités Québec</div>
          <p className="methode-section__texte">
            Événements récupérés chaque semaine via <strong>Ticketmaster</strong> et des suggestions
            <strong> Claude IA</strong>. Chaque activité reçoit un score de pertinence famille (0–100)
            calculé selon les préférences des membres. Les événements <strong>multi-jours</strong>{' '}
            (ex : Salon du livre, festivals) s'affichent correctement sur toute leur durée grâce au
            champ <em>date_fin</em>. Les activités gratuites sont priorisées les jours désignés.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🎵 Bibliothèque musicale — 295 albums</div>
          <p className="methode-section__texte">
            Une bibliothèque de <strong>295 albums</strong> couvrant plus de 50 pays et cultures :
            Québec (Harmonium, Jean Leloup, Cowboys Fringants…), France (Gainsbourg, Piaf, Stromae…),
            Afrique (Tinariwen, Youssou N'Dour, Oumou Sangaré…), Amérique latine (Piazzolla, Victor Jara,
            Os Mutantes…), Asie (Sheena Ringo, Teresa Teng, AR Rahman…), et bien d'autres.
          </p>
          <p className="methode-section__texte">
            <strong>Recommandation quotidienne</strong> — l'album suggéré chaque jour correspond à
            l'<em>origine culturelle de la recette</em> (ex : recette marocaine → musique du Maghreb).
            Les albums notés ⭐⭐⭐⭐–⭐⭐⭐⭐⭐ sont priorisés.
          </p>
          <p className="methode-section__texte">
            <strong>Chaque album contient :</strong> pochette (Apple Music / iTunes avec validation
            multi-pays), description historique et anecdote en français, indice de consensus (score
            basé sur le classement dans Rolling Stone, Acclaimed Music, RYM…), chips de palmarès
            avec rang précis (ex : <em>Rolling Stone #8</em>), et évaluation personnelle 1–5 ⭐
            sauvegardée localement.
          </p>
          <p className="methode-section__texte">
            La bibliothèque est filtrable par continent, genre, palmarès et note personnelle,
            et triable par année, score ou évaluation.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🛒 Épicerie</div>
          <p className="methode-section__texte">
            La liste est générée automatiquement à partir des recettes confirmées (verrouillées).
            Les recettes non confirmées apparaissent en grisé avec leur total séparé.
            Les aubaines de <strong>Maxi, Metro, Adonis et Costco</strong> sont récupérées chaque
            vendredi — un bouton <em>+ Inclure</em> force un ingrédient en spécial dans le planning.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">✨ Suggestions IA (recettes)</div>
          <p className="methode-section__texte">
            Quand aucune recette n'est disponible avec les filtres actifs, <strong>Claude Haiku</strong>{' '}
            propose une recette adaptée au régime, au budget et aux ingrédients à inclure (inspirée de
            NYT Cooking, Ricardo, Bon Appétit…). Elle peut être sauvegardée définitivement.
          </p>
        </div>

        <div className="methode-section">
          <div className="methode-section__titre">🔄 Mise à jour hebdomadaire</div>
          <p className="methode-section__texte">
            Chaque vendredi soir, un script GitHub Actions régénère automatiquement :
            activités de la semaine suivante, aubaines des épiceries, nouvelles suggestions IA.
            Le planning passe alors à la nouvelle semaine. Les semaines passées restent accessibles
            en historique (lecture seule).
          </p>
        </div>
      </div>
    </div>
  );
}
