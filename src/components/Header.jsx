export default function Header() {
  return (
    <header className="main-header">
      <div className="family-photo-container">
        <img
          src={`${import.meta.env.BASE_URL}family_photo.jpg`}
          alt="Portrait de famille"
          className="family-photo"
        />
        <div className="photo-caption">Famille · 2025</div>
      </div>
      <div className="header-content">
        <h1>Planning Hebdomadaire</h1>
        <p className="header-subtitle">Repas &nbsp;·&nbsp; Exercices &nbsp;·&nbsp; Activités &nbsp;·&nbsp; Musique</p>
      </div>
      <div className="header-ornament">Vol. 2025</div>
    </header>
  );
}
