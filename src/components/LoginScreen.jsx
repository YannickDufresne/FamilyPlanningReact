import { useState } from 'react';

// Mot de passe encodé — pas de sécurité absolue côté client, mais suffisant
// pour décourager les visiteurs non invités.
const HASH = 'UEBtcGxlbW91c3NlMjAxMiE='; // btoa('P@mplemousse2012!')

export default function LoginScreen({ onSuccess }) {
  const [valeur, setValeur] = useState('');
  const [erreur, setErreur] = useState(false);
  const [secoue, setSecoue]  = useState(false);

  function verifier(e) {
    e.preventDefault();
    if (btoa(valeur) === HASH) {
      localStorage.setItem('fp_auth', HASH);
      onSuccess();
    } else {
      setErreur(true);
      setSecoue(true);
      setValeur('');
      setTimeout(() => setSecoue(false), 600);
    }
  }

  return (
    <div className="login-overlay">
      <div className={`login-card${secoue ? ' login-shake' : ''}`}>
        {/* Photo / logo */}
        <div className="login-avatar">🌿</div>

        <h1 className="login-titre">Planning familial</h1>
        <p className="login-sous-titre">Espace privé — accès réservé à la famille</p>

        <form onSubmit={verifier} className="login-form">
          <input
            type="password"
            className={`login-input${erreur ? ' login-input--erreur' : ''}`}
            placeholder="Mot de passe"
            value={valeur}
            autoFocus
            onChange={e => { setValeur(e.target.value); setErreur(false); }}
          />
          {erreur && (
            <p className="login-erreur">Mot de passe incorrect</p>
          )}
          <button type="submit" className="login-btn">
            Entrer
          </button>
        </form>
      </div>
    </div>
  );
}
