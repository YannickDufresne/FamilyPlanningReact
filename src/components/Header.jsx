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

export default function Header({ onViewRecettes }) {
  const semaine = formatSemaine(meta.semaine.debut, meta.semaine.fin);
  const sourceLabel = meta.source?.includes('ticketmaster') ? 'Ticketmaster · Claude IA' : 'Données statiques';
  const maj = new Date(meta.lastUpdated + 'T12:00:00')
    .toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className="main-header">
      <div className="family-photo-container">
        <img
          src={`${import.meta.env.BASE_URL}family_photo.jpg`}
          alt="Portrait de famille"
          className="family-photo"
        />
        <div className="photo-caption">Famille · 2025</div>
      </div>

      <div className="header-content">
        <h1>Planning Hebdomadaire</h1>
        <p className="header-subtitle">
          <button className="header-nav-link" onClick={onViewRecettes}>Repas</button>
          &nbsp;·&nbsp; Exercices &nbsp;·&nbsp; Activités &nbsp;·&nbsp; Musique
        </p>
      </div>

      <div className="header-meta">
        <div className="header-semaine">{semaine}</div>
        <div className="header-maj">Mis à jour le {maj} · {sourceLabel}</div>
      </div>
    </header>
  );
}
