import { useState } from 'react';
import meta from '../data/meta.json';

// Formate une date ISO complète en français
function formatDateHeure(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

const SOURCE_CONFIG = {
  ticketmaster: {
    label: 'Ticketmaster',
    icon: '🎟',
    description: 'Événements officiels avec billetterie',
  },
  eventbrite: {
    label: 'Eventbrite',
    icon: '🎪',
    description: 'Événements gratuits et culturels à Québec (JSON embarqué, sans clé API)',
  },
  claude: {
    label: 'Claude IA — Suggestions',
    icon: '🤖',
    description: 'Suggestions personnalisées selon les profils de la famille',
  },
  claude_gratuites: {
    label: 'Claude IA — Gratuites',
    icon: '🆓',
    description: 'Activités 100 % gratuites garanties',
  },
  web_search: {
    label: 'Claude IA — Web Search',
    icon: '🔍',
    description: 'Événements underground découverts par recherche web autonome',
  },
};

function StatusBadge({ statut }) {
  if (statut === 'ok') return <span className="update-badge update-badge--ok">✓ OK</span>;
  if (statut === 'erreur') return <span className="update-badge update-badge--error">✗ Erreur</span>;
  return <span className="update-badge update-badge--absent">— Absent</span>;
}

function PromptBlock({ prompt }) {
  const [expanded, setExpanded] = useState(false);
  if (!prompt) return <p className="update-no-data">Prompt non disponible</p>;
  const preview = prompt.length > 300 ? prompt.slice(0, 300) + '…' : prompt;
  return (
    <div className="update-prompt">
      <pre className="update-prompt-text">{expanded ? prompt : preview}</pre>
      {prompt.length > 300 && (
        <button className="update-toggle" onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ Réduire' : '▼ Voir le prompt complet'}
        </button>
      )}
    </div>
  );
}

function SourceSection({ sourceKey, data }) {
  const config = SOURCE_CONFIG[sourceKey] || { label: sourceKey, icon: '•', description: '' };

  return (
    <div className={`update-source update-source--${data.statut}`}>
      <div className="update-source-header">
        <span className="update-source-icon">{config.icon}</span>
        <div className="update-source-info">
          <span className="update-source-label">{config.label}</span>
          <span className="update-source-desc">{config.description}</span>
        </div>
        <div className="update-source-right">
          <StatusBadge statut={data.statut} />
          {data.statut === 'ok' && (
            <span className="update-source-count">{data.count} activité{data.count !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {data.statut !== 'absent' && (
        <div className="update-source-body">
          {/* URL Ticketmaster */}
          {data.url && (
            <div className="update-detail">
              <span className="update-detail-label">URL</span>
              <code className="update-url">{data.url}</code>
            </div>
          )}

          {/* URLs Eventbrite */}
          {data.urls && data.urls.length > 0 && (
            <div className="update-detail">
              <span className="update-detail-label">Pages consultées</span>
              <ul className="update-list">
                {data.urls.map((u, i) => <li key={i}><code>{u}</code></li>)}
              </ul>
            </div>
          )}

          {/* Erreur */}
          {data.erreur && (
            <div className="update-detail">
              <span className="update-detail-label">Erreur</span>
              <code className="update-error-text">{data.erreur}</code>
            </div>
          )}

          {/* Modèle */}
          {data.modele && (
            <div className="update-detail">
              <span className="update-detail-label">Modèle</span>
              <code className="update-model">{data.modele}</code>
            </div>
          )}

          {/* Prompt */}
          {data.prompt && (
            <div className="update-detail">
              <span className="update-detail-label">Prompt</span>
              <PromptBlock prompt={data.prompt} />
            </div>
          )}

          {/* Requêtes web_search */}
          {data.recherches && data.recherches.length > 0 && (
            <div className="update-detail">
              <span className="update-detail-label">Recherches ({data.recherches.length})</span>
              <ul className="update-list">
                {data.recherches.map((q, i) => <li key={i}>🔎 {q}</li>)}
              </ul>
            </div>
          )}

          {/* Sites visités */}
          {data.sitesVisites && data.sitesVisites.length > 0 && (
            <div className="update-detail">
              <span className="update-detail-label">Sites consultés ({data.sitesVisites.length})</span>
              <ul className="update-list update-list--urls">
                {data.sitesVisites.map((url, i) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {new URL(url).hostname}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UpdateModal({ onClose }) {
  const sources = meta.sources || {};
  const heureMAJ = formatDateHeure(meta.lastUpdated);

  // ── Résumé de santé ──────────────────────────────────────────────────────
  const anthropicOk = !!localStorage.getItem('anthropic_key');
  const issues = [];
  if (!anthropicOk) issues.push('Clé API Anthropic manquante — les suggestions IA sont désactivées');
  Object.entries(sources).forEach(([key, data]) => {
    if (data?.statut === 'erreur') {
      const label = SOURCE_CONFIG[key]?.label || key;
      issues.push(`${label} — erreur lors de la mise à jour${data.erreur ? ` : ${data.erreur}` : ''}`);
    }
  });
  const toutOk = issues.length === 0;

  return (
    <div className="update-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="update-modal">
        <button className="update-close" onClick={onClose} aria-label="Fermer">✕</button>

        {/* Bandeau de santé */}
        <div className={`update-health update-health--${toutOk ? 'ok' : 'warn'}`}>
          {toutOk ? (
            <span>✓ Tout fonctionne normalement</span>
          ) : (
            <>
              <div className="update-health__titre">⚠ {issues.length} problème{issues.length > 1 ? 's' : ''} détecté{issues.length > 1 ? 's' : ''}</div>
              <ul className="update-health__list">
                {issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </>
          )}
        </div>

        <div className="update-modal-header">
          <h2 className="update-title">Journal de mise à jour</h2>
          <p className="update-subtitle">Détails de la dernière synchronisation des données</p>
        </div>

        <div className="update-timestamp">
          <span className="update-timestamp-label">Heure de la mise à jour</span>
          <span className="update-timestamp-value">{heureMAJ}</span>
        </div>

        <div className="update-summary">
          <div className="update-stat">
            <span className="update-stat-n">{meta.count ?? '—'}</span>
            <span className="update-stat-l">activités total</span>
          </div>
          <div className="update-stat">
            <span className="update-stat-n">{meta.ticketmaster ?? '—'}</span>
            <span className="update-stat-l">Ticketmaster</span>
          </div>
          <div className="update-stat">
            <span className="update-stat-n">{meta.claude ?? '—'}</span>
            <span className="update-stat-l">Claude IA</span>
          </div>
          <div className="update-stat">
            <span className="update-stat-n">{meta.gratuites ?? '—'}</span>
            <span className="update-stat-l">gratuites</span>
          </div>
        </div>

        <div className="update-sources">
          {Object.entries(SOURCE_CONFIG).map(([key]) => (
            <SourceSection key={key} sourceKey={key} data={sources[key] || { statut: 'absent', count: 0 }} />
          ))}
        </div>

        <p className="update-footnote">
          La mise à jour automatique a lieu chaque <strong>dimanche à midi</strong> (heure de Québec).
          Vous pouvez aussi la déclencher manuellement depuis GitHub Actions.
        </p>
      </div>
    </div>
  );
}
