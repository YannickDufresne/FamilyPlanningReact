import { calculerPrixFamille } from '../utils/prixFamille';

const JOURS_ENTRAINEMENT = ['Lundi', 'Mercredi', 'Vendredi'];
const REGIME_LABEL = { omnivore: 'omnivore', végétarien: 'végétarien', végane: 'végane' };

function EvalRow({ recette }) {
  const membres = [
    { key: 'eval_patricia', emoji: '💚', nom: 'Patricia' },
    { key: 'eval_yannick',  emoji: '🦉', nom: 'Yannick'  },
    { key: 'eval_joseph',   emoji: '🐤', nom: 'Joseph'   },
    { key: 'eval_mika',     emoji: '🍒', nom: 'Mika'     },
    { key: 'eval_luce',     emoji: '🍒', nom: 'Luce'     },
  ];
  const hasEvals = membres.some(m => recette[m.key] != null && recette[m.key] !== '');
  if (!hasEvals) return null;
  return (
    <div className="eval-grid eval-grid--card">
      {membres.map(m => (
        <div key={m.key} className="eval-member">
          <span className="eval-emoji">{m.emoji}</span>
          <div className="eval-name">{m.nom}</div>
          <div className="eval-score">
            {recette[m.key] != null && recette[m.key] !== '' ? recette[m.key] : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Ventilation du prix par membre de la famille ──────────────────────────
function PrixFamille({ activite, date }) {
  const ventilation = calculerPrixFamille(activite, date);
  const total = ventilation.reduce((s, m) => s + m.prix, 0);
  const hasTieredPricing = activite.cout_adulte !== undefined && activite.cout_adulte !== null;

  // Afficher seulement si au moins un membre paie quelque chose
  const aucunPrix = !hasTieredPricing && (activite.cout ?? 0) === 0;
  if (aucunPrix || total === 0) return null;

  return (
    <div className="prix-famille">
      <div className="prix-famille__titre">
        Prix famille
        {!hasTieredPricing && <span className="prix-famille__estime"> · estimé</span>}
      </div>
      <div className="prix-famille__grille">
        {ventilation.map(m => (
          <div key={m.prenom} className="prix-membre">
            <span className="prix-membre__emoji">{m.emoji}</span>
            <span className="prix-membre__cat">{m.categorie}</span>
            <span className="prix-membre__prix">
              {m.prix > 0 ? `${m.prix} $` : '—'}
            </span>
          </div>
        ))}
      </div>
      <div className="prix-famille__total">
        Total <strong>{total} $</strong>
      </div>
    </div>
  );
}

export default function DayCard({ jour }) {
  const { recette, exercices, activite, musique, emoji, dateCourte } = jour;
  const isWarning = recette.nom.startsWith('⚠️');
  const isTraining = JOURS_ENTRAINEMENT.includes(jour.jour);
  const isRepos = exercices.length === 1 && exercices[0].fonction === 'repos';
  const regimeLabel = REGIME_LABEL[recette.regime_alimentaire];

  return (
    <article className={`day-card ${isWarning ? 'day-card--warning' : ''} ${isTraining ? 'day-card--training' : ''}`}>
      <div className="day-card__accent" />

      {/* En-tête avec date */}
      <div className="day-card__header">
        <div className="day-card__header-left">
          <span className="day-card__jour">{jour.jour}</span>
          <span className="day-card__date">{dateCourte}</span>
        </div>
        <span className="day-card__emoji">{emoji}</span>
        <span className="day-card__theme">{jour.theme.replace(/_/g, '\u00a0')}</span>
      </div>

      {/* Repas */}
      <div className="planning-item">
        <div className="planning-item__label">Repas</div>
        <div className="planning-item__name">
          {recette.nom}
          {regimeLabel && !isWarning && <span className="regime-badge">{regimeLabel}</span>}
        </div>
        {!isWarning && (
          <div className="planning-item__cost">{recette.cout}$ · {recette.temps_preparation} min</div>
        )}
        {!isWarning && recette.ingredients && (
          <div className="planning-item__meta">{recette.ingredients}</div>
        )}
        {isWarning && (
          <div className="planning-item__meta" style={{ color: '#C91D21' }}>{recette.ingredients}</div>
        )}
        {!isWarning && <EvalRow recette={recette} />}
      </div>

      {/* Entraînement */}
      <div className="planning-item">
        <div className="planning-item__label">Entraînement</div>
        {isRepos ? (
          <div className="planning-item__name" style={{ fontStyle: 'italic', fontWeight: 400, fontSize: '0.95rem' }}>
            Repos · récupération
          </div>
        ) : (
          <div className="exercice-list">
            {exercices.map((ex, i) => (
              <div key={i} className="exercice-item">
                {ex.nom}<span style={{ opacity: 0.5, fontSize: '0.75rem' }}> · {ex.duree} min</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activité */}
      <div className="planning-item">
        <div className="planning-item__label">Activité · Québec</div>
        {activite ? (
          <>
            {activite.url ? (
              <a className="planning-item__name planning-item__link"
                href={activite.url} target="_blank" rel="noopener noreferrer">
                {activite.nom}
              </a>
            ) : (
              <div className="planning-item__name">{activite.nom}</div>
            )}
            {activite.lieu && (
              <div className="planning-item__meta">
                {activite.lieu}
                {(() => {
                  const adulte = activite.cout_adulte ?? activite.cout ?? 0;
                  const enfant = activite.cout_enfant;
                  if (adulte > 0) return <> · <span className="prix-adulte">{adulte} $ / adulte</span></>;
                  if (enfant > 0) return <> · <span className="prix-adulte">gratuit adultes</span></>;
                  return ' · gratuit';
                })()}
              </div>
            )}
            {activite.description && (
              <div className="planning-item__meta" style={{ marginTop: 3 }}>
                {activite.description}
              </div>
            )}
            <PrixFamille activite={activite} date={jour.date} />
            {activite.source === 'claude' && (
              <div className="planning-item__badge">✦ Suggestion IA</div>
            )}
          </>
        ) : (
          <div className="planning-item__empty">Aucun événement planifié</div>
        )}
      </div>

      {/* Musique */}
      <div className="planning-item">
        <div className="planning-item__label">Musique</div>
        <div className="planning-item__name">{musique.nom}</div>
        {musique.genre && (
          <div className="planning-item__meta">{musique.genre} · {musique.ambiance}</div>
        )}
      </div>
    </article>
  );
}
