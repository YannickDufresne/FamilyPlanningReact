import { useState, useMemo } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import activites from '../data/activites.json';

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
function formatDateCourte(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatPrixActivite(a) {
  const adulte = a.cout_adulte ?? a.cout ?? 0;
  if (a.gratuit || adulte === 0) return 'Gratuit';
  const enfant = a.cout_enfant;
  if (enfant != null && enfant === 0) return `${adulte} $ adulte · Gratuit enfant`;
  if (enfant != null && enfant !== adulte) return `${adulte} $ adulte · ${enfant} $ enfant`;
  return `${adulte} $ / pers.`;
}

function MiniCarteActivite({ activite }) {
  const isGratuit = activite.gratuit || (activite.cout_adulte ?? activite.cout ?? 0) === 0;
  const prix = formatPrixActivite(activite);
  const desc = activite.description_generee || activite.description || '';

  return (
    <div className={`fa-sortie ${isGratuit ? 'fa-sortie--gratuite' : 'fa-sortie--payante'}`}>
      {activite.incontournable && (
        <span className="fa-sortie__incon">⭐ À ne pas manquer</span>
      )}
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
        <div className="fa-sortie__meta">📅 {formatDateCourte(activite.date)}{activite.lieu ? ` · 📍 ${activite.lieu}` : ''}</div>
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
  // Bornes de la semaine visionnée (lundi → dimanche) + fenêtre élargie pour candidats
  const { semaineFin, dateRecherchMin, dateRecherchMax } = useMemo(() => {
    const lundi = new Date(semaineVue + 'T12:00:00');
    const dim   = new Date(lundi); dim.setDate(lundi.getDate() + 6);
    const rMin  = new Date(lundi); rMin.setDate(lundi.getDate() - 4); // multi-jours commencés avant
    const rMax  = new Date(lundi); rMax.setDate(lundi.getDate() + 13); // jusqu'à la semaine suivante
    return {
      semaineFin:       dim.toISOString().split('T')[0],
      dateRecherchMin:  rMin.toISOString().split('T')[0],
      dateRecherchMax:  rMax.toISOString().split('T')[0],
    };
  }, [semaineVue]);

  const recommandations = useMemo(() => {
    // Scoring ancré sur la semaine visionnée (pas "aujourd'hui")
    // → le Salon du livre (8 avr.) sera prioritaire pour la semaine du 6 avr.
    const scorerActivite = a => {
      const dansSemaine = a.date && a.date >= semaineVue && a.date <= semaineFin;
      const apresDebut  = a.date && a.date >= semaineVue;
      return (
        (a.incontournable ? 500 : 0) +
        (dansSemaine      ? 300 : 0) + // dans la semaine visionnée = bonus fort
        (apresDebut       ? 100 : 0) + // après le lundi, pas encore passée par rapport à la semaine
        (a.score_famille  ?? 0)
      );
    };

    // Candidats : activités datées dans la fenêtre élargie + permanentes
    const candidats = activites.filter(a => {
      if (!a.date || a.date === '') return true;                // permanente toujours incluse
      if (a.date > dateRecherchMax) return false;              // trop loin dans le futur
      if (a.date >= semaineVue) return true;                   // dans ou après la semaine
      if (a.incontournable && a.date >= dateRecherchMin) return true; // incontournable récent (multi-jours)
      return false;
    }).filter(a => (a.score_famille ?? 0) > 0);

    const sorted = [...candidats].sort((a, b) => scorerActivite(b) - scorerActivite(a));

    const top = sorted[0] ?? null;
    const topIsGratuit = top && (top.gratuit || (top.cout_adulte ?? top.cout ?? 0) === 0);
    const topGratuit = sorted.find(a =>
      (a.gratuit || (a.cout_adulte ?? a.cout ?? 0) === 0) && a !== top
    ) ?? null;
    const deuxieme = topIsGratuit ? (sorted[1] ?? null) : topGratuit;

    return [top, deuxieme].filter(Boolean);
  }, [semaineVue, semaineFin, dateRecherchMin, dateRecherchMax]);

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
        {recommandations.map((a, i) => (
          <MiniCarteActivite key={i} activite={a} />
        ))}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function FamilleActualites({ profils, semaineVue, agenda = {} }) {
  const [open, setOpen] = useState(false);
  const obligations = agenda.obligations || [];
  const evenements = agenda.evenements || [];

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
    // Afficher quand même si des sorties sont disponibles
    return (
      <div className="famille-actualites">
        <button className="fa-toggle" onClick={() => setOpen(v => !v)}>
          <span className="fa-toggle__title">🏠 Vie de famille</span>
          <span className="fa-toggle__chevron">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="fa-body">
            <SectionCoupDeCoeur semaineVue={semaineVue} />
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
        </div>
      )}
    </div>
  );
}
