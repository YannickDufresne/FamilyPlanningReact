// Silhouette SVG du pare-étincelle en éventail du condo Montcal
// Tracé à partir des photos du foyer blanc de la famille.
// Pivot en bas-centre, 7 sections, médaillons aux pointes.

export default function PareEtincelle({ width = 160, opacity = 0.28 }) {
  const h = Math.round(width * 210 / 400);

  // Pivot : (200, 200) dans le repère du viewBox "0 0 400 210"
  // Rayon extérieur  R  = 185
  // Rayon anneau 1   r1 = 115
  // Rayon anneau 2   r2 = 58
  //
  // 8 rayons (= 7 sections) à 0°, 25.7°, 51.4°, 77.1°, 90°, 102.9°, 128.6°, 154.3°, 180°
  // (mesurés depuis l'axe horizontal droit, sens trigo)

  const outerTips = [
    [385, 200], [367, 120], [316, 55], [241, 20], [200, 15],
    [159, 20],  [84,  55],  [33, 120], [15,  200],
  ];

  const ring1 = [
    [310, 200], [299, 152], [269, 114], [225, 93], [200, 90],
    [175,  93], [131, 114], [101, 152], [90,  200],
  ];

  const ring2 = [
    [258, 200], [250, 176], [234, 157], [212, 147], [200, 145],
    [188, 147], [166, 157], [150, 176], [142, 200],
  ];

  return (
    <svg
      viewBox="0 0 400 210"
      width={width}
      height={h}
      aria-hidden="true"
      style={{ color: 'var(--forest)', opacity, display: 'block' }}
    >
      {/* ── Rayon horizontal gauche et droit ── */}
      <line x1="200" y1="200" x2="15"  y2="200" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="200" y1="200" x2="385" y2="200" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>

      {/* ── 7 rayons intérieurs ── */}
      {outerTips.slice(1, -1).map(([x, y], i) => (
        <line
          key={i}
          x1="200" y1="200" x2={x} y2={y}
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
        />
      ))}

      {/* ── Arc extérieur ── */}
      <path
        d="M15,200 A185,185 0 0,1 385,200"
        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      />

      {/* ── Anneau intermédiaire 1 ── */}
      <path
        d="M90,200 A110,110 0 0,1 310,200"
        fill="none" stroke="currentColor" strokeWidth="1.2"
      />

      {/* ── Anneau intermédiaire 2 ── */}
      <path
        d="M142,200 A58,58 0 0,1 258,200"
        fill="none" stroke="currentColor" strokeWidth="1"
      />

      {/* ── Médaillons aux pointes (extérieur) ── */}
      {outerTips.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      ))}

      {/* ── Petits ornements anneau 1 ── */}
      {ring1.slice(1, -1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4"/>
      ))}

      {/* ── Petits ornements anneau 2 ── */}
      {ring2.slice(1, -1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      ))}

      {/* ── Pivot central ── */}
      <circle cx="200" cy="200" r="13" fill="none" stroke="currentColor" strokeWidth="2.2"/>
      <circle cx="200" cy="200" r="5"  fill="currentColor"/>

      {/* ── Petite base ── */}
      <path
        d="M188,200 Q200,207 212,200"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  );
}
