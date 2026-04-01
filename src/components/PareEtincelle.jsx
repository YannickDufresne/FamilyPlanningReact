// Silhouette SVG du pare-étincelle en éventail du condo Montcalm.
// Tracé à partir des photos de la famille — 7 sections, 4 anneaux concentriques,
// médaillons aux pointes, pivot central.

export default function PareEtincelle({ width = 200 }) {
  const h = Math.round(width * 215 / 420);

  // ── Géométrie ─────────────────────────────────────────────────────────────
  // Pivot : (210, 205) dans le repère viewBox "0 0 420 215"
  // 9 rayons (= 7 sections + les 2 bords horizontaux)
  // Angles depuis l'axe horizontal (degrés, repère trigonométrique) :
  //   0  25.71  51.43  77.14  90  102.86  128.57  154.29  180

  const R  = 195; // rayon extérieur
  const r1 = 152; // anneau 1  (~78 % R)
  const r2 = 109; // anneau 2  (~56 % R)
  const r3 = 66;  // anneau 3  (~34 % R)
  const cx = 210, cy = 205;

  const angles = [0, 25.71, 51.43, 77.14, 90, 102.86, 128.57, 154.29, 180];

  function pt(r, deg) {
    const rad = (deg * Math.PI) / 180;
    return [
      +(cx + r * Math.cos(rad)).toFixed(1),
      +(cy - r * Math.sin(rad)).toFixed(1),
    ];
  }

  const outerPts = angles.map(a => pt(R,  a));
  const ring1Pts = angles.map(a => pt(r1, a));
  const ring2Pts = angles.map(a => pt(r2, a));
  const ring3Pts = angles.map(a => pt(r3, a));

  function arcPath(r, a1, a2) {
    const [x1, y1] = pt(r, a1);
    const [x2, y2] = pt(r, a2);
    return `M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`;
  }

  return (
    <svg
      viewBox="0 0 420 215"
      width={width}
      height={h}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Lueur ambrée du feu — visible derrière la silhouette */}
        <radialGradient id="foyer-glow" cx="50%" cy="100%" r="65%">
          <stop offset="0%"   stopColor="#F5A623" stopOpacity="0.55"/>
          <stop offset="35%"  stopColor="#E8841A" stopOpacity="0.30"/>
          <stop offset="70%"  stopColor="#C0651A" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="#C0651A" stopOpacity="0"/>
        </radialGradient>
        {/* Masque en demi-cercle pour la lueur */}
        <clipPath id="fan-clip">
          <path d={`M${cx - R - 10},${cy} A${R + 10},${R + 10} 0 0,1 ${cx + R + 10},${cy} Z`}/>
        </clipPath>
      </defs>

      {/* Lueur ambrée */}
      <ellipse
        cx={cx} cy={cy}
        rx={R + 10} ry={R + 10}
        fill="url(#foyer-glow)"
        clipPath="url(#fan-clip)"
      />

      {/* ── Silhouette en vert forêt semi-transparent ─────────────────────── */}
      <g stroke="var(--forest)" fill="none" opacity="0.40">

        {/* Arc extérieur */}
        <path d={arcPath(R, 0, 180)} strokeWidth="2.8" strokeLinecap="round"/>

        {/* Bords horizontaux */}
        <line x1={cx} y1={cy} x2={outerPts[0][0]} y2={outerPts[0][1]} strokeWidth="2.8" strokeLinecap="round"/>
        <line x1={cx} y1={cy} x2={outerPts[8][0]} y2={outerPts[8][1]} strokeWidth="2.8" strokeLinecap="round"/>

        {/* Rayons intérieurs */}
        {angles.slice(1, 8).map((a, i) => {
          const [x, y] = outerPts[i + 1];
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} strokeWidth="1.6" strokeLinecap="round"/>;
        })}

        {/* Anneau 1 */}
        <path d={arcPath(r1, 0, 180)} strokeWidth="1.3"/>

        {/* Anneau 2 */}
        <path d={arcPath(r2, 0, 180)} strokeWidth="1.1"/>

        {/* Anneau 3 */}
        <path d={arcPath(r3, 0, 180)} strokeWidth="0.9"/>

        {/* Petits arcs en ogive dans chaque section (entre r1 et R) */}
        {angles.slice(0, 8).map((a1, i) => {
          const a2 = angles[i + 1];
          const aMid = (a1 + a2) / 2;
          const rOgive = r1 + (R - r1) * 0.45; // ~mi-chemin entre r1 et R
          const [px1] = pt(r1, a1);  // juste pour vérifier
          // Arc entre les deux pointes r1, passant par le milieu de la section
          const [sx, sy] = pt(r1, a1);
          const [ex, ey] = pt(r1, a2);
          // Rayon de l'arc-ogive : distance entre les deux points / 2 * facteur
          const dx = ex - sx, dy = ey - sy;
          const chord = Math.sqrt(dx*dx + dy*dy);
          const rArc = +(chord * 0.62).toFixed(1);
          return (
            <path
              key={i}
              d={`M${sx},${sy} A${rArc},${rArc} 0 0,1 ${ex},${ey}`}
              strokeWidth="0.9"
              opacity="0.7"
            />
          );
        })}

        {/* Médaillons aux pointes extérieures */}
        {outerPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="9.5" strokeWidth="2"/>
        ))}
        {outerPts.map(([x, y], i) => (
          <circle key={`in${i}`} cx={x} cy={y} r="4.5" strokeWidth="1.2"/>
        ))}

        {/* Ornements sur l'anneau 1 */}
        {ring1Pts.slice(1, 8).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" strokeWidth="1.4"/>
        ))}

        {/* Ornements sur l'anneau 2 */}
        {ring2Pts.slice(1, 8).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" strokeWidth="1.1"/>
        ))}

        {/* Ornements sur l'anneau 3 */}
        {ring3Pts.slice(1, 8).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" strokeWidth="1"/>
        ))}

        {/* Pivot central */}
        <circle cx={cx} cy={cy} r="14" strokeWidth="2.2"/>
        <circle cx={cx} cy={cy} r="7"  strokeWidth="1.4"/>
      </g>

      {/* Point central plein */}
      <circle cx={cx} cy={cy} r="4" fill="var(--forest)" opacity="0.40"/>
    </svg>
  );
}
