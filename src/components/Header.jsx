import meta from '../data/meta.json';

export default function Header({ onViewRecettes, onViewActivites, onViewEpicerie, onViewUpdate, onViewProfils, onViewMethode, onViewAlbums, onViewFilms, photoUrl, activeView }) {

  // Date d'aujourd'hui (pas la semaine — la date précise du jour)
  const aujourdhui = new Date().toLocaleDateString('fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Date de mise à jour des données
  const maj = new Date((meta.lastUpdated || '').split('T')[0] + 'T12:00:00')
    .toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

  // Santé globale des sources (dot vert/rouge)
  const sources = meta.sources || {};
  const anyError = Object.values(sources).some(s => s?.statut === 'erreur');
  const anyOk    = Object.values(sources).some(s => s?.statut === 'ok');
  const dotColor = anyError ? '#c0392b' : anyOk ? 'var(--sage)' : 'var(--ink-3)';
  const dotTitle = anyError ? 'Une ou plusieurs sources ont des erreurs' : anyOk ? 'Toutes les sources fonctionnent' : 'Données non disponibles';

  return (
    <header className="main-header">
      <button
        className="family-photo-container family-photo-btn"
        onClick={onViewProfils}
        title="Voir et modifier les profils de la famille"
        aria-label="Profils de la famille"
      >
        <img
          src={photoUrl || `${import.meta.env.BASE_URL}family_photo.jpg`}
          alt="Portrait de famille"
          className="family-photo"
        />
        <span className="family-photo-hint">✏️</span>
      </button>

      <div className="header-content">
        <h1>Planification familiale</h1>
        <p className="header-subtitle">
          <button
            className={`header-nav-link${activeView === 'recettes' ? ' header-nav-link--active' : ''}`}
            onClick={onViewRecettes}
          >🍽️ Recettes</button>
          &nbsp;·&nbsp;
          <button
            className={`header-nav-link${activeView === 'activites' ? ' header-nav-link--active' : ''}`}
            onClick={onViewActivites}
          >🗓️ Activités</button>
          &nbsp;·&nbsp;
          <button
            className={`header-nav-link${activeView === 'epicerie' ? ' header-nav-link--active' : ''}`}
            onClick={onViewEpicerie}
          >🛒 Épicerie</button>
          &nbsp;·&nbsp;
          <button
            className={`header-nav-link${activeView === 'albums' ? ' header-nav-link--active' : ''}`}
            onClick={onViewAlbums}
          >🎵 Musique</button>
          &nbsp;·&nbsp;
          <button
            className={`header-nav-link${activeView === 'films' ? ' header-nav-link--active' : ''}`}
            onClick={onViewFilms}
          >🎬 Films</button>
        </p>
      </div>

      <div className="header-meta">
        {/* Date du jour */}
        <div className="header-aujourd-hui">{aujourdhui}</div>

        {/* Mise à jour + dot de santé */}
        <button className="header-maj header-maj--btn" onClick={onViewUpdate} title={dotTitle}>
          <span className="header-maj-dot" style={{ background: dotColor }} title={dotTitle} />
          Mis à jour le {maj}
        </button>

        {/* Méthode & Système — discret, en dessous */}
        {onViewMethode && (
          <button className="header-methode-link" onClick={onViewMethode}>
            📖 Méthode &amp; Système
          </button>
        )}
      </div>
    </header>
  );
}
