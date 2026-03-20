export default function Header() {
  return (
    <header className="main-header">
      <div className="family-photo-container">
        <img src="/family_photo.jpg" alt="Photo de famille" className="family-photo" />
        <div className="photo-caption">Famille 2025</div>
      </div>
      <div className="header-content">
        <h1>Planning Hebdomadaire Familial</h1>
        <p className="header-subtitle">Optimisation intelligente des repas, exercices et activités</p>
      </div>
    </header>
  );
}
