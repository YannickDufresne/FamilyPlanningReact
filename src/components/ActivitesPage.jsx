import { useState } from 'react';
import activites from '../data/activites.json';
import familleDefaut from '../data/famille.json';

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

// Couleur du score par tranche
function couleurScore(s) {
  if (s == null) return 'var(--ink-3)';
  if (s >= 80) return 'var(--forest)';
  if (s >= 55) return 'var(--sage)';
  if (s >= 35) return 'var(--terra)';
  return 'var(--ink-3)';
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPrix(a) {
  const adulte = a.cout_adulte ?? a.cout ?? 0;
  if (a.gratuit || adulte === 0) return 'Gratuit';
  const enfant = a.cout_enfant;
  if (enfant != null && enfant !== adulte) return `${adulte} $ adulte · ${enfant} $ enfant`;
  return `${adulte} $ / pers.`;
}

// ── Barre de score ────────────────────────────────────────────────────────────
function ScoreBarre({ score, label }) {
  if (score == null) return null;
  const couleur = couleurScore(score);
  return (
    <div className="score-barre">
      <div className="score-barre__piste">
        <div
          className="score-barre__fill"
          style={{ width: `${score}%`, background: couleur }}
        />
      </div>
      <span className="score-barre__val" style={{ color: couleur }}>{score}%</span>
      {label && <span className="score-barre__label">{label}</span>}
    </div>
  );
}

// ── Scores par membre ─────────────────────────────────────────────────────────
function ScoresMembres({ scores }) {
  if (!scores) return null;
  const membres = familleDefaut.filter(m => scores[m.prenom] != null);
  if (membres.length === 0) return null;
  return (
    <div className="scores-membres">
      {membres.map(m => {
        const s = scores[m.prenom];
        const couleur = couleurScore(s);
        return (
          <span key={m.prenom} className="membre-chip" title={`${m.prenom} : ${s}%`}>
            <span className="membre-chip__emoji">{m.emoji}</span>
            <span className="membre-chip__score" style={{ color: couleur }}>{s}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Carte activité ─────────────────────────────────────────────────────────────
function CarteActivite({ activite, mode }) {
  const prix = formatPrix(activite);
  const icone = SOURCE_ICONE[activite.source] ?? '•';
  const sourceLabel = SOURCE_LABEL[activite.source] ?? activite.source ?? '';
  const isGratuit = activite.gratuit || (activite.cout_adulte ?? activite.cout ?? 0) === 0;
  const score = mode === 'adultes' ? activite.score_adultes : activite.score_famille;
  const explication = mode === 'adultes' ? activite.explication_adultes : activite.explication_famille;

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

      {explication && (
        <div className="acti-carte__explication">{explication}</div>
      )}

      {!explication && activite.description && (
        <div className="acti-carte__desc">{activite.description}</div>
      )}

      {/* Score principal */}
      <ScoreBarre
        score={score}
        label={mode === 'adultes' ? 'pertinence adultes' : 'pertinence famille'}
      />

      {/* Scores par membre */}
      <ScoresMembres scores={activite.scores_membres} />

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
  const [mode, setMode] = useState('famille'); // 'famille' | 'adultes'
  const [tri, setTri]   = useState('score');   // 'score' | 'date' | 'gratuit'

  const debutSemaine = semaine?.debut;
  const finSemaine   = semaine?.fin;
  const dansSemaine  = d => debutSemaine && finSemaine && d >= debutSemaine && d <= finSemaine;

  // Séparer datées / non-datées
  const datees    = activites.filter(a => a.date && a.date.trim() !== '');
  const nonDatees = activites.filter(a => !a.date || a.date.trim() === '');

  // Fonction de tri
  const trierActivites = (arr) => {
    const scoreKey = mode === 'adultes' ? 'score_adultes' : 'score_famille';
    return [...arr].sort((a, b) => {
      if (tri === 'score') {
        const sa = a[scoreKey] ?? -1;
        const sb = b[scoreKey] ?? -1;
        return sb - sa;
      }
      if (tri === 'date') return (a.date || 'z').localeCompare(b.date || 'z');
      if (tri === 'gratuit') {
        const ga = a.gratuit || (a.cout_adulte ?? a.cout ?? 0) === 0 ? 0 : 1;
        const gb = b.gratuit || (b.cout_adulte ?? b.cout ?? 0) === 0 ? 0 : 1;
        return ga - gb;
      }
      return 0;
    });
  };

  // Grouper par date (pour tri=date)
  const dateesSorted  = trierActivites(datees);
  const nonDateesSorted = trierActivites(nonDatees);

  // Grouper par date pour affichage timeline
  const parDate = {};
  for (const a of dateesSorted) {
    if (!parDate[a.date]) parDate[a.date] = [];
    parDate[a.date].push(a);
  }
  const datesTriees = tri === 'date'
    ? Object.keys(parDate).sort()
    : Object.keys(parDate).sort((a, b) => {
        // Par score moyen du groupe
        const scoreKey = mode === 'adultes' ? 'score_adultes' : 'score_famille';
        const avg = arr => arr.reduce((s, x) => s + (x[scoreKey] ?? 0), 0) / arr.length;
        return avg(parDate[b]) - avg(parDate[a]);
      });

  const nbScores = activites.filter(a =>
    (mode === 'adultes' ? a.score_adultes : a.score_famille) != null
  ).length;

  return (
    <div className="acti-page">
      {/* En-tête page */}
      <div className="acti-page__header">
        <button className="acti-retour" onClick={onRetour}>← Retour</button>
        <div style={{ flex: 1 }}>
          <h2 className="acti-page__titre">Toutes les activités</h2>
          <p className="acti-page__intro">
            {activites.length} activités sur 4 semaines
            {nbScores > 0 && ` · ${nbScores} analysées par IA`}
            {' '}· mise à jour chaque dimanche
          </p>
        </div>

        {/* Contrôles */}
        <div className="acti-controles">
          {/* Toggle famille / adultes */}
          <div className="activite-mode-toggle">
            <button
              className={`mode-btn${mode === 'famille' ? ' mode-btn--active' : ''}`}
              onClick={() => setMode('famille')}
            >👨‍👩‍👧 Famille</button>
            <button
              className={`mode-btn${mode === 'adultes' ? ' mode-btn--active' : ''}`}
              onClick={() => setMode('adultes')}
            >🍷 Adultes</button>
          </div>
          {/* Tri */}
          <select
            className="acti-tri-select"
            value={tri}
            onChange={e => setTri(e.target.value)}
          >
            <option value="score">Tri : pertinence</option>
            <option value="date">Tri : date</option>
            <option value="gratuit">Tri : gratuit d'abord</option>
          </select>
        </div>
      </div>

      {/* Activités datées */}
      {datesTriees.length > 0 && (
        <section className="acti-section">
          <h3 className="acti-section__titre">
            Événements avec date
            <span className="acti-section__sous-titre">{datees.length} événements · {datesTriees.length} dates</span>
          </h3>
          <div className="acti-timeline">
            {datesTriees.map(date => (
              <div key={date} className={`acti-groupe${dansSemaine(date) ? ' acti-groupe--semaine' : ''}`}>
                <div className="acti-groupe__date">
                  {dansSemaine(date) && <span className="acti-groupe__tag-semaine">Cette semaine</span>}
                  {formatDate(date)}
                </div>
                <div className="acti-groupe__cartes">
                  {parDate[date].map((a, i) => (
                    <CarteActivite key={`${date}-${i}`} activite={a} mode={mode} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Activités sans date */}
      {nonDateesSorted.length > 0 && (
        <section className="acti-section acti-section--fallback">
          <h3 className="acti-section__titre">
            Suggestions permanentes
            <span className="acti-section__sous-titre">Disponibles en tout temps · {nonDateesSorted.length} suggestions</span>
          </h3>
          <div className="acti-grille">
            {nonDateesSorted.map((a, i) => (
              <CarteActivite key={i} activite={a} mode={mode} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
