import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Anthropic from '@anthropic-ai/sdk';
import { calculerPrixFamille } from '../utils/prixFamille';
import ModalSuggestionIA from './ModalSuggestionIA';

const ANECDOTE_PREFIX = 'fp_anecdote_';
function recetteSlug(nom) {
  return ANECDOTE_PREFIX + nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 60);
}

const JOURS_ENTRAINEMENT = ['Lundi', 'Mercredi', 'Vendredi'];
const RANG_MEDALS  = ['🥇', '🥈', '🥉'];
const RANG_LABELS  = ['1er choix', '2e choix', '3e choix'];

const TOUS_THEMES = ['pasta_rapido', 'bol_nwich', 'criiions_poisson', 'plat_en_sauce', 'confort_grille', 'pizza', 'slow_chic'];
const THEMES_LABELS = {
  pasta_rapido: 'Pasta Rapido', bol_nwich: 'Bol · Sandwich',
  criiions_poisson: 'Poisson', plat_en_sauce: 'Plat en sauce',
  confort_grille: 'Confort grillé', pizza: 'Pizza', slow_chic: 'Slow chic',
};

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

function IngredientsHighlighted({ texte, ingredientsForces = [] }) {
  if (!texte) return null;
  if (!ingredientsForces.length) return <>{texte}</>;

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const parts = texte.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <>
      {parts.map((ing, i) => {
        const ingN = norm(ing);
        const match = ingredientsForces.some(f => ingN.includes(norm(f)) || norm(f).includes(ingN.split(' ')[0]));
        return (
          <span key={i}>
            {i > 0 && ', '}
            {match
              ? <mark className="ing-force-highlight">{ing}</mark>
              : ing}
          </span>
        );
      })}
    </>
  );
}

export default function DayCard({ jour, index, modeActivite = 'famille', onToggleModeActivite, profils = [], estVerrouille = false, estAutoVerrouille = false, onToggleLock = null, recettes = [], filtres = {}, recetteForceNom = null, onChoisirRecette = null, ingredientsForces = [], onSauvegarderRecette = null, recettesSemaine = [] }) {
  const { recette, exercices, activite, activiteAdultes, topFamille = [], topAdultes = [], musique, emoji, dateCourte } = jour;
  const [indexFamille, setIndexFamille] = useState(0);
  const [indexAdultes, setIndexAdultes] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [voirTout, setVoirTout] = useState(false);
  const [showSuggestionIA, setShowSuggestionIA] = useState(false);
  const [ajouterMode, setAjouterMode] = useState(false);

  // ── Anecdote / fun fact — se réinitialise à chaque changement de recette ──────
  const [anecdote, setAnecdote] = useState(null);

  useEffect(() => {
    // 1. Réinitialiser immédiatement avec ce qu'on connaît de la nouvelle recette
    const cached =
      recette.anecdote ||
      (recette.notes?.length > 30 ? recette.notes : null) ||
      localStorage.getItem(recetteSlug(recette.nom)) ||
      null;
    setAnecdote(cached);

    // 2. Si rien en cache et ce n'est pas un avertissement, générer via API
    if (cached || recette.nom?.startsWith('⚠️') || !recette.nom) return;
    const apiKey = localStorage.getItem('anthropic_key');
    if (!apiKey) return;
    let cancelled = false;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 20000 });
    client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: `Pour la recette "${recette.nom}"${recette.origine ? ` (cuisine ${recette.origine})` : ''}, écris une anecdote historique ou un fun fact en 1-2 phrases françaises. Style pédagogique et chaleureux. Réponds UNIQUEMENT l'anecdote, sans introduction ni guillemets.` }],
    }).then(resp => {
      if (cancelled) return;
      const text = resp.content?.[0]?.text?.trim();
      if (text) { setAnecdote(text); localStorage.setItem(recetteSlug(recette.nom), text); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [recette.nom]); // eslint-disable-line

  // ── Régime nécessaire pour ce jour (basé sur le quota restant de la semaine) ──
  const regimeNecessaire = (() => {
    const nbVegan = filtres?.nbVegane || 0;
    const nbVege  = filtres?.nbVegetarien || 0;
    if (!nbVegan && !nbVege) return 'omnivore';
    const assignes = { végane: 0, végétarien: 0 };
    recettesSemaine.forEach(nom => {
      const r = recettes.find(rec => rec.nom === nom);
      if (r?.regime_alimentaire === 'végane') assignes.végane++;
      else if (r?.regime_alimentaire === 'végétarien') assignes.végétarien++;
    });
    if (assignes.végane < nbVegan) return 'végane';
    if (assignes.végétarien < nbVege) return 'végétarien';
    return 'omnivore';
  })();
  const [nouvelleRecette, setNouvelleRecette] = useState(null);

  function ouvrirFormAjouter() {
    // Pré-remplir le régime selon le quota restant
    const regimePrefill = regimeNecessaire !== 'omnivore' ? regimeNecessaire : 'omnivore';
    // Pré-remplir le coût/temps si un max est activé
    const coutPrefill = filtres?.activerCout ? Math.min(filtres.coutMax, 3) : 3;
    const tempsPrefill = filtres?.activerTemps ? Math.min(filtres.tempsMax, 30) : 30;
    // Pré-remplir l'origine : pays précis seulement (pas les zones génériques)
    const originePrefill = (() => {
      const o = filtres?.origine;
      if (!o || o === 'Tous' || o.startsWith('zone:')) return '';
      return o;
    })();
    setNouvelleRecette({
      nom: '', url: '',
      regime_alimentaire: regimePrefill,
      cout: coutPrefill,
      temps_preparation: tempsPrefill,
      ingredients: '',
      origine: originePrefill,
      source: 'manuel',
      ...Object.fromEntries(TOUS_THEMES.map(t => [`theme_${t}`, t === jour.theme ? 1 : 0])),
    });
    setAjouterMode(true);
  }

  function fermerModal() {
    setSearchOpen(false);
    setSearchQuery('');
    setVoirTout(false);
    setAjouterMode(false);
    setNouvelleRecette(null);
  }

  function soumettreNouvelleRecette(e) {
    e.preventDefault();
    if (!nouvelleRecette.nom.trim()) return;
    const recetteFinale = { ...nouvelleRecette, nom: nouvelleRecette.nom.trim() };
    if (onSauvegarderRecette) onSauvegarderRecette(recetteFinale);
    if (onChoisirRecette) onChoisirRecette(recetteFinale.nom);
    fermerModal();
  }

  const pool = modeActivite === 'adultes' ? topAdultes : topFamille;
  const idx  = modeActivite === 'adultes' ? indexAdultes : indexFamille;
  const setIdx = modeActivite === 'adultes' ? setIndexAdultes : setIndexFamille;

  const activiteAffichee = pool.length > 0 ? pool[Math.min(idx, pool.length - 1)] : (modeActivite === 'adultes' ? activiteAdultes : activite);

  const isWarning = recette.nom.startsWith('⚠️');
  const isTraining = JOURS_ENTRAINEMENT.includes(jour.jour);
  const isRepos = exercices.length === 1 && exercices[0].fonction === 'repos';
  const regimeLabel = REGIME_LABEL[recette.regime_alimentaire];

  return (
    <article className={`day-card ${isWarning ? 'day-card--warning' : ''} ${isTraining ? 'day-card--training' : ''} ${estVerrouille ? 'day-card--locked' : ''} ${estAutoVerrouille ? 'day-card--passe' : ''}`}>
      {onToggleLock ? (
        <button
          className={`day-card__lock ${estVerrouille ? 'day-card__lock--locked' : ''}`}
          onClick={onToggleLock}
          title={estVerrouille ? 'Modifier ce repas' : 'Confirmer ce repas'}
        >
          {estVerrouille ? '✅' : '○'}
        </button>
      ) : estAutoVerrouille ? (
        <span className="day-card__lock day-card__lock--locked day-card__lock--auto" title="Jour passé">
          ✔
        </span>
      ) : null}
      {onChoisirRecette && !isWarning && !estVerrouille && (
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
          <div className="planning-item__meta">
            <IngredientsHighlighted texte={recette.ingredients} ingredientsForces={ingredientsForces} />
          </div>
        )}
        {!isWarning && anecdote && (
          <div className="planning-item__anecdote">
            📖 {anecdote}
          </div>
        )}
        {isWarning && (
          <div className="recette-manquante">
            <p className="recette-manquante__msg">
              {(() => {
                const parts = [];
                const o = filtres?.origine;
                if (o && o !== 'Tous') parts.push(o.startsWith('zone:') ? o.slice(5) : o);
                if (regimeNecessaire !== 'omnivore') parts.push(regimeNecessaire);
                if (filtres?.activerCout) parts.push(`coût ≤ ${filtres.coutMax}/6`);
                if (filtres?.activerTemps) parts.push(`≤ ${filtres.tempsMax} min`);
                return parts.length > 0
                  ? `Aucune recette ${parts.join(' · ')} pour ce thème — crée-en une !`
                  : 'Aucune recette disponible pour ce thème avec les filtres actuels.';
              })()}
            </p>
            <div className="recette-manquante__actions">
              {onSauvegarderRecette && (
                <button
                  className="recette-manquante__btn recette-manquante__btn--ia"
                  onClick={() => setShowSuggestionIA(true)}
                >✨ Suggérer avec l'IA</button>
              )}
              {onChoisirRecette && (
                <button
                  className="recette-manquante__btn recette-manquante__btn--primary"
                  onClick={() => setSearchOpen(true)}
                >✏️ Choisir manuellement</button>
              )}
            </div>
          </div>
        )}
        {showSuggestionIA && (
          <ModalSuggestionIA
            theme={jour.theme}
            filtres={filtres}
            ingredientsForces={ingredientsForces}
            recettesSemaine={recettesSemaine}
            regimeNecessaire={regimeNecessaire}
            origine={filtres?.origine || 'Tous'}
            onSauvegarder={(r) => { onSauvegarderRecette(r); }}
            onChoisirCeSoir={(nom) => { if (onChoisirRecette) onChoisirRecette(nom); setShowSuggestionIA(false); }}
            onClose={() => setShowSuggestionIA(false)}
          />
        )}
        {!isWarning && <EvalRow recette={recette} />}
      </div>

      {/* ── Accordéons indépendants : Entraînement · Activité · Musique ──────── */}
      <div className="day-card__extras">

        {/* Entraînement */}
        <details className="day-card__extra-details">
          <summary className="day-card__extra-summary">
            <span className="day-card__extra-icon">🏋️</span>
            <span className="day-card__extra-label">
              {isRepos ? 'Repos' : (exercices[0]?.nom || '—')}
            </span>
          </summary>
          <div className="planning-item planning-item--extra">
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
        </details>

        {/* Activité */}
        <details className="day-card__extra-details">
          <summary className="day-card__extra-summary">
            <span className="day-card__extra-icon">🗺</span>
            <span className="day-card__extra-label">
              {activiteAffichee?.nom || 'Aucune activité'}
            </span>
          </summary>
          <div className="planning-item planning-item--extra">
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
                        <span className="activite-pertinence__score" style={{ color: couleur }}>{score}%</span>
                      )}
                      {explication && (
                        <span className="activite-pertinence__explication">{explication}</span>
                      )}
                    </div>
                  );
                })()}
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
        </details>

        {/* Musique */}
        <details className="day-card__extra-details">
          <summary className="day-card__extra-summary">
            <span className="day-card__extra-icon">🎵</span>
            <span className="day-card__extra-label">
              {musique?.nom
                ? (musique.nom.indexOf(' - ') > 0 ? musique.nom.substring(0, musique.nom.indexOf(' - ')) : musique.nom)
                : '—'}
            </span>
          </summary>
          <div className="planning-item planning-item--extra">
            <MusiqueCard musique={musique} />
          </div>
        </details>

      </div>

      {/* Recherche / ajout de recette — rendu dans body via portal pour éviter les problèmes de z-index */}
      {searchOpen && createPortal((() => {
        const themeCol = `theme_${jour.theme}`;
        const filtreOrigine = filtres.origine && filtres.origine !== 'Tous';
        const poolTheme = recettes.filter(r =>
          r[themeCol] === 1 && (!filtreOrigine || r.origine === filtres.origine)
        );
        const afficherTout = voirTout || searchQuery.trim().length > 0;
        const poolBase = afficherTout ? recettes : poolTheme;
        const resultats = poolBase
          .filter(r => r.nom.toLowerCase().includes(searchQuery.toLowerCase()))
          .slice(0, 40);
        const labelFiltre = [`thème ${THEMES_LABELS[jour.theme] || jour.theme}`, filtreOrigine ? filtres.origine : null].filter(Boolean).join(' · ');

        return (
          <div className="recette-search-overlay" onClick={fermerModal}>
            <div className="recette-search-modal" onClick={e => e.stopPropagation()}>
              <div className="recette-search-header">
                <span>{ajouterMode ? `Nouvelle recette · ${THEMES_LABELS[jour.theme] || jour.theme}` : `Choisir une recette · ${jour.jour}`}</span>
                <button onClick={fermerModal}>✕</button>
              </div>

              {ajouterMode && nouvelleRecette ? (
                /* ── Mini-formulaire d'ajout ── */
                <form className="recette-ajouter-form" onSubmit={soumettreNouvelleRecette}>
                  <p className="recette-ajouter-form__hint">
                    Cette recette sera enregistrée de façon permanente dans la bibliothèque et assignée à {jour.jour}.
                  </p>
                  <label className="recette-ajouter-form__label">
                    Nom de la recette *
                    <input
                      autoFocus
                      className="recette-ajouter-form__input"
                      placeholder="Ex: Ramen maison au miso..."
                      value={nouvelleRecette.nom}
                      onChange={e => setNouvelleRecette(r => ({ ...r, nom: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="recette-ajouter-form__label">
                    URL de la recette (optionnel)
                    <input
                      className="recette-ajouter-form__input"
                      placeholder="https://..."
                      value={nouvelleRecette.url}
                      onChange={e => setNouvelleRecette(r => ({ ...r, url: e.target.value }))}
                    />
                  </label>
                  <div className="recette-ajouter-form__label">
                    Régime alimentaire
                    <div className="recette-ajouter-form__regime-pills">
                      {[['omnivore','Omnivore'],['végétarien','Végétarien'],['végane','Végane']].map(([val, lab]) => (
                        <label key={val} className={`recette-ajouter-form__pill${nouvelleRecette.regime_alimentaire === val ? ' recette-ajouter-form__pill--on' : ''}`}>
                          <input type="radio" name="regime" value={val} checked={nouvelleRecette.regime_alimentaire === val}
                            onChange={() => setNouvelleRecette(r => ({ ...r, regime_alimentaire: val }))} />
                          {lab}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="recette-ajouter-form__row">
                    <label className="recette-ajouter-form__label recette-ajouter-form__label--half">
                      Coût ($)
                      <input type="number" min={1} max={15} step={0.5} className="recette-ajouter-form__input"
                        value={nouvelleRecette.cout}
                        onChange={e => setNouvelleRecette(r => ({ ...r, cout: +e.target.value }))} />
                    </label>
                    <label className="recette-ajouter-form__label recette-ajouter-form__label--half">
                      Temps (min)
                      <input type="number" min={5} max={240} step={5} className="recette-ajouter-form__input"
                        value={nouvelleRecette.temps_preparation}
                        onChange={e => setNouvelleRecette(r => ({ ...r, temps_preparation: +e.target.value }))} />
                    </label>
                  </div>
                  <label className="recette-ajouter-form__label">
                    Ingrédients principaux (séparés par des virgules)
                    <input className="recette-ajouter-form__input"
                      placeholder="Ex: poulet, miso, nouilles soba..."
                      value={nouvelleRecette.ingredients}
                      onChange={e => setNouvelleRecette(r => ({ ...r, ingredients: e.target.value }))} />
                  </label>
                  {filtreOrigine && (
                    <label className="recette-ajouter-form__label">
                      Origine culturelle
                      <input className="recette-ajouter-form__input"
                        value={nouvelleRecette.origine}
                        onChange={e => setNouvelleRecette(r => ({ ...r, origine: e.target.value }))} />
                    </label>
                  )}
                  <div className="recette-ajouter-form__actions">
                    <button type="button" className="recette-ajouter-form__btn-annuler" onClick={() => setAjouterMode(false)}>
                      ← Retour
                    </button>
                    <button type="submit" className="recette-ajouter-form__btn-submit"
                      disabled={!nouvelleRecette.nom.trim()}>
                      ✓ Ajouter et utiliser
                    </button>
                  </div>
                </form>
              ) : (
                /* ── Recherche normale ── */
                <>
                  <input autoFocus className="recette-search-input" placeholder="Rechercher..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  {!afficherTout && (
                    <div className="recette-search-filtre-info">
                      <span>🎯 {labelFiltre} ({poolTheme.length} recettes)</span>
                      <button className="recette-search-voir-tout" onClick={() => setVoirTout(true)}>
                        Tout le catalogue →
                      </button>
                    </div>
                  )}
                  {afficherTout && !searchQuery && (
                    <div className="recette-search-filtre-info">
                      <span>📚 Tout le catalogue ({recettes.length} recettes)</span>
                      <button className="recette-search-voir-tout" onClick={() => setVoirTout(false)}>
                        ← Revenir au thème
                      </button>
                    </div>
                  )}
                  <ul className="recette-search-list">
                    {resultats.map(r => (
                      <li key={r.nom}
                        className={`recette-search-item ${r.nom === recette.nom ? 'recette-search-item--current' : ''}`}
                        onClick={() => { onChoisirRecette(r.nom); fermerModal(); }}>
                        <span className="recette-search-nom">{r.nom}</span>
                        <span className="recette-search-meta">{r.regime_alimentaire} · {r.cout}$ · {r.temps_preparation}min</span>
                      </li>
                    ))}
                    {resultats.length === 0 && <li className="recette-search-vide">Aucun résultat</li>}
                  </ul>
                  {onSauvegarderRecette && (
                    <button className="recette-search-ajouter-btn" onClick={ouvrirFormAjouter}>
                      ➕ Créer une nouvelle recette pour ce thème
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })(), document.body)}
    </article>
  );
}
