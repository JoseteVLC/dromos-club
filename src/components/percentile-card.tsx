/**
 * Tu posición en un ranking. Con 10 o más atletas: «Top X %» y campana de Gauss con un punto donde estás.
 * Con menos: solo la posición, porque un porcentaje con 4 personas no dice nada.
 */
export const MIN_FOR_PERCENTILE = 10;

/** Inversa de la normal estándar (aprox. de Acklam), para colocar el punto en la campana. */
function invNorm(p: number) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function topPercent(rank: number, total: number) {
  return Math.max(1, Math.ceil((rank / total) * 100));
}

function BellCurve({ rank, total }: { rank: number; total: number }) {
  const W = 300;
  const H = 110;
  const base = 92;
  const span = 3.2; // de -3,2σ a +3,2σ
  const x = (z: number) => ((z + span) / (2 * span)) * W;
  const y = (z: number) => base - Math.exp((-z * z) / 2) * 78;
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const z = -span + (2 * span * i) / 120;
    pts.push(`${x(z).toFixed(1)},${y(z).toFixed(1)}`);
  }
  // Fracción de atletas por detrás de ti (a la izquierda)
  const behind = Math.min(0.995, Math.max(0.005, (total - rank + 0.5) / total));
  const zMe = Math.max(-span + 0.1, Math.min(span - 0.1, invNorm(behind)));
  const shade = pts.filter((p) => Number(p.split(",")[0]) <= x(zMe));
  const area = `M0,${base} L${shade.join(" L")} L${x(zMe).toFixed(1)},${base} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Top ${topPercent(rank, total)} %`}>
      <defs>
        <linearGradient id="pc-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.05" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <line x1={0} y1={base} x2={W} y2={base} stroke="currentColor" strokeOpacity={0.25} />
      <path d={area} fill="url(#pc-fill)" />
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={2} />
      <line x1={x(zMe)} y1={y(zMe)} x2={x(zMe)} y2={base} stroke="var(--accent)" strokeWidth={2} strokeDasharray="3 3" />
      <circle cx={x(zMe)} cy={y(zMe)} r={7} fill="var(--accent)" stroke="#000" strokeWidth={2.5} />
      <text x={6} y={H - 4} fontSize={10} fill="currentColor" opacity={0.5}>
        −
      </text>
      <text x={W - 6} y={H - 4} fontSize={10} textAnchor="end" fill="currentColor" opacity={0.5}>
        +
      </text>
    </svg>
  );
}

export function PercentileCard({ rank, total, labels }: { rank: number; total: number; labels: { pos: string; top: string; few: string } }) {
  if (total < MIN_FOR_PERCENTILE) {
    return (
      <div className="card flex items-center justify-between gap-3 p-4">
        <div className="h-display shrink-0 whitespace-nowrap text-3xl text-accent">
          {rank}º <span className="text-lg text-muted">/ {total}</span>
        </div>
        <p className="text-right text-xs text-muted">{labels.few}</p>
      </div>
    );
  }
  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-display text-4xl text-accent">Top {topPercent(rank, total)}%</div>
        <div className="text-sm text-muted">{labels.pos}</div>
      </div>
      <BellCurve rank={rank} total={total} />
      <p className="text-xs text-muted">{labels.top}</p>
    </div>
  );
}
