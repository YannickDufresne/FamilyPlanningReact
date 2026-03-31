import { useState, useRef } from 'react';

// ── Utilitaires ────────────────────────────────────────────────────────────────
function calculerAge(naissance) {
  if (!naissance) return null;
  const n = new Date(naissance + 'T12:00:00');
  const today = new Date();
  let age = today.getFullYear() - n.getFullYear();
  const dm = today.getMonth() - n.getMonth();
  if (dm < 0 || (dm === 0 && today.getDate() < n.getDate())) age--;
  return age;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const JOURS_NOMS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ── Édition d'un profil membre ────────────────────────────────────────────────
function CarteMembreEdit({ membre, onChange }) {
  const age = calculerAge(membre.naissance);
  return (
    <div className="profil-carte">
      <div className="profil-carte__header">
        <span className="profil-carte__emoji">{membre.emoji}</span>
        <div>
          <div className="profil-carte__nom">{membre.prenom}</div>
          {age !== null && (
            <div className="profil-carte__age">{age} ans</div>
          )}
        </div>
      </div>

      <label className="profil-field">
        <span className="profil-field__label">Ce qu'il/elle aime</span>
        <textarea
          className="profil-field__input"
          rows={3}
          value={membre.aime || ''}
          placeholder="ex: culture, plein air, gastronomie, théâtre..."
          onChange={e => onChange({ ...membre, aime: e.target.value })}
        />
        <span className="profil-field__hint">Séparés par des virgules — utilisés pour classer les activités</span>
      </label>

      <label className="profil-field">
        <span className="profil-field__label">Note personnelle</span>
        <textarea
          className="profil-field__input"
          rows={2}
          value={membre.note || ''}
          placeholder="ex: Préfère les sorties calmes, allergique aux..."
          onChange={e => onChange({ ...membre, note: e.target.value })}
        />
      </label>
    </div>
  );
}

// ── Onglet Agenda ─────────────────────────────────────────────────────────────
const OBLIG_VIDE = { membre: '', emoji: '', titre: '', jourSemaine: 0, heureDebut: '18:00', heureFin: '20:00' };
const EVENT_VIDE = { membres: [], titre: '', date: '', heureDebut: '', heureFin: '' };

function OngletAgenda({ agenda, profils, onSave }) {
  const [local, setLocal] = useState({
    obligations: (agenda.obligations || []).map(o => ({ ...o })),
    evenements:  (agenda.evenements  || []).map(e => ({ ...e })),
  });

  const [showObligForm, setShowObligForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [nouvOblig, setNouvOblig] = useState({ ...OBLIG_VIDE });
  const [nouvEvent, setNouvEvent] = useState({ ...EVENT_VIDE });

  function save(next) {
    setLocal(next);
    onSave(next);
  }

  // ── Obligations ──
  function ajouterOblig() {
    if (!nouvOblig.titre.trim()) return;
    const oblig = { ...nouvOblig, id: uid() };
    const next = { ...local, obligations: [...local.obligations, oblig] };
    save(next);
    setNouvOblig({ ...OBLIG_VIDE });
    setShowObligForm(false);
  }

  function supprimerOblig(id) {
    save({ ...local, obligations: local.obligations.filter(o => o.id !== id) });
  }

  // Quand on sélectionne un membre dans le formulaire d'obligation
  function handleObligMembre(e) {
    const prenom = e.target.value;
    const profil = profils.find(p => p.prenom === prenom);
    setNouvOblig(prev => ({ ...prev, membre: prenom, emoji: profil?.emoji || '📌' }));
  }

  // ── Événements ──
  function ajouterEvent() {
    if (!nouvEvent.titre.trim() || !nouvEvent.date) return;
    const evt = { ...nouvEvent, id: uid() };
    const next = { ...local, evenements: [...local.evenements, evt] };
    save(next);
    setNouvEvent({ ...EVENT_VIDE });
    setShowEventForm(false);
  }

  function supprimerEvent(id) {
    save({ ...local, evenements: local.evenements.filter(e => e.id !== id) });
  }

  function toggleEventMembre(prenom) {
    setNouvEvent(prev => {
      const membres = prev.membres.includes(prenom)
        ? prev.membres.filter(m => m !== prenom)
        : [...prev.membres, prenom];
      return { ...prev, membres };
    });
  }

  // Trier les événements par date
  const eventsTries = [...local.evenements].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="agenda-tab">

      {/* ── Obligations récurrentes ── */}
      <div className="agenda-section">
        <div className="agenda-section__hdr">
          <div>
            <div className="agenda-section__titre">Obligations récurrentes</div>
            <div className="agenda-section__desc">Activités fixes chaque semaine (répétition hebdomadaire)</div>
          </div>
          <button className="agenda-btn-add" onClick={() => setShowObligForm(v => !v)}>
            {showObligForm ? '✕ Annuler' : '+ Ajouter'}
          </button>
        </div>

        {showObligForm && (
          <div className="agenda-form">
            <div className="agenda-form__row">
              <label className="agenda-form__label">Membre</label>
              <select
                className="agenda-form__input"
                value={nouvOblig.membre}
                onChange={handleObligMembre}
              >
                <option value="">— choisir —</option>
                {profils.map(p => (
                  <option key={p.prenom} value={p.prenom}>{p.emoji} {p.prenom}</option>
                ))}
              </select>
            </div>
            <div className="agenda-form__row">
              <label className="agenda-form__label">Titre</label>
              <input
                type="text"
                className="agenda-form__input"
                placeholder="ex: Euphonium — Harmonie municipale"
                value={nouvOblig.titre}
                onChange={e => setNouvOblig(prev => ({ ...prev, titre: e.target.value }))}
              />
            </div>
            <div className="agenda-form__row">
              <label className="agenda-form__label">Jour</label>
              <select
                className="agenda-form__input"
                value={nouvOblig.jourSemaine}
                onChange={e => setNouvOblig(prev => ({ ...prev, jourSemaine: +e.target.value }))}
              >
                {JOURS_NOMS.map((j, i) => <option key={j} value={i}>{j}</option>)}
              </select>
            </div>
            <div className="agenda-form__row agenda-form__row--double">
              <div>
                <label className="agenda-form__label">Début</label>
                <input
                  type="time"
                  className="agenda-form__input"
                  value={nouvOblig.heureDebut}
                  onChange={e => setNouvOblig(prev => ({ ...prev, heureDebut: e.target.value }))}
                />
              </div>
              <div>
                <label className="agenda-form__label">Fin</label>
                <input
                  type="time"
                  className="agenda-form__input"
                  value={nouvOblig.heureFin}
                  onChange={e => setNouvOblig(prev => ({ ...prev, heureFin: e.target.value }))}
                />
              </div>
            </div>
            <button
              className="agenda-form__submit"
              onClick={ajouterOblig}
              disabled={!nouvOblig.titre.trim() || !nouvOblig.membre}
            >
              ✓ Ajouter l'obligation
            </button>
          </div>
        )}

        {local.obligations.length === 0 && !showObligForm ? (
          <div className="agenda-empty">Aucune obligation récurrente.</div>
        ) : (
          <div className="agenda-list">
            {local.obligations.map(o => (
              <div key={o.id} className="agenda-item">
                <span className="agenda-item__emoji">{o.emoji || '📌'}</span>
                <div className="agenda-item__body">
                  <div className="agenda-item__titre">{o.titre}</div>
                  <div className="agenda-item__details">
                    {o.membre && <span>{o.membre}</span>}
                    <span>·</span>
                    <span>{JOURS_NOMS[o.jourSemaine]}</span>
                    {o.heureDebut && <><span>·</span><span>{o.heureDebut}–{o.heureFin}</span></>}
                  </div>
                </div>
                <button
                  className="agenda-item__del"
                  onClick={() => supprimerOblig(o.id)}
                  title="Supprimer"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Événements ponctuels ── */}
      <div className="agenda-section">
        <div className="agenda-section__hdr">
          <div>
            <div className="agenda-section__titre">Événements ponctuels</div>
            <div className="agenda-section__desc">Rendez-vous, matchs, sorties, etc.</div>
          </div>
          <button className="agenda-btn-add" onClick={() => setShowEventForm(v => !v)}>
            {showEventForm ? '✕ Annuler' : '+ Ajouter'}
          </button>
        </div>

        {showEventForm && (
          <div className="agenda-form">
            <div className="agenda-form__row">
              <label className="agenda-form__label">Titre</label>
              <input
                type="text"
                className="agenda-form__input"
                placeholder="ex: Match de hockey de Joseph"
                value={nouvEvent.titre}
                onChange={e => setNouvEvent(prev => ({ ...prev, titre: e.target.value }))}
              />
            </div>
            <div className="agenda-form__row">
              <label className="agenda-form__label">Date</label>
              <input
                type="date"
                className="agenda-form__input"
                value={nouvEvent.date}
                onChange={e => setNouvEvent(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="agenda-form__row agenda-form__row--double">
              <div>
                <label className="agenda-form__label">Début (optionnel)</label>
                <input
                  type="time"
                  className="agenda-form__input"
                  value={nouvEvent.heureDebut}
                  onChange={e => setNouvEvent(prev => ({ ...prev, heureDebut: e.target.value }))}
                />
              </div>
              <div>
                <label className="agenda-form__label">Fin</label>
                <input
                  type="time"
                  className="agenda-form__input"
                  value={nouvEvent.heureFin}
                  onChange={e => setNouvEvent(prev => ({ ...prev, heureFin: e.target.value }))}
                />
              </div>
            </div>
            <div className="agenda-form__row">
              <label className="agenda-form__label">Membres concernés</label>
              <div className="agenda-form__membres">
                {profils.map(p => (
                  <button
                    key={p.prenom}
                    type="button"
                    className={`agenda-form__membre-btn ${nouvEvent.membres.includes(p.prenom) ? 'agenda-form__membre-btn--active' : ''}`}
                    onClick={() => toggleEventMembre(p.prenom)}
                  >
                    {p.emoji} {p.prenom}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="agenda-form__submit"
              onClick={ajouterEvent}
              disabled={!nouvEvent.titre.trim() || !nouvEvent.date}
            >
              ✓ Ajouter l'événement
            </button>
          </div>
        )}

        {eventsTries.length === 0 && !showEventForm ? (
          <div className="agenda-empty">Aucun événement ponctuel.</div>
        ) : (
          <div className="agenda-list">
            {eventsTries.map(e => {
              const dateLabel = new Date(e.date + 'T12:00:00')
                .toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
              return (
                <div key={e.id} className="agenda-item">
                  <span className="agenda-item__emoji">📍</span>
                  <div className="agenda-item__body">
                    <div className="agenda-item__titre">{e.titre}</div>
                    <div className="agenda-item__details">
                      <span>{dateLabel}</span>
                      {e.heureDebut && <><span>·</span><span>{e.heureDebut}{e.heureFin ? `–${e.heureFin}` : ''}</span></>}
                      {e.membres?.length > 0 && <><span>·</span><span>{e.membres.join(', ')}</span></>}
                    </div>
                  </div>
                  <button
                    className="agenda-item__del"
                    onClick={() => supprimerEvent(e.id)}
                    title="Supprimer"
                  >✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal principale ──────────────────────────────────────────────────────────
export default function ProfilsModal({ profils, onSave, onClose, photoUrl, onPhotoChange, agenda, onSaveAgenda }) {
  const [onglet, setOnglet] = useState('profils'); // 'profils' | 'agenda'
  const [local, setLocal] = useState(profils.map(p => ({ ...p })));
  const [photoPreview, setPhotoPreview] = useState(photoUrl || null);
  const [photoErreur, setPhotoErreur] = useState('');
  const fileInputRef = useRef(null);

  const handleChange = (i, updated) => {
    setLocal(prev => prev.map((p, j) => j === i ? updated : p));
  };

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoErreur('Veuillez choisir une image (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoErreur('Image trop grande (max 4 Mo)');
      return;
    }
    setPhotoErreur('');
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      setPhotoPreview(dataUrl);
      onPhotoChange?.(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  const photoAffichee = photoPreview || `${import.meta.env.BASE_URL}family_photo.jpg`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel profils-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fermer">✕</button>

        <h2 className="profils-modal__titre">Famille</h2>

        {/* ── Onglets ── */}
        <div className="profils-modal__tabs">
          <button
            className={`profils-modal__tab ${onglet === 'profils' ? 'profils-modal__tab--active' : ''}`}
            onClick={() => setOnglet('profils')}
          >
            👥 Profils
          </button>
          <button
            className={`profils-modal__tab ${onglet === 'agenda' ? 'profils-modal__tab--active' : ''}`}
            onClick={() => setOnglet('agenda')}
          >
            📅 Agenda
          </button>
        </div>

        {/* ── Onglet Profils ── */}
        {onglet === 'profils' && (
          <>
            {/* Photo de famille */}
            <div className="profils-photo-section">
              <img src={photoAffichee} alt="Photo de famille" className="profils-photo-preview" />
              <div className="profils-photo-actions">
                <button className="profils-photo-btn" onClick={() => fileInputRef.current?.click()}>
                  📷 Changer la photo
                </button>
                {photoPreview && photoPreview !== `${import.meta.env.BASE_URL}family_photo.jpg` && (
                  <button className="profils-photo-btn profils-photo-btn--reset" onClick={() => {
                    setPhotoPreview(null);
                    onPhotoChange?.(null);
                  }}>
                    ↺ Photo par défaut
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoSelect}
                />
                {photoErreur && <span className="profils-photo-erreur">{photoErreur}</span>}
              </div>
            </div>

            <p className="profils-modal__intro">
              Ces préférences permettent de classer les activités selon les goûts de chacun.
            </p>

            <div className="profils-grille">
              {local.map((m, i) => (
                <CarteMembreEdit
                  key={m.prenom}
                  membre={m}
                  onChange={updated => handleChange(i, updated)}
                />
              ))}
            </div>

            <div className="profils-modal__actions">
              <button className="profils-btn profils-btn--annuler" onClick={onClose}>
                Annuler
              </button>
              <button className="profils-btn profils-btn--sauver" onClick={() => onSave(local)}>
                Sauvegarder
              </button>
            </div>
          </>
        )}

        {/* ── Onglet Agenda ── */}
        {onglet === 'agenda' && (
          <OngletAgenda
            agenda={agenda || { obligations: [], evenements: [] }}
            profils={profils}
            onSave={onSaveAgenda}
          />
        )}
      </div>
    </div>
  );
}
