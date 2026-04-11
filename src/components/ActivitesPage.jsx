import { useState } from 'react';
import activites from '../data/activites.json';
import familleDefaut from '../data/famille.json';

// ── Génère une courte raison personnalisée pour un membre ─────────────────────
function genererRaisonMembre(membre, activite) {
  const score = activite.scores_membres?.[membre.prenom];
  if (score == null) return null;

  const texte = `${activite.nom} ${activite.description || ''} ${activite.lieu || ''}`.toLowerCase();
  const mots  = (membre.aime || '').toLowerCase()
    .split(/[,;]+/).map(s => s.trim()).filter(m => m.length >= 3);
  const matches = mots.filter(m => texte.includes(m));
  const top = matches.slice(0, 2).join(', ');

  if (score === 0)  return 'Pas adapté à ses goûts';
  if (score >= 80)  return top || 'Excellente activité';
  if (score >= 55)  return top || 'Activité intéressante';
  if (score >= 30)  return top || 'Peu en lien avec ses préférences';
  return 'Peu adapté à ses goûts';
}

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

// ── Scores détaillés par membre ───────────────────────────────────────────────
function ScoresMembres({ scores, activite, profils }) {
  if (!scores) return null;
  const source = profils?.length ? profils : familleDefaut;
  const membres = source.filter(m => scores[m.prenom] != null);
  if (membres.length === 0) return null;
  return (
    <div className="scores-membres-detail">
      {membres.map(m => {
        const s      = scores[m.prenom];
        const raison = genererRaisonMembre(m, activite);
        const couleur = couleurScore(s);
        return (
          <div key={m.prenom} className="membre-ligne">
            <span className="membre-ligne__emoji">{m.emoji}</span>
            <span className="membre-ligne__nom">{m.prenom}</span>
            <div className="membre-ligne__barre">
              <div className="membre-ligne__fill" style={{ width: `${s}%`, background: couleur }} />
            </div>
            <span className="membre-ligne__score" style={{ color: couleur }}>{s}%</span>
            {raison && (
              <span className="membre-ligne__raison">{raison}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Carte activité ─────────────────────────────────────────────────────────────
function CarteActivite({ activite, mode, profils, passee }) {
  const prix = formatPrix(activite);
  const icone = SOURCE_ICONE[activite.source] ?? '•';
  const sourceLabel = SOURCE_LABEL[activite.source] ?? activite.source ?? '';
  const isGratuit = activite.gratuit || (activite.cout_adulte ?? activite.cout ?? 0) === 0;
  const score = mode === 'adultes' ? activite.score_adultes : activite.score_famille;
  const explication = mode === 'adultes' ? activite.explication_adultes : activite.explication_famille;

  return (
    <div className={`acti-carte${activite.incontournable ? ' acti-carte--star' : ''}${passee ? ' acti-carte--passee' : ''}`}>
      {passee && <span className="acti-carte__passee-badge">Passé</span>}
      {activite.incontournable && !passee && (
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

      {(activite.description_generee || activite.description) && (
        <div className="acti-carte__desc">
          {activite.description_generee || activite.description}
        </div>
      )}

      {explication && (
        <div className="acti-carte__explication">{explication}</div>
      )}

      {/* Score principal */}
      <ScoreBarre
        score={score}
        label={mode === 'adultes' ? 'pertinence adultes' : 'pertinence famille'}
      />

      {/* Scores par membre */}
      <ScoresMembres scores={activite.scores_membres} activite={activite} profils={profils} />

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

const PALIERS = [
  { label: 'Tout',    val: 0,  title: 'Afficher toutes les activités' },
  { label: 'Sans 0%', val: 1,  title: 'Masquer les activités non pertinentes (score 0)' },
  { label: '20%+',    val: 20, title: 'Pertinence minimale 20 %' },
  { label: '50%+',    val: 50, title: 'Pertinence minimale 50 %' },
  { label: '80%+',    val: 80, title: 'Pertinence minimale 80 %' },
];

export default function ActivitesPage({ onRetour, semaine, profils }) {
  const [mode, setMode]         = useState('famille'); // 'famille' | 'adultes'
  const [tri, setTri]           = useState('score');   // 'score' | 'date' | 'gratuit'
  const [scoreMin, setScoreMin] = useState(0);         // palier de pertinence
  const [afficherPassees, setAfficherPassees] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const debutSemaine = semaine?.debut;
  const finSemaine   = semaine?.fin;
  const dansSemaine  = d => debutSemaine && finSemaine && d >= debutSemaine && d <= finSemaine;
  const estPassee    = d => d && d < today;

  // Filtrer par pertinence minimale
  const scoreKey = mode === 'adultes' ? 'score_adultes' : 'score_famille';
  const activitesFiltrees = scoreMin === 0
    ? activites
    : activites.filter(a => (a[scoreKey] ?? 0) >= scoreMin);

  // Nombre d'activités passées (pour le bouton toggle)
  const nbPassees = activitesFiltrees.filter(a => estPassee(a.date)).length;

  // Séparer datées / non-datées (cacher passées selon état)
  const dateesTout  = activitesFiltrees.filter(a => a.date && a.date.trim() !== '');
  const datees      = afficherPassees ? dateesTout : dateesTout.filter(a => !estPassee(a.date));
  const nonDatees   = activitesFiltrees.filter(a => !a.date || a.date.trim() === '');

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

  const nbTotal  = activites.length;
  const nbAffichees = activitesFiltrees.length;
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
            {scoreMin > 0
              ? <><strong>{nbAffichees}</strong> sur {nbTotal} activités</>
              : <><strong>{nbTotal}</strong> activités</>
            }
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

          {/* Filtre pertinence */}
          <div className="acti-filtre-pertinence">
            <span className="acti-filtre-pertinence__label">Pertinence</span>
            <div className="acti-paliers">
              {PALIERS.map(p => (
                <button
                  key={p.val}
                  className={`acti-palier-btn${scoreMin === p.val ? ' acti-palier-btn--active' : ''}`}
                  onClick={() => setScoreMin(p.val)}
                  title={p.title}
                >
                  {p.label}
                </button>
              ))}
            </div>
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

          {/* Activités passées */}
          {nbPassees > 0 && (
            <button
              className={`acti-passees-toggle${afficherPassees ? ' acti-passees-toggle--actif' : ''}`}
              onClick={() => setAfficherPassees(v => !v)}
              title={afficherPassees ? 'Masquer les activités passées' : 'Afficher les activités passées'}
            >
              {afficherPassees ? `🕐 Masquer les ${nbPassees} passées` : `🕐 ${nbPassees} passées`}
            </button>
          )}
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
                    <CarteActivite key={`${date}-${i}`} activite={a} mode={mode} profils={profils} passee={estPassee(a.date)} />
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
              <CarteActivite key={i} activite={a} mode={mode} profils={profils} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
