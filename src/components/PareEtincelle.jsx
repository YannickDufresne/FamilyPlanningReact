// Silhouette SVG du pare-étincelle en éventail — Condo Montcalm
// Redessiné pour ressembler clairement à un écran paon classique :
//  • 7 pétales fermées (côtés droits + arc en haut + arc en bas)
//  • Double médaillons proéminents aux 9 pointes
//  • 3 anneaux concentriques avec ornements aux intersections
//  • Moyeu central triple
//  • Lueur ambrée évoquant la lumière du feu derrière l'écran

export default function PareEtincelle({ width = 220 }) {
  const VW = 440, VH = 228;
  const cx = 220, cy = 218; // pivot (bas-centre)
  const R  = 200;  // rayon extérieur
  const r1 = 157;  // anneau 1
  const r2 = 110;  // anneau 2
  const r3 = 64;   // anneau 3 (base des pétales)
  const h  = Math.round(width * VH / VW);

  // 9 rayons = 7 sections + 2 bords horizontaux
  // Angles depuis l'axe horizontal droit, sens trigo (°)
  const ANGLES = [0, 25.71, 51.43, 77.14, 90, 102.86, 128.57, 154.29, 180];

  function pt(r, deg) {
    const rad = (deg * Math.PI) / 180;
    return [
      +(cx + r * Math.cos(rad)).toFixed(2),
      +(cy - r * Math.sin(rad)).toFixed(2),
    ];
  }

  function arcStr(r, a1, a2, sweep = 1) {
    const [x1, y1] = pt(r, a1);
    const [x2, y2] = pt(r, a2);
    return `M${x1},${y1} A${r},${r} 0 0,${sweep} ${x2},${y2}`;
  }

  const outerTips = ANGLES.map(a => pt(R,  a));
  const ring1Pts  = ANGLES.map(a => pt(r1, a));
  const ring2Pts  = ANGLES.map(a => pt(r2, a));

  // ── Pétales fermées ──────────────────────────────────────────────────────────
  // Chaque pétale : ligne r3→r1 (gauche), arc r1 (haut), ligne r1→r3 (droite),
  // arc r3 (bas, sens inverse) → forme de lame d'éventail
  const petalPaths = [];
  for (let i = 0; i < 8; i++) {
    const [a1, a2]     = [ANGLES[i], ANGLES[i + 1]];
    const [bL, bR]     = [pt(r3, a1), pt(r3, a2)];
    const [tL, tR]     = [pt(r1, a1), pt(r1, a2)];
    petalPaths.push(
      `M${bL[0]},${bL[1]}` +
      ` L${tL[0]},${tL[1]}` +
      ` A${r1},${r1} 0 0,1 ${tR[0]},${tR[1]}` +
      ` L${bR[0]},${bR[1]}` +
      ` A${r3},${r3} 0 0,0 ${bL[0]},${bL[1]} Z`
    );
  }

  // ── Petits arcs intra-pétale (entre r1 et R, crée l'effet dentelle) ─────────
  const lacePaths = [];
  for (let i = 0; i < 8; i++) {
    const [a1, a2] = [ANGLES[i], ANGLES[i + 1]];
    const aMid     = (a1 + a2) / 2;
    const [iL, iR] = [pt(r1, a1), pt(r1, a2)];
    // Arc intérieur secondaire à ~85 % de R
    const rLace    = Math.round(R * 0.85);
    const [lL, lR] = [pt(rLace, a1), pt(rLace, a2)];
    lacePaths.push(`M${lL[0]},${lL[1]} A${rLace},${rLace} 0 0,1 ${lR[0]},${lR[1]}`);
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={width}
      height={h}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Lueur ambrée du feu — gradient radial depuis le pivot */}
        <radialGradient id="pe-fire" cx="50%" cy="100%" r="62%">
          <stop offset="0%"   stopColor="#F5A623" stopOpacity="0.75"/>
          <stop offset="35%"  stopColor="#E07818" stopOpacity="0.35"/>
          <stop offset="70%"  stopColor="#C05010" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="#C05010" stopOpacity="0"/>
        </radialGradient>
        {/* Clip : demi-cercle supérieur = zone du foyer */}
        <clipPath id="pe-fan-clip">
          <path d={
            `M${pt(R + 22, 0)[0]},${cy}` +
            ` A${R + 22},${R + 22} 0 0,1 ${pt(R + 22, 180)[0]},${cy} Z`
          }/>
        </clipPath>
      </defs>

      {/* ── Lueur ambrée ── */}
      <ellipse
        cx={cx} cy={cy}
        rx={R + 22} ry={R + 22}
        fill="url(#pe-fire)"
        clipPath="url(#pe-fan-clip)"
      />

      {/* ── Silhouette principale ── */}
      <g stroke="var(--forest)" fill="none" strokeLinecap="round" opacity="0.42">

        {/* Arc extérieur */}
        <path d={arcStr(R, 0, 180)} strokeWidth="3.2"/>

        {/* Ligne de base */}
        <line
          x1={outerTips[0][0]} y1={cy}
          x2={outerTips[8][0]} y2={cy}
          strokeWidth="2.8"
        />

        {/* Rayons (spokes) */}
        {outerTips.map(([x, y], i) => (
          <line
            key={i}
            x1={cx} y1={cy} x2={x} y2={y}
            strokeWidth={i === 0 || i === 8 ? 2.8 : 2.0}
          />
        ))}

        {/* Anneau 1 */}
        <path d={arcStr(r1, 0, 180)} strokeWidth="1.6"/>

        {/* Anneau 2 */}
        <path d={arcStr(r2, 0, 180)} strokeWidth="1.3"/>

        {/* Anneau 3 */}
        <path d={arcStr(r3, 0, 180)} strokeWidth="1.0"/>

        {/* Pétales fermées */}
        {petalPaths.map((d, i) => (
          <path key={i} d={d} strokeWidth="1.0" opacity="0.75"/>
        ))}

        {/* Arcs dentelle (entre r1 et R) */}
        {lacePaths.map((d, i) => (
          <path key={i} d={d} strokeWidth="0.8" opacity="0.55"/>
        ))}

        {/* ── Grands médaillons doubles aux 9 pointes ── */}
        {outerTips.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="14"  strokeWidth="2.4"/>
            <circle cx={x} cy={y} r="7.5" strokeWidth="1.6"/>
          </g>
        ))}

        {/* ── Ornements sur anneau 1 (aux intersections avec spokes) ── */}
        {ring1Pts.slice(1, 8).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="6.5" strokeWidth="1.7"/>
        ))}

        {/* ── Ornements sur anneau 2 ── */}
        {ring2Pts.slice(1, 8).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4.2" strokeWidth="1.3"/>
        ))}

        {/* ── Moyeu central triple ── */}
        <circle cx={cx} cy={cy} r="22" strokeWidth="2.6"/>
        <circle cx={cx} cy={cy} r="13" strokeWidth="1.9"/>
        <circle cx={cx} cy={cy} r="6"  strokeWidth="1.3"/>
      </g>

      {/* Points pleins : médaillons + moyeu */}
      {outerTips.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill="var(--forest)" opacity="0.42"/>
      ))}
      <circle cx={cx} cy={cy} r="4" fill="var(--forest)" opacity="0.42"/>
    </svg>
  );
}
