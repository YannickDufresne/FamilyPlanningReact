import meta from '../data/meta.json';

function formatSemaine(debut, fin) {
  const opts = { day: 'numeric', month: 'long' };
  const locale = 'fr-CA';
  const d = new Date(debut + 'T12:00:00');
  const f = new Date(fin + 'T12:00:00');
  if (d.getMonth() === f.getMonth()) {
    return `${d.getDate()} – ${f.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  return `${d.toLocaleDateString(locale, opts)} – ${f.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

// Petit rond coloré selon le statut de la source
function SourceDot({ statut, label }) {
  const color = statut === 'ok' ? 'var(--sage)' : statut === 'erreur' ? '#c0392b' : 'var(--ink-3)';
  const title = statut === 'ok' ? `${label} — OK` : statut === 'erreur' ? `${label} — Erreur` : `${label} — Non utilisé`;
  return (
    <span
      className="source-dot"
      style={{ background: color }}
      title={title}
      aria-label={title}
    />
  );
}

export default function Header({ onViewRecettes, onViewActivites, onViewEpicerie, onViewUpdate, onViewProfils, onViewMethode, onViewAlbums, photoUrl, activeView }) {
  const semaine = formatSemaine(meta.semaine.debut, meta.semaine.fin);
  const maj = new Date((meta.lastUpdated || '').split('T')[0] + 'T12:00:00')
    .toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

  const sources = meta.sources || {};
  const tmStatut     = sources.ticketmaster?.statut    ?? 'absent';
  const claudeStatut = (sources.claude?.statut === 'ok' || sources.claude_gratuites?.statut === 'ok') ? 'ok'
                     : (sources.claude?.statut === 'erreur') ? 'erreur' : 'absent';
  const wsStatut     = sources.web_search?.statut      ?? 'absent';
  const ebStatut     = sources.eventbrite?.statut      ?? 'absent';

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
        <h1>Planning Hebdomadaire</h1>
        <p className="header-subtitle">
          <button
            className={`header-nav-link${activeView === 'recettes' ? ' header-nav-link--active' : ''}`}
            onClick={onViewRecettes}
          >Bibliothèque de recettes</button>
          &nbsp;·&nbsp;
          <button
            className={`header-nav-link${activeView === 'activites' ? ' header-nav-link--active' : ''}`}
            onClick={onViewActivites}
          >Activités</button>
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
            className="header-nav-link"
            onClick={onViewMethode}
            title="Comment fonctionne le planning"
          >📖 Méthode</button>
        </p>
      </div>

      <div className="header-meta">
        <div className="header-semaine">{semaine}</div>
        <button className="header-maj header-maj--btn" onClick={onViewUpdate} title="Voir les détails de la mise à jour">
          Mis à jour le {maj}
          &nbsp;·&nbsp;
          <SourceDot statut={tmStatut} label="Ticketmaster" />
          <span className="source-label">Ticketmaster</span>
          &nbsp;·&nbsp;
          <SourceDot statut={claudeStatut} label="Claude IA" />
          <span className="source-label">Claude IA</span>
          {wsStatut !== 'absent' && (
            <>
              &nbsp;·&nbsp;
              <SourceDot statut={wsStatut} label="Web Search" />
              <span className="source-label">Web</span>
            </>
          )}
          {ebStatut !== 'absent' && (
            <>
              &nbsp;·&nbsp;
              <SourceDot statut={ebStatut} label="Eventbrite" />
              <span className="source-label">Eventbrite</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
