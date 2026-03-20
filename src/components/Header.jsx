export default function Header() {
  return (
    <header className="main-header">
      <div className="family-photo-container">
        <img src="/family_photo.jpg" alt="Portrait de famille" className="family-photo" />
        <div className="photo-caption">Famille · 2025</div>
      </div>
      <div className="header-content">
        <h1>Planning Hebdomadaire</h1>
        <p className="header-subtitle">Repas · Exercices · Activités · Musique</p>
      </div>
      <div className="header-ornament">❧</div>
    </header>
  );
}
