const REGIME_ICON = { omnivore: '🥩', végétarien: '🥗', végane: '🌿' };

function EvalGrid({ recette }) {
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
    <div className="eval-grid" style={{ marginTop: 8 }}>
      {membres.map(m => (
        <div key={m.key} className="eval-member">
          <span className="eval-emoji">{m.emoji}</span>
          <div className="eval-name">{m.nom}</div>
          <div className="eval-score">{recette[m.key] != null && recette[m.key] !== '' ? `${recette[m.key]}/5` : '—'}</div>
        </div>
      ))}
    </div>
  );
}

export default function DayCard({ jour }) {
  const { recette, exercices, activite, musique, emoji } = jour;
  const isWarning = recette.nom.startsWith('⚠️');
  const regimeIcon = REGIME_ICON[recette.regime_alimentaire] || '🍽️';
  const isRepos = exercices.length === 1 && exercices[0].fonction === 'repos';

  return (
    <div className={`day-card ${isWarning ? 'day-card--warning' : ''}`}>
      {/* En-tête du jour */}
      <div className="day-card__header">
        <span className="day-card__emoji">{emoji}</span>
        <div>
          <div className="day-card__jour">{jour.jour}</div>
          <div className="day-card__theme">{jour.theme.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {/* Recette */}
      <div className="planning-item">
        <span className="item-icon">🍽️</span>
        <strong>{recette.nom}</strong>
        {!isWarning && (
          <span style={{ marginLeft: 6, color: '#6c757d', fontSize: 12 }}>
            {regimeIcon} {recette.cout}$ · {recette.temps_preparation} min
          </span>
        )}
        {isWarning && (
          <div style={{ color: '#856404', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
            {recette.ingredients}
          </div>
        )}
        {!isWarning && recette.ingredients && (
          <div style={{ fontSize: 11, color: '#6c757d', marginTop: 3 }}>
            {recette.ingredients}
          </div>
        )}
        {!isWarning && <EvalGrid recette={recette} />}
      </div>

      {/* Exercices */}
      <div className="planning-item">
        <span className="item-icon">💪</span>
        {isRepos ? (
          <span>{exercices[0].nom}</span>
        ) : (
          <div>
            <strong>Entraînement</strong>
            <div style={{ fontSize: 11, color: '#6c757d', marginTop: 3 }}>
              {exercices.map((ex, i) => (
                <div key={i}>• {ex.nom} ({ex.duree} min)</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activité */}
      <div className="planning-item">
        <span className="item-icon">🎭</span>
        <strong>{activite.nom}</strong>
        {activite.lieu && (
          <div style={{ fontSize: 11, color: '#6c757d', marginTop: 2 }}>
            📍 {activite.lieu}{activite.cout > 0 ? ` · ${activite.cout}$` : ' · Gratuit'}
          </div>
        )}
      </div>

      {/* Musique */}
      <div className="planning-item" style={{ borderBottom: 'none' }}>
        <span className="item-icon">🎵</span>
        <strong>{musique.nom}</strong>
        {musique.genre && (
          <div style={{ fontSize: 11, color: '#6c757d', marginTop: 2 }}>
            {musique.genre} · {musique.ambiance}
          </div>
        )}
      </div>
    </div>
  );
}
