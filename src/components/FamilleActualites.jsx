import { useState, useMemo, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import activites from '../data/activites.json';
import films from '../data/films.json';
import { getFilmsCandidats, getFilmIndexInitial } from '../utils/filmSemaine';

// ── Palmarès labels ────────────────────────────────────────────────────────────
const PALMARES_LABELS_FA = {
  cannes_palme_dor:    'Palme d\'Or',
  cannes_grand_prix:   'Grand Prix Cannes',
  cannes_jury:         'Prix du Jury',
  oscar_meilleur_film: 'Oscar Meilleur Film',
  oscar_etranger:      'Oscar Film Étranger',
  sight_sound:         'Sight & Sound',
  berlinale:           'Ours d\'Or Berlin',
  venice:              'Lion d\'Or Venise',
  imdb_top250:         'IMDB Top 250',
  afi_top100:          'AFI Top 100',
};

function meilleurPalmaresFilm(film) {
  if (!film.palmares?.length) return null;
  const priority = ['cannes_palme_dor', 'oscar_meilleur_film', 'sight_sound', 'oscar_etranger',
    'berlinale', 'venice', 'cannes_grand_prix', 'cannes_jury', 'imdb_top250', 'afi_top100'];
  for (const p of priority) {
    if (film.palmares.includes(p)) {
      const rang = film.palmares_rangs?.[p];
      return PALMARES_LABELS_FA[p] + (rang ? ` #${rang}` : '');
    }
  }
  const p = film.palmares[0];
  const rang = film.palmares_rangs?.[p];
  return (PALMARES_LABELS_FA[p] || p) + (rang ? ` #${rang}` : '');
}

const DRAPEAUX_FA = {
  'États-Unis': '🇺🇸', 'Royaume-Uni': '🇬🇧', 'France': '🇫🇷',
  'Canada': '🇨🇦', 'Canada (Québec)': '🇨🇦', 'Japon': '🇯🇵',
  'Brésil': '🇧🇷', 'Allemagne': '🇩🇪', 'Italie': '🇮🇹',
  'Espagne': '🇪🇸', 'Mexique': '🇲🇽', 'Argentine': '🇦🇷',
  'Corée du Sud': '🇰🇷', 'Chine': '🇨🇳', 'Taïwan': '🇹🇼',
  'Hong Kong': '🇭🇰', 'Inde': '🇮🇳', 'Iran': '🇮🇷',
  'Sénégal': '🇸🇳', 'Mali': '🇲🇱', 'Mauritanie': '🇲🇷',
  'Algérie': '🇩🇿', 'Égypte': '🇪🇬', 'Palestine': '🇵🇸',
  'Liban': '🇱🇧', 'Suède': '🇸🇪', 'Danemark': '🇩🇰',
  'Norvège': '🇳🇴', 'Roumanie': '🇷🇴', 'Pologne': '🇵🇱',
  'Hongrie': '🇭🇺', 'Belgique': '🇧🇪', 'Russie (URSS)': '🇷🇺',
  'Colombie': '🇨🇴',
};

function drapeauFilm(pays) { return DRAPEAUX_FA[pays] || '🌍'; }

// ── Poster Wikipedia (mini card) ───────────────────────────────────────────────
function useFilmPosterFA(film) {
  const [url, setUrl] = useState(film?.poster_url || null);

  useEffect(() => {
    if (!film) return;
    if (film.poster_url) { setUrl(film.poster_url); return; }
    let cancelled = false;

    async function fetchPoster() {
      const tries = [
        ['fr', film.nom],
        ...(film.titre_original && film.titre_original !== film.nom
          ? [['fr', film.titre_original], ['en', film.titre_original]]
          : []),
        ['en', film.nom],
      ];
      for (const [lang, titre] of tries) {
        if (cancelled) return;
        try {
          const res = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titre)}`
          );
          if (!res.ok) continue;
          const data = await res.json();
          if (data.thumbnail?.source) {
            if (!cancelled) setUrl(data.thumbnail.source);
            return;
          }
        } catch (_) {}
      }
    }

    fetchPoster();
    return () => { cancelled = true; };
  }, [film?.id]);

  return url;
}

// ── Film de la semaine card ────────────────────────────────────────────────────
function FilmDeLaSemaine({ pool, filmIndex, onPrev, onNext, filmRatings, onNoterFilm }) {
  const [descExpand, setDescExpand] = useState(false);
  const film = pool[filmIndex] || null;
  const posterUrl = useFilmPosterFA(film);

  useEffect(() => { setDescExpand(false); }, [filmIndex]);

  if (!film || pool.length === 0) return null;

  const note = filmRatings?.[film.id] ?? 0;
  const topPalmares = meilleurPalmaresFilm(film);

  function handleEtoile(n) {
    if (onNoterFilm) onNoterFilm(film.id, n === note ? 0 : n);
  }

  return (
    <div className="fa-section fa-section--film">
      <div className="fa-section__hdr">
        <div className="fa-section__icons">🎬</div>
        <div>
          <div className="fa-section__titre">Film de la semaine</div>
          <div className="fa-section__sub">{pool.length} suggestion{pool.length > 1 ? 's' : ''} disponible{pool.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="film-semaine-card__body">
        {/* Affiche */}
        <div className="film-semaine-card__poster-wrap">
          {posterUrl
            ? <img src={posterUrl} alt={film.nom} className="film-semaine-card__poster" />
            : <div className="film-semaine-card__poster-placeholder">{drapeauFilm(film.pays)}</div>
          }
        </div>

        <div className="film-semaine-card__info">
          {/* Navigation ‹ N/total › */}
          <div className="film-semaine-card__nav">
            <button className="film-nav-btn" onClick={onPrev} disabled={pool.length <= 1} aria-label="Film précédent">‹</button>
            <span className="film-nav-count">{filmIndex + 1}/{pool.length}</span>
            <button className="film-nav-btn" onClick={onNext} disabled={pool.length <= 1} aria-label="Film suivant">›</button>
          </div>

          <div className="film-semaine-card__nom">{film.nom}</div>
          {film.titre_original && film.titre_original !== film.nom && (
            <div className="film-semaine-card__titre-original">{film.titre_original}</div>
          )}
          <div className="film-semaine-card__meta">
            {drapeauFilm(film.pays)} {film.realisateur} · {film.annee}
          </div>
          <div className="film-semaine-card__genre">{film.genre}</div>

          {topPalmares && (
            <div className="film-semaine-card__palmares">{topPalmares}</div>
          )}

          {film.description && (
            <div className="film-semaine-card__desc-wrap">
              <div className={`day-album__desc${descExpand ? ' day-album__desc--open' : ''}`}>
                {film.description}
              </div>
              <button className="day-album__desc-toggle" onClick={() => setDescExpand(v => !v)}>
                {descExpand ? 'Moins ▲' : 'Lire ▼'}
              </button>
            </div>
          )}

          <div className="film-semaine-card__footer">
            <div className="album-carte__etoiles">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => handleEtoile(n)}
                  className={n <= note ? 'etoile etoile--active' : 'etoile'}
                  title={`${n} étoile${n > 1 ? 's' : ''}`}
                >★</button>
              ))}
            </div>
            {film.imdb_url && (
              <a href={film.imdb_url} target="_blank" rel="noopener noreferrer" className="album-apple-link">
                🎬 IMDB
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const JOURS_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Sources scientifiques citées dans le prompt
const SOURCES_NOTE = 'CDC Developmental Milestones 2023 · WHO Child Growth Standards · Canadian Paediatric Society (CPS) · AAP HealthyChildren.org';

// ── Utilitaires ────────────────────────────────────────────────────────────────
function calculerAgeMois(dateNaissance, referenceDate) {
  const naissance  = new Date(dateNaissance + 'T12:00:00');
  const reference  = referenceDate ? new Date(referenceDate + 'T12:00:00') : new Date();
  let mois = (reference.getFullYear() - naissance.getFullYear()) * 12 + (reference.getMonth() - naissance.getMonth());
  let jours = reference.getDate() - naissance.getDate();
  if (jours < 0) { mois--; jours += 30; }
  return { mois: Math.max(0, mois), jours: Math.max(0, jours) };
}

function formatAge({ mois, jours }) {
  if (mois < 1) return `${jours} jour${jours > 1 ? 's' : ''}`;
  if (mois === 1) return `${mois} mois`;
  if (mois < 24) return `${mois} mois`;
  const ans = Math.floor(mois / 12);
  const r = mois % 12;
  return `${ans} an${ans > 1 ? 's' : ''}${r > 0 ? ` et ${r} mois` : ''}`;
}

// ── Section développement bébés ───────────────────────────────────────────────
function SectionBebes({ bebes, semaineVue }) {
  // Calculer l'âge à la date de la semaine visionnée (pas forcément aujourd'hui)
  const age = calculerAgeMois(bebes[0].naissance, semaineVue);
  const ageStr = formatAge(age);
  const isTwins = bebes.length > 1;

  const [devContent, setDevContent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`fp_dev_bebe_${semaineVue}`) || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function charger() {
    const apiKey = localStorage.getItem('anthropic_key');
    if (!apiKey) {
      setError('Clé API Anthropic requise — configure-la dans la barre latérale (🔑).');
      return;
    }
    setLoading(true);
    setError(null);

    const nomsBebes = bebes.map(b => b.prenom).join(' et ');

    const prompt = `Tu es un pédiatre consultant une famille québécoise. ${nomsBebes} ${isTwins ? 'sont des jumelles' : 'est'} âgé${isTwins ? 'es' : ''} de ${ageStr}.

Génère un bilan de développement scientifiquement fondé, concis (max 250 mots). Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour :

{
  "theme_semaine": "Titre accrocheur décrivant ce stade développemental (ex: L'explosion du vocabulaire)",
  "points_cles": [
    { "categorie": "Langage", "observation": "Ce qu'on observe typiquement à cet âge", "source": "CDC 2023" },
    { "categorie": "Motricité", "observation": "...", "source": "WHO" },
    { "categorie": "Social / Émotionnel", "observation": "...", "source": "AAP" },
    { "categorie": "Cognitif", "observation": "...", "source": "CPS" }
  ],
  "a_encourager": ["Activité concrète basée sur l'âge", "Activité 2", "Activité 3"],
  "conseil_semaine": "Un conseil pratique encourageant pour les parents",
  "sources": ["CDC Developmental Milestones (2023)", "WHO Child Growth Standards", "CPS — Soins de nos enfants", "AAP HealthyChildren.org"]
}

Basé strictement sur : CDC Developmental Milestones (2023), WHO Child Growth Standards, Canadian Paediatric Society (soinsdenosnfants.cps.ca), AAP HealthyChildren.org (2022).`;

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 30000 });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Format inattendu');
      const data = JSON.parse(match[0]);
      localStorage.setItem(`fp_dev_bebe_${semaineVue}`, JSON.stringify(data));
      setDevContent(data);
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionError) {
        setError('Impossible de joindre l\'API. Vérifie ta connexion.');
      } else if (e instanceof Anthropic.AuthenticationError) {
        setError('Clé API invalide — vérifie-la dans 🔑.');
      } else if (e instanceof Anthropic.APITimeoutError) {
        setError('Délai dépassé — réessaie.');
      } else {
        setError(e.message || 'Erreur inattendue.');
      }
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDevContent(null);
    localStorage.removeItem(`fp_dev_bebe_${semaineVue}`);
  }

  return (
    <div className="fa-section">
      <div className="fa-section__hdr">
        <div className="fa-section__icons">
          {bebes.map(b => <span key={b.prenom} title={b.prenom}>{b.emoji}</span>)}
        </div>
        <div>
          <div className="fa-section__titre">{bebes.map(b => b.prenom).join(' & ')}</div>
          <div className="fa-section__sub">{ageStr} · Développement</div>
        </div>
      </div>

      {devContent ? (
        <div className="fa-dev">
          <div className="fa-dev__theme">{devContent.theme_semaine}</div>

          <div className="fa-dev__points">
            {(devContent.points_cles || []).map((p, i) => (
              <div key={i} className="fa-dev__point">
                <span className="fa-dev__cat">{p.categorie}</span>
                <span className="fa-dev__obs">{p.observation}</span>
                <span className="fa-dev__src">{p.source}</span>
              </div>
            ))}
          </div>

          {(devContent.a_encourager || []).length > 0 && (
            <div className="fa-dev__encourager">
              <div className="fa-dev__encourager-titre">À encourager cette semaine</div>
              {devContent.a_encourager.map((a, i) => (
                <div key={i} className="fa-dev__encourager-item">→ {a}</div>
              ))}
            </div>
          )}

          {devContent.conseil_semaine && (
            <div className="fa-dev__conseil">💡 {devContent.conseil_semaine}</div>
          )}

          <div className="fa-dev__sources">
            Sources : {(devContent.sources || []).join(' · ')}
          </div>

          <button className="fa-dev__refresh" onClick={reset}>↻ Actualiser</button>
        </div>
      ) : (
        <div className="fa-dev__idle">
          {error && <div className="fa-dev__error">{error}</div>}
          <button className="fa-dev__btn" onClick={charger} disabled={loading}>
            {loading ? '⏳ Génération…' : '✨ Charger le bilan développement'}
          </button>
          <div className="fa-dev__hint">{SOURCES_NOTE}</div>
        </div>
      )}
    </div>
  );
}

// ── Section agenda de la semaine ──────────────────────────────────────────────
function SectionAgenda({ obligations, evenements, semaineVue }) {
  const semaineDates = useMemo(() => {
    const lundi = new Date(semaineVue + 'T12:00:00');
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lundi);
      d.setDate(lundi.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }, [semaineVue]);

  const evenementsSemaine = (evenements || []).filter(e => semaineDates.includes(e.date));

  // Obligations par jour (0=Lundi … 6=Dimanche)
  const obligsByDay = useMemo(() => {
    const map = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    (obligations || []).forEach(o => {
      if (o.jourSemaine >= 0 && o.jourSemaine < 7) map[o.jourSemaine].push(o);
    });
    return map;
  }, [obligations]);

  const hasContent = (obligations || []).length > 0 || evenementsSemaine.length > 0;
  if (!hasContent) return null;

  return (
    <div className="fa-section fa-section--agenda">
      <div className="fa-section__hdr">
        <div className="fa-section__icons">📅</div>
        <div className="fa-section__titre">Agenda de la semaine</div>
      </div>
      <div className="fa-agenda">
        {semaineDates.map((date, idx) => {
          const obls = obligsByDay[idx] || [];
          const evts = evenementsSemaine.filter(e => e.date === date);
          if (obls.length === 0 && evts.length === 0) return null;
          return (
            <div key={date} className="fa-agenda__jour">
              <div className="fa-agenda__jour-label">{JOURS_COURT[idx]}</div>
              <div className="fa-agenda__items">
                {obls.map(o => (
                  <div key={o.id} className="fa-agenda__item fa-agenda__item--oblig">
                    <span className="fa-agenda__emoji">{o.emoji || '📌'}</span>
                    <span className="fa-agenda__titre">{o.titre}</span>
                    {o.heureDebut && (
                      <span className="fa-agenda__heure">{o.heureDebut}–{o.heureFin}</span>
                    )}
                  </div>
                ))}
                {evts.map(e => (
                  <div key={e.id} className="fa-agenda__item fa-agenda__item--event">
                    <span className="fa-agenda__emoji">📍</span>
                    <span className="fa-agenda__titre">{e.titre}</span>
                    {e.heureDebut && (
                      <span className="fa-agenda__heure">
                        {e.heureDebut}{e.heureFin ? `–${e.heureFin}` : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section sorties de la semaine ─────────────────────────────────────────────
function formatDateCourte(dateStr, dateFinStr) {
  if (!dateStr) return null;
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (dateFinStr && dateFinStr !== dateStr) {
    const debut = new Date(dateStr + 'T12:00:00');
    const fin   = new Date(dateFinStr + 'T12:00:00');
    return `${debut.toLocaleDateString('fr-CA', opts)} – ${fin.toLocaleDateString('fr-CA', opts)}`;
  }
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', opts);
}

function formatPrixActivite(a) {
  const adulte = a.cout_adulte ?? a.cout ?? 0;
  if (a.gratuit || adulte === 0) return 'Gratuit';
  const enfant = a.cout_enfant;
  if (enfant != null && enfant === 0) return `${adulte} $ adulte · Gratuit enfant`;
  if (enfant != null && enfant !== adulte) return `${adulte} $ adulte · ${enfant} $ enfant`;
  return `${adulte} $ / pers.`;
}

function MiniCarteActivite({ activite, label }) {
  const isGratuit = activite.gratuit || (activite.cout_adulte ?? activite.cout ?? 0) === 0;
  const prix = formatPrixActivite(activite);
  const desc = activite.description_generee || activite.description || '';

  return (
    <div className={`fa-sortie ${isGratuit ? 'fa-sortie--gratuite' : 'fa-sortie--payante'}`}>
      <div className="fa-sortie__context-row">
        {label && <span className="fa-sortie__label">{label}</span>}
        {activite.incontournable && <span className="fa-sortie__incon">⭐ À ne pas manquer</span>}
      </div>
      <div className="fa-sortie__top">
        {activite.url ? (
          <a className="fa-sortie__nom" href={activite.url} target="_blank" rel="noopener noreferrer">
            {activite.nom}
          </a>
        ) : (
          <div className="fa-sortie__nom">{activite.nom}</div>
        )}
        <span className={`fa-sortie__prix${isGratuit ? ' fa-sortie__prix--gratuit' : ''}`}>{prix}</span>
      </div>
      {activite.date && (
        <div className="fa-sortie__meta">📅 {formatDateCourte(activite.date, activite.date_fin)}{activite.lieu ? ` · 📍 ${activite.lieu}` : ''}</div>
      )}
      {!activite.date && activite.lieu && (
        <div className="fa-sortie__meta">📍 {activite.lieu}</div>
      )}
      {desc && (
        <div className="fa-sortie__desc">{desc.length > 140 ? desc.slice(0, 140) + '…' : desc}</div>
      )}
    </div>
  );
}

function SectionCoupDeCoeur({ semaineVue }) {
  const { semaineFin, periodeElargieFin } = useMemo(() => {
    const lundi = new Date(semaineVue + 'T12:00:00');
    const dim   = new Date(lundi); dim.setDate(lundi.getDate() + 6);
    const elargi = new Date(lundi); elargi.setDate(lundi.getDate() + 20); // ~3 semaines de fenêtre
    return {
      semaineFin:       dim.toISOString().split('T')[0],
      periodeElargieFin: elargi.toISOString().split('T')[0],
    };
  }, [semaineVue]);

  const recommandations = useMemo(() => {
    // ── Slot 1 : meilleure activité DE LA SEMAINE VISIONNÉE ──────────────────
    // (lundi → dimanche, ±3 jours pour les événements multi-jours déjà commencés)
    const semaineMinElargi = new Date(semaineVue + 'T12:00:00');
    semaineMinElargi.setDate(semaineMinElargi.getDate() - 3);
    const semaineMinStr = semaineMinElargi.toISOString().split('T')[0];

    const scorerSemaine = a =>
      (a.incontournable ? 200 : 0) + (a.score_famille ?? 0);

    // Pour les événements multi-jours: actif si date_debut <= semaineFin ET date_fin >= semaineVue
    const estDansSemaine = a =>
      a.date && a.date <= semaineFin && (a.date_fin || a.date) >= semaineVue && (a.date_fin || a.date) >= semaineMinStr;

    const activitesSemaine = activites
      .filter(a => estDansSemaine(a))
      .filter(a => (a.score_famille ?? 0) > 0)
      .sort((a, b) => scorerSemaine(b) - scorerSemaine(a));

    const slot1 = activitesSemaine[0] ?? null;

    // ── Slot 2 : meilleure activité complémentaire (semaine élargie ou permanente) ──
    // Différente du slot 1, couvre les semaines à venir pour anticiper
    const scorerElargi = a => {
      const dansSemaine = estDansSemaine(a);
      return (a.incontournable ? 300 : 0) + (dansSemaine ? 100 : 0) + (a.score_famille ?? 0);
    };

    const autresCandidats = activites.filter(a => {
      if (a === slot1) return false;
      if (!a.date || a.date === '') return true; // permanentes
      // Après la semaine courante, dans la fenêtre élargie
      const finEvenement = a.date_fin || a.date;
      return finEvenement > semaineFin && a.date <= periodeElargieFin;
    }).filter(a => (a.score_famille ?? 0) > 0);

    const slot2 = [...autresCandidats].sort((a, b) => scorerElargi(b) - scorerElargi(a))[0] ?? null;

    // Si slot1 est vide, prendre les deux meilleurs de la fenêtre élargie
    if (!slot1) {
      const fallback = activites.filter(a => {
        if (!a.date || a.date === '') return true;
        const finEvenement = a.date_fin || a.date;
        return a.date <= periodeElargieFin && finEvenement >= semaineVue;
      }).filter(a => (a.score_famille ?? 0) > 0)
        .sort((a, b) => scorerElargi(b) - scorerElargi(a));
      return fallback.slice(0, 2);
    }

    return [slot1, slot2].filter(Boolean);
  }, [semaineVue, semaineFin, periodeElargieFin]);

  if (recommandations.length === 0) return null;

  return (
    <div className="fa-section fa-section--sorties">
      <div className="fa-section__hdr">
        <div className="fa-section__icons">🗺</div>
        <div>
          <div className="fa-section__titre">Sorties de la semaine</div>
          <div className="fa-section__sub">Recommandations pour la famille</div>
        </div>
      </div>
      <div className="fa-sorties-grid">
        {recommandations.map((a, i) => {
          const dansSemaine = a.date && a.date <= semaineFin && (a.date_fin || a.date) >= semaineVue;
          const label = !a.date ? 'Suggestion permanente' : dansSemaine ? 'Cette semaine' : 'À venir';
          return <MiniCarteActivite key={i} activite={a} label={label} />;
        })}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function FamilleActualites({ profils, semaineVue, agenda = {}, filtresOrigine, filmRatings = {}, onNoterFilm }) {
  const [open, setOpen] = useState(false);
  const obligations = agenda.obligations || [];
  const evenements = agenda.evenements || [];

  // ── Film de la semaine ──────────────────────────────────────────────────────
  const origineActive = filtresOrigine && filtresOrigine !== 'Tous' ? filtresOrigine : null;
  const filmPool = useMemo(
    () => getFilmsCandidats(semaineVue, origineActive, films),
    [semaineVue, origineActive]
  );
  const [filmIndex, setFilmIndex] = useState(() => getFilmIndexInitial(semaineVue, filmPool));
  useEffect(() => {
    const pool = getFilmsCandidats(semaineVue, origineActive, films);
    setFilmIndex(getFilmIndexInitial(semaineVue, pool));
  }, [semaineVue, origineActive]);
  function filmPrev() { setFilmIndex(i => (i - 1 + filmPool.length) % filmPool.length); }
  function filmNext() { setFilmIndex(i => (i + 1) % filmPool.length); }

  // Identifier les bébés (< 36 mois à la date de la semaine visionnée)
  const bebes = useMemo(() =>
    (profils || []).filter(p => {
      if (!p.naissance) return false;
      return calculerAgeMois(p.naissance, semaineVue).mois < 36;
    }), [profils, semaineVue]);

  const hasAgenda = obligations.length > 0 ||
    (evenements || []).some(e => {
      // Au moins un événement dans les 14 prochains jours
      const d = new Date(e.date + 'T12:00:00');
      const diff = (d - new Date()) / 86400000;
      return diff >= -1 && diff <= 14;
    });

  if (bebes.length === 0 && !hasAgenda) {
    // Afficher quand même si des sorties ou un film sont disponibles
    return (
      <div className="famille-actualites">
        <button className="fa-toggle" onClick={() => setOpen(v => !v)}>
          <span className="fa-toggle__title">🏠 Vie de famille</span>
          <span className="fa-toggle__chevron">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="fa-body">
            <SectionCoupDeCoeur semaineVue={semaineVue} />
            {filmPool.length > 0 && (
              <FilmDeLaSemaine
                pool={filmPool}
                filmIndex={filmIndex}
                onPrev={filmPrev}
                onNext={filmNext}
                filmRatings={filmRatings}
                onNoterFilm={onNoterFilm}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="famille-actualites">
      <button className="fa-toggle" onClick={() => setOpen(v => !v)}>
        <span className="fa-toggle__title">🏠 Vie de famille</span>
        <span className="fa-toggle__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="fa-body">
          <SectionCoupDeCoeur semaineVue={semaineVue} />
          {bebes.length > 0 && (
            <SectionBebes key={semaineVue} bebes={bebes} semaineVue={semaineVue} />
          )}
          <SectionAgenda
            obligations={obligations}
            evenements={evenements}
            semaineVue={semaineVue}
          />
          {filmPool.length > 0 && (
            <FilmDeLaSemaine
              pool={filmPool}
              filmIndex={filmIndex}
              onPrev={filmPrev}
              onNext={filmNext}
              filmRatings={filmRatings}
              onNoterFilm={onNoterFilm}
            />
          )}
        </div>
      )}
    </div>
  );
}
