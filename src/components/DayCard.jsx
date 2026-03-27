import { useState, useEffect, useRef } from 'react';
import { calculerPrixFamille } from '../utils/prixFamille';

const JOURS_ENTRAINEMENT = ['Lundi', 'Mercredi', 'Vendredi'];
const RANG_MEDALS  = ['🥇', '🥈', '🥉'];
const RANG_LABELS  = ['1er choix', '2e choix', '3e choix'];

// ── Génère une phrase expliquant pourquoi cette activité a été suggérée ───────
function genererExplication(activite, profils, pourQui = 'famille') {
  if (!activite || !profils || profils.length === 0) return null;
  const texte = `${activite.nom || ''} ${activite.description || ''} ${activite.lieu || ''}`.toLowerCase();

  const membres = pourQui === 'adultes'
    ? profils.filter(p => {
        const n = new Date(p.naissance + 'T12:00:00');
        let age = new Date().getFullYear() - n.getFullYear();
        const dm = new Date().getMonth() - n.getMonth();
        if (dm < 0 || (dm === 0 && new Date().getDate() < n.getDate())) age--;
        return age >= 18;
      })
    : profils;

  const matches = [];
  for (const m of membres) {
    const mots = (m.aime || '').toLowerCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    const found = mots.filter(mot => mot.length >= 3 && texte.includes(mot));
    if (found.length > 0) matches.push({ prenom: m.prenom, emoji: m.emoji, mots: found.slice(0, 2) });
  }

  if (matches.length === 0) return null;

  const noms = matches.length <= 2
    ? matches.map(m => `${m.emoji} ${m.prenom}`).join(' et ')
    : `${matches.slice(0, -1).map(m => `${m.emoji} ${m.prenom}`).join(', ')} et ${matches[matches.length - 1].emoji} ${matches[matches.length - 1].prenom}`;
  const motsCles = [...new Set(matches.flatMap(m => m.mots))].slice(0, 3).join(', ');
  return `Pour ${noms} · ${motsCles}`;
}
const REGIME_LABEL = { omnivore: 'omnivore', végétarien: 'végétarien', végane: 'végane' };

// ── Cherche UN album/compilation iTunes selon l'artiste de référence ──────────
function useAlbum(musique) {
  const [album, setAlbum] = useState(null);

  useEffect(() => {
    if (!musique?.nom) return;
    let cancelled = false;

    const sep     = musique.nom.indexOf(' - ');
    const artiste = sep > 0 ? musique.nom.slice(0, sep) : musique.nom;

    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artiste)}&media=music&entity=album&limit=5&country=CA`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        // Prend le premier album avec une pochette
        const found = (d.results || []).find(a => a.artworkUrl100);
        if (found) setAlbum(found);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [musique?.nom]);

  return album;
}

function MusiqueCard({ musique }) {
  const album = useAlbum(musique);
  return (
    <div className="musique-card">
      {album ? (
        <a
          href={album.collectionViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="musique-album-link"
          title="Ouvrir dans Apple Music"
        >
          <img
            src={album.artworkUrl100.replace('100x100bb', '200x200bb')}
            alt={album.collectionName}
            className="musique-album-art"
            loading="lazy"
          />
          <div className="musique-info">
            <div className="musique-album-titre">{album.collectionName}</div>
            <div className="musique-album-artiste">{album.artistName}</div>
            <div className="musique-genre">{musique.genre} · {musique.ambiance}</div>
          </div>
        </a>
      ) : (
        <div className="musique-info">
          <div className="musique-album-titre">{musique.nom}</div>
          <div className="musique-genre">{musique.genre} · {musique.ambiance}</div>
        </div>
      )}
    </div>
  );
}

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

  // Masquer seulement si on sait que c'est payant mais qu'on n'a pas les tarifs
  // Si le prix calculé est 0 (null → 0 par défaut) → afficher "gratuit"
  const prixEffectif = activite.cout_adulte ?? activite.cout ?? 0;
  const effectivementGratuit = prixEffectif === 0;
  if (!hasTieredPricing && !effectivementGratuit && !activite.gratuit) return null;

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
              {m.prix > 0 ? `${m.prix} $` : 'grat.'}
            </span>
          </div>
        ))}
      </div>
      <div className="prix-famille__total">
        Total <strong>{total > 0 ? `${total} $` : 'gratuit'}</strong>
      </div>
    </div>
  );
}

export default function DayCard({ jour, index, modeActivite = 'famille', onToggleModeActivite, profils = [], estVerrouille = false, onToggleLock = null, recettes = [], recetteForceNom = null, onChoisirRecette = null }) {
  const { recette, exercices, activite, activiteAdultes, topFamille = [], topAdultes = [], musique, emoji, dateCourte } = jour;
  const [indexFamille, setIndexFamille] = useState(0);
  const [indexAdultes, setIndexAdultes] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pool = modeActivite === 'adultes' ? topAdultes : topFamille;
  const idx  = modeActivite === 'adultes' ? indexAdultes : indexFamille;
  const setIdx = modeActivite === 'adultes' ? setIndexAdultes : setIndexFamille;

  const activiteAffichee = pool.length > 0 ? pool[Math.min(idx, pool.length - 1)] : (modeActivite === 'adultes' ? activiteAdultes : activite);

  const isWarning = recette.nom.startsWith('⚠️');
  const isTraining = JOURS_ENTRAINEMENT.includes(jour.jour);
  const isRepos = exercices.length === 1 && exercices[0].fonction === 'repos';
  const regimeLabel = REGIME_LABEL[recette.regime_alimentaire];

  return (
    <article className={`day-card ${isWarning ? 'day-card--warning' : ''} ${isTraining ? 'day-card--training' : ''} ${estVerrouille ? 'day-card--locked' : ''}`}>
      {onToggleLock && (
        <button
          className={`day-card__lock ${estVerrouille ? 'day-card__lock--locked' : ''}`}
          onClick={onToggleLock}
          title={estVerrouille ? 'Déverrouiller ce jour' : 'Verrouiller ce jour'}
        >
          {estVerrouille ? '🔒' : '🔓'}
        </button>
      )}
      {onChoisirRecette && !isWarning && (
        <button
          className="recette-changer-btn"
          onClick={() => setSearchOpen(true)}
          title="Choisir une autre recette"
        >✏️</button>
      )}
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
        {!isWarning && (() => {
          const styleImages = localStorage.getItem('style_images') || 'aquarelle';
          const isAquarelle = styleImages === 'aquarelle' && recette.image_aquarelle;
          const src = isAquarelle
            ? import.meta.env.BASE_URL + recette.image_aquarelle
            : recette.image_url;
          return src ? (
            <div className={`planning-repas__img-wrapper planning-repas__img-wrapper--${isAquarelle ? 'aquarelle' : 'photo'}`}>
              <img
                className={`planning-repas__img planning-repas__img--${isAquarelle ? 'aquarelle' : 'photo'}`}
                src={src}
                alt={recette.nom}
                loading="lazy"
              />
            </div>
          ) : null;
        })()}
        <div className="planning-item__label">Repas</div>
        <div className="planning-item__name">
          {recette.url && !isWarning ? (
            <a className="planning-item__link" href={recette.url} target="_blank" rel="noopener noreferrer">
              {recette.nom}
            </a>
          ) : recette.nom}
          {regimeLabel && !isWarning && <span className="regime-badge">{regimeLabel}</span>}
          {recette.source === 'nyt_cooking' && !isWarning && (
            <span className="nyt-badge" title="Coup de cœur NYT Cooking">♥ NYT</span>
          )}
          {recetteForceNom && !isWarning && (
            <span className="recette-force-badge">
              🎯 Choix manuel
              {onChoisirRecette && (
                <button onClick={() => onChoisirRecette(null)} title="Annuler le choix manuel">✕</button>
              )}
            </span>
          )}
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
        <div className="planning-item__label activite-label-row">
          <span>
            Activité · Québec
            {activiteAffichee?.incontournable && (
              <span className="incontournable-badge">⭐ À ne pas manquer</span>
            )}
          </span>
          <div className="activite-mode-toggle">
            <button
              className={`mode-btn${modeActivite === 'famille' ? ' mode-btn--active' : ''}`}
              onClick={() => { onToggleModeActivite('famille'); setIndexFamille(0); }}
              title="Activité pour toute la famille"
            >👨‍👩‍👧 Famille</button>
            <button
              className={`mode-btn${modeActivite === 'adultes' ? ' mode-btn--active' : ''}`}
              onClick={() => { onToggleModeActivite('adultes'); setIndexAdultes(0); }}
              title="Activité adultes seulement"
            >🍷 Adultes</button>
          </div>
        </div>
        {activiteAffichee ? (
          <>
            {activiteAffichee.url ? (
              <a className="planning-item__name planning-item__link"
                href={activiteAffichee.url} target="_blank" rel="noopener noreferrer">
                {activiteAffichee.nom}
              </a>
            ) : (
              <div className="planning-item__name">{activiteAffichee.nom}</div>
            )}
            {activiteAffichee.lieu && (
              <div className="planning-item__meta">
                {activiteAffichee.lieu}
                {(() => {
                  const adulte = activiteAffichee.cout_adulte ?? activiteAffichee.cout ?? 0;
                  const enfant = activiteAffichee.cout_enfant;
                  if (adulte > 0) return <> · <span className="prix-adulte">{adulte} $ / adulte</span></>;
                  if (enfant > 0) return <> · <span className="prix-adulte">gratuit adultes</span></>;
                  return ' · gratuit';
                })()}
              </div>
            )}
            {(activiteAffichee.description_generee || activiteAffichee.description) && (
              <div className="planning-item__meta" style={{ marginTop: 3 }}>
                {activiteAffichee.description_generee || activiteAffichee.description}
              </div>
            )}
            <PrixFamille activite={activiteAffichee} date={jour.date} />
            {activiteAffichee.source === 'claude' && (
              <div className="planning-item__badge">✦ Suggestion IA</div>
            )}
            {/* Score de pertinence + explication */}
            {(() => {
              const score = modeActivite === 'adultes'
                ? activiteAffichee.score_adultes
                : activiteAffichee.score_famille;
              const preCalc = modeActivite === 'adultes'
                ? activiteAffichee.explication_adultes
                : activiteAffichee.explication_famille;
              const explication = preCalc || genererExplication(activiteAffichee, profils, modeActivite);
              if (!score && !explication) return null;
              const couleur = score >= 70 ? 'var(--forest)' : score >= 40 ? 'var(--sage)' : score >= 20 ? 'var(--terra)' : 'var(--ink-3)';
              return (
                <div className="activite-pertinence">
                  {score != null && (
                    <span className="activite-pertinence__score" style={{ color: couleur }}>
                      {score}%
                    </span>
                  )}
                  {explication && (
                    <span className="activite-pertinence__explication">{explication}</span>
                  )}
                </div>
              );
            })()}
            {/* Navigation top-3 avec médailles */}
            {pool.length > 1 && (
              <div className="activite-rang-nav">
                {pool.map((a, i) => {
                  const isCurrent = i === Math.min(idx, pool.length - 1);
                  return (
                    <button
                      key={i}
                      className={`rang-btn${isCurrent ? ' rang-btn--active' : ''}`}
                      onClick={() => setIdx(i)}
                      title={a?.nom}
                    >
                      <span className="rang-medal">{RANG_MEDALS[i]}</span>
                      <span className="rang-label">{RANG_LABELS[i]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="planning-item__empty">Aucun événement planifié</div>
        )}
      </div>

      {/* Musique */}
      <div className="planning-item">
        <div className="planning-item__label">Musique</div>
        <MusiqueCard musique={musique} />
      </div>

      {/* Recherche de recette */}
      {searchOpen && (
        <div className="recette-search-overlay" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
          <div className="recette-search-modal" onClick={e => e.stopPropagation()}>
            <div className="recette-search-header">
              <span>Choisir une recette · {jour.jour}</span>
              <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
            </div>
            <input
              autoFocus
              className="recette-search-input"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <ul className="recette-search-list">
              {recettes
                .filter(r => r.nom.toLowerCase().includes(searchQuery.toLowerCase()))
                .slice(0, 30)
                .map(r => (
                  <li
                    key={r.nom}
                    className={`recette-search-item ${r.nom === recette.nom ? 'recette-search-item--current' : ''}`}
                    onClick={() => { onChoisirRecette(r.nom); setSearchOpen(false); setSearchQuery(''); }}
                  >
                    <span className="recette-search-nom">{r.nom}</span>
                    <span className="recette-search-meta">{r.regime_alimentaire} · {r.cout}$ · {r.temps_preparation}min</span>
                  </li>
                ))
              }
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
