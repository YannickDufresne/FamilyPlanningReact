import activites from '../data/activites.json';

// ── Source config ─────────────────────────────────────────────────────────────
const SOURCE_ICONE = {
  ticketmaster:    '🎫',
  eventbrite:      '🎪',
  claude:          '✦',
  claude_gratuites:'✦',
  incontournable:  '⭐',
  web_search:      '🌐',
};
const SOURCE_LABEL = {
  ticketmaster:    'Ticketmaster',
  eventbrite:      'Eventbrite',
  claude:          'Suggestion IA',
  claude_gratuites:'Suggestion IA',
  incontournable:  'Incontournable',
  web_search:      'Web',
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateCourte(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' });
}

function formatPrix(a) {
  const adulte = a.cout_adulte ?? a.cout ?? 0;
  if (a.gratuit || adulte === 0) return 'Gratuit';
  const enfant = a.cout_enfant;
  if (enfant != null && enfant !== adulte) return `${adulte} $ / adulte · ${enfant} $ / enfant`;
  return `${adulte} $ / pers.`;
}

function CarteActivite({ activite }) {
  const prix = formatPrix(activite);
  const icone = SOURCE_ICONE[activite.source] ?? '•';
  const sourceLabel = SOURCE_LABEL[activite.source] ?? activite.source ?? '';
  const isGratuit = activite.gratuit || (activite.cout_adulte ?? activite.cout ?? 0) === 0;

  return (
    <div className={`acti-carte${activite.incontournable ? ' acti-carte--star' : ''}`}>
      {activite.incontournable && (
        <span className="incontournable-badge">⭐ À ne pas manquer</span>
      )}
      <div className="acti-carte__top">
        {activite.url ? (
          <a className="acti-carte__nom" href={activite.url} target="_blank" rel="noopener noreferrer">
            {activite.nom}
          </a>
        ) : (
          <div className="acti-carte__nom">{activite.nom}</div>
        )}
        <div className="acti-carte__prix-badge" data-gratuit={isGratuit}>
          {prix}
        </div>
      </div>

      {activite.lieu && (
        <div className="acti-carte__lieu">📍 {activite.lieu}</div>
      )}

      {activite.description && (
        <div className="acti-carte__desc">{activite.description}</div>
      )}

      <div className="acti-carte__footer">
        {activite.pourQui === 'adultes' && (
          <span className="acti-badge acti-badge--adultes">🍷 Adultes</span>
        )}
        {(!activite.pourQui || activite.pourQui === 'famille') && (
          <span className="acti-badge acti-badge--famille">👨‍👩‍👧 Famille</span>
        )}
        {sourceLabel && (
          <span className="acti-badge acti-badge--source">{icone} {sourceLabel}</span>
        )}
      </div>
    </div>
  );
}

export default function ActivitesPage({ onRetour, semaine }) {
  // Séparer les activités datées des non-datées
  const datees    = activites.filter(a => a.date && a.date.trim() !== '');
  const nonDatees = activites.filter(a => !a.date || a.date.trim() === '');

  // Trier par date
  datees.sort((a, b) => a.date.localeCompare(b.date));

  // Grouper par date
  const parDate = {};
  for (const a of datees) {
    if (!parDate[a.date]) parDate[a.date] = [];
    parDate[a.date].push(a);
  }

  const datesTriees = Object.keys(parDate).sort();

  // Déterminer si une date est dans la semaine courante
  const debutSemaine = semaine?.debut;
  const finSemaine   = semaine?.fin;
  const dansSemaine  = d => debutSemaine && finSemaine && d >= debutSemaine && d <= finSemaine;

  return (
    <div className="acti-page">
      {/* En-tête page */}
      <div className="acti-page__header">
        <button className="acti-retour" onClick={onRetour}>
          ← Retour au planning
        </button>
        <div>
          <h2 className="acti-page__titre">Toutes les activités</h2>
          <p className="acti-page__intro">
            {activites.length} activités · mise à jour chaque dimanche avec Ticketmaster, Eventbrite, recherches web et suggestions IA
          </p>
        </div>
      </div>

      {/* Activités datées, en ordre chronologique */}
      {datesTriees.length > 0 && (
        <section className="acti-section">
          <h3 className="acti-section__titre">Événements avec date</h3>
          <div className="acti-timeline">
            {datesTriees.map(date => (
              <div key={date} className={`acti-groupe${dansSemaine(date) ? ' acti-groupe--semaine' : ''}`}>
                <div className="acti-groupe__date">
                  {dansSemaine(date) && <span className="acti-groupe__tag-semaine">Cette semaine</span>}
                  {formatDate(date)}
                </div>
                <div className="acti-groupe__cartes">
                  {parDate[date].map((a, i) => (
                    <CarteActivite key={`${date}-${i}`} activite={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activités sans date — suggestions récurrentes */}
      {nonDatees.length > 0 && (
        <section className="acti-section acti-section--fallback">
          <h3 className="acti-section__titre">
            Suggestions permanentes
            <span className="acti-section__sous-titre">Activités sans date précise, disponibles en tout temps</span>
          </h3>
          <div className="acti-grille">
            {nonDatees.map((a, i) => (
              <CarteActivite key={i} activite={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
