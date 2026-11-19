import { formatTime } from "@/lib/scoring";
import { TrendIcon } from "./icons";

export type ProgressPoint = { date: string; v: number; label: string };

/**
 * Evolución de una marca en el tiempo (SVG, sin librerías). Cada punto es un intento;
 * los que mejoran la mejor marca hasta ese día (PR) van rellenos y unidos por la línea de mejora.
 * En tiempos, menos es mejor: el eje va al revés para que subir sea mejorar.
 */
export function ProgressChart({
  points,
  lowerIsBetter,
  locale,
  title,
  prLabel,
}: {
  points: ProgressPoint[];
  lowerIsBetter: boolean;
  locale: string;
  title: string;
  prLabel: string;
}) {
  const pts = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const W = 320;
  const H = 150;
  const PAD = { l: 8, r: 8, t: 18, b: 22 };
  const t0 = Date.parse(pts[0].date);
  const t1 = Date.parse(pts.at(-1)!.date);
  const span = Math.max(1, t1 - t0);
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => {
    const f = (v - lo) / (hi - lo);
    return PAD.t + (lowerIsBetter ? f : 1 - f) * (H - PAD.t - PAD.b);
  };

  // PRs: cada vez que mejora la mejor marca hasta ese día
  const isPR = pts.map((p, i) => {
    const before = pts.slice(0, i).map((q) => q.v);
    return !before.length || (lowerIsBetter ? p.v < Math.min(...before) : p.v > Math.max(...before));
  });
  const prPts = pts.filter((_, i) => isPR[i]);
  // Línea escalonada de la mejor marca, hasta el último intento
  let step = "";
  prPts.forEach((p, i) => {
    step += `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)} `;
    const next = prPts[i + 1];
    step += `L${(next ? x(next.date) : x(pts.at(-1)!.date)).toFixed(1)},${y(p.v).toFixed(1)} `;
  });
  const fmtD = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
  const first = pts[0];
  const last = pts.at(-1)!;
  const top = prPts.at(-1)!;
  const gain = lowerIsBetter ? first.v - top.v : top.v - first.v;

  return (
    <section className="card space-y-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><TrendIcon className="text-accent" /> {title}</h2>
        {gain > 0 && (
          <span className="text-xs font-semibold text-accent">
            {lowerIsBetter ? `−${formatTime(Math.round(gain))}` : `+${Math.round(gain * 10) / 10}`}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} className="stroke-line" strokeWidth="1" />
        <polyline
          points={pts.map((p) => `${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
          fill="none"
          className="stroke-muted/40"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <path d={step} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle
            key={p.date + i}
            cx={x(p.date)}
            cy={y(p.v)}
            r={isPR[i] ? 4.5 : 3}
            className={isPR[i] ? "fill-accent" : "fill-card stroke-muted"}
            strokeWidth={isPR[i] ? 0 : 1.5}
          >
            <title>{`${p.date} · ${p.label}${isPR[i] ? ` · ${prLabel}` : ""}`}</title>
          </circle>
        ))}
        <text x={x(top.date)} y={y(top.v) - 8} textAnchor={x(top.date) > W - 60 ? "end" : x(top.date) < 60 ? "start" : "middle"} className="fill-accent text-[11px] font-semibold">
          {top.label}
        </text>
        <text x={PAD.l} y={H - 6} className="fill-muted text-[10px]">{fmtD(first.date)}</text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-muted text-[10px]">{fmtD(last.date)}</text>
      </svg>
    </section>
  );
}
