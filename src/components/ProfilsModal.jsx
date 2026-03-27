import { useState, useRef } from 'react';

function calculerAge(naissance) {
  if (!naissance) return null;
  const n = new Date(naissance + 'T12:00:00');
  const today = new Date();
  let age = today.getFullYear() - n.getFullYear();
  const dm = today.getMonth() - n.getMonth();
  if (dm < 0 || (dm === 0 && today.getDate() < n.getDate())) age--;
  return age;
}

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

export default function ProfilsModal({ profils, onSave, onClose, photoUrl, onPhotoChange }) {
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

        <h2 className="profils-modal__titre">Profils de la famille</h2>

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
      </div>
    </div>
  );
}
