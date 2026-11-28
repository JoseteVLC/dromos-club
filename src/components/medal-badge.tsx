import type { ReactNode } from "react";
import { medalLevel, type MedalDef } from "@/lib/medals";
import { Icon } from "@/components/icon";

/**
 * Medallas dibujadas en SVG: cada una con su forma, sus colores y un icono que cuenta lo que significa.
 * Bloqueadas: en gris, apagadas y con candado.
 */

type Shape = "circle" | "hex" | "shield" | "seal" | "pentagon" | "octagon";
type Art = { shape: Shape; c1: string; c2: string; field: string; icon: ReactNode; ribbon?: string };

const INK = "#fff7ec";
const S = { fill: "none", stroke: INK, strokeWidth: 3.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function poly(n: number, r: number, rot = -90, cx = 50, cy = 50) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}
function seal(points: number, r1: number, r2: number) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? r2 : r1;
    const a = ((-90 + (180 / points) * i) * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}
function shapeEl(shape: Shape, r: number, props: Record<string, string | number>) {
  switch (shape) {
    case "circle":
      return <circle cx={50} cy={50} r={r} {...props} />;
    case "hex":
      return <polygon points={poly(6, r + 2, -90)} {...props} />;
    case "pentagon":
      return <polygon points={poly(5, r + 3, -90)} {...props} />;
    case "octagon":
      return <polygon points={poly(8, r + 1.5, -67.5)} {...props} />;
    case "seal":
      return <polygon points={seal(16, r + 1.5, r - 2.5)} {...props} />;
    case "shield": {
      const k = r / 46;
      const d = `M50 ${50 - 46 * k} L${50 + 40 * k} ${50 - 34 * k} L${50 + 38 * k} ${50 + 6 * k} Q${50 + 32 * k} ${50 + 34 * k} 50 ${50 + 47 * k} Q${50 - 32 * k} ${50 + 34 * k} ${50 - 38 * k} ${50 + 6 * k} L${50 - 40 * k} ${50 - 34 * k} Z`;
      return <path d={d} {...props} />;
    }
  }
}

const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const rr = i % 2 ? r * 0.42 : r;
    const a = ((-90 + 36 * i) * Math.PI) / 180;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

const ART: Record<string, Art> = {
  // ---------- Constancia ----------
  first: {
    shape: "circle", c1: "#5eead4", c2: "#0f766e", field: "#063a36",
    icon: (
      <g>
        <path d="M40 66 L40 27" {...S} />
        <path d="M40 28 L64 33 L40 44 Z" fill={INK} />
        <path d="M30 66 L70 66" {...S} />
        <path d="M58 66 l4 -6 l4 6" {...S} strokeWidth={2.4} />
      </g>
    ),
    ribbon: "START",
  },
  week6: {
    shape: "hex", c1: "#fdba74", c2: "#dc2626", field: "#3b0a06",
    icon: (
      <g>
        <path d="M50 24 C59 35 65 42 63 54 C61 64 55 68 50 68 C42 68 36 62 37 53 C38 46 43 43 44 36 C47 40 48 44 52 46 C54 39 53 31 50 24Z" fill={INK} />
        <path d="M50 46 C54 51 57 55 56 60 C55 64 52 66 50 66 C46 66 44 63 44 60 C44 56 47 54 48 51 C49 53 50 54 51 54 C51 51 51 48 50 46Z" fill="#dc2626" />
      </g>
    ),
    ribbon: "6 DÍAS",
  },
  month25: {
    shape: "octagon", c1: "#93c5fd", c2: "#1d4ed8", field: "#0b1d4a",
    icon: (
      <g>
        <rect x={31} y={32} width={38} height={34} rx={5} {...S} />
        <path d="M31 42 L69 42" {...S} />
        <path d="M40 27 L40 36 M60 27 L60 36" {...S} />
        <path d="M41 54 L48 60 L60 48" {...S} strokeWidth={4} />
      </g>
    ),
    ribbon: "25 / MES",
  },
  streak30: {
    shape: "shield", c1: "#c4b5fd", c2: "#6d28d9", field: "#1e0b45",
    icon: <polygon points="55,22 37,50 48,50 43,72 64,42 52,42 59,22" fill={INK} />,
    ribbon: "60 DÍAS",
  },
  weeks26: {
    shape: "shield", c1: "#93c5fd", c2: "#1d4ed8", field: "#071a45",
    icon: <polygon points="55,22 37,50 48,50 43,72 64,42 52,42 59,22" fill={INK} />,
    ribbon: "26 SEM",
  },

  // ---------- Entrenos ----------
  total25: {
    shape: "circle", c1: "#86efac", c2: "#15803d", field: "#06301a",
    icon: (
      <g>
        <path d="M41 42 C41 30 59 30 59 42" {...S} strokeWidth={4.5} />
        <circle cx={50} cy={55} r={14} fill={INK} />
        <rect x={44} y={51} width={12} height={4} rx={2} fill="#15803d" />
      </g>
    ),
    ribbon: "50",
  },
  total100: {
    shape: "shield", c1: "#fca5a5", c2: "#991b1b", field: "#2f0707",
    icon: (
      <g>
        <path d="M33 31 C37 13 63 13 67 31 C61 25 39 25 33 31Z" fill="#fca5a5" />
        <path d="M31 68 L31 46 C31 33 39 27 50 27 C61 27 69 33 69 46 L69 68 L57 68 L57 62 L43 62 L43 68 Z" fill={INK} />
        <path d="M37 43 L63 43 L63 50 L54 50 L54 62 L46 62 L46 50 L37 50 Z" fill="#2f0707" />
      </g>
    ),
    ribbon: "100",
  },
  total250: {
    shape: "seal", c1: "#fde68a", c2: "#b45309", field: "#3a1d03",
    icon: (
      <g>
        <polygon points="32,62 30,36 41,47 50,29 59,47 70,36 68,62" fill={INK} />
        <rect x={32} y={64} width={36} height={5} rx={2} fill={INK} />
        <circle cx={50} cy={53} r={3.2} fill="#b45309" />
      </g>
    ),
    ribbon: "250",
  },
  total500: {
    shape: "pentagon", c1: "#f0abfc", c2: "#86198f", field: "#2b0630",
    icon: (
      <g>
        <path d="M50 49 C44 38 30 38 30 49 C30 60 44 60 50 49 C56 38 70 38 70 49 C70 60 56 60 50 49Z" {...S} strokeWidth={4.5} />
        <path d="M50 22 C54 28 55 31 54 34 C53 37 51 38 50 38 C48 38 46 36 46 34 C46 31 48 30 49 27Z" fill={INK} />
      </g>
    ),
    ribbon: "500",
  },
  total1000: {
    shape: "pentagon", c1: "#fef08a", c2: "#a16207", field: "#2a1a02",
    icon: (
      <g>
        <path d="M50 49 C44 38 30 38 30 49 C30 60 44 60 50 49 C56 38 70 38 70 49 C70 60 56 60 50 49Z" {...S} strokeWidth={4.5} />
        <path d="M50 22 C54 28 55 31 54 34 C53 37 51 38 50 38 C48 38 46 36 46 34 C46 31 48 30 49 27Z" fill={INK} />
      </g>
    ),
    ribbon: "1000",
  },

  // ---------- Récords ----------
  pr1: {
    shape: "circle", c1: "#fda4af", c2: "#be123c", field: "#3a0614",
    icon: (
      <g>
        <circle cx={47} cy={53} r={17} {...S} />
        <circle cx={47} cy={53} r={10} {...S} />
        <circle cx={47} cy={53} r={3.5} fill={INK} />
        <path d="M48 52 L68 32" {...S} />
        <path d="M62 30 L70 30 L70 38" {...S} />
      </g>
    ),
    ribbon: "PR",
  },
  pr10: {
    shape: "hex", c1: "#67e8f9", c2: "#0e7490", field: "#052f38",
    icon: (
      <g>
        <polygon points="33,42 41,30 59,30 67,42 50,68" fill={INK} />
        <path d="M33 42 L67 42 M41 30 L46 42 L50 68 L54 42 L59 30" fill="none" stroke="#0e7490" strokeWidth={2} strokeLinejoin="round" />
      </g>
    ),
    ribbon: "25 PRs",
  },
  pr25: {
    shape: "octagon", c1: "#fdba74", c2: "#c2410c", field: "#3a1203",
    icon: (
      <g transform="rotate(35 50 50)">
        <path d="M50 22 C58 30 60 42 58 56 L42 56 C40 42 42 30 50 22Z" fill={INK} />
        <circle cx={50} cy={40} r={4.5} fill="#c2410c" />
        <path d="M42 48 L35 60 L42 58 Z M58 48 L65 60 L58 58 Z" fill={INK} />
        <path d="M46 60 L50 72 L54 60 Z" fill="#fdba74" />
      </g>
    ),
    ribbon: "50 PRs",
  },
  pr100: {
    shape: "octagon", c1: "#f9a8d4", c2: "#be185d", field: "#3a0620",
    icon: (
      <g transform="rotate(35 50 50)">
        <path d="M50 22 C58 30 60 42 58 56 L42 56 C40 42 42 30 50 22Z" fill={INK} />
        <circle cx={50} cy={40} r={4.5} fill="#be185d" />
        <path d="M42 48 L35 60 L42 58 Z M58 48 L65 60 L58 58 Z" fill={INK} />
        <path d="M46 60 L50 72 L54 60 Z" fill="#f9a8d4" />
      </g>
    ),
    ribbon: "100 PRs",
  },
  club100: {
    shape: "seal", c1: "#d4d4d8", c2: "#3f3f46", field: "#111113",
    icon: (
      <g>
        <path d="M26 50 L74 50" {...S} strokeWidth={4} />
        <rect x={31} y={36} width={7} height={28} rx={2} fill={INK} />
        <rect x={39} y={40} width={5} height={20} rx={2} fill={INK} />
        <rect x={62} y={36} width={7} height={28} rx={2} fill={INK} />
        <rect x={56} y={40} width={5} height={20} rx={2} fill={INK} />
      </g>
    ),
    ribbon: "SNATCH",
  },

  // ---------- Benchmarks ----------
  girls5: {
    shape: "pentagon", c1: "#f9a8d4", c2: "#be185d", field: "#3a0620",
    icon: (
      <g>
        <polygon points={star(50, 47, 16)} fill={INK} />
        {[[30, 63], [40, 68], [50, 70], [60, 68], [70, 63]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y - 2} r={2.6} fill={INK} />
        ))}
      </g>
    ),
    ribbon: "GIRLS",
  },
  hero5: {
    shape: "shield", c1: "#bef264", c2: "#3f6212", field: "#16210a",
    icon: (
      <g>
        <polygon points={star(50, 42, 15)} fill={INK} />
        <path d="M36 58 L50 64 L64 58 M36 65 L50 71 L64 65" {...S} />
      </g>
    ),
    ribbon: "10 HEROES",
  },
  murph: {
    shape: "hex", c1: "#a8a29e", c2: "#1c1917", field: "#0c0a09",
    icon: (
      <g>
        <path d="M38 28 L44 28 C45 34 55 34 56 28 L62 28 L66 36 L66 68 L34 68 L34 36 Z" fill={INK} />
        <rect x={38} y={44} width={24} height={6} rx={1.5} fill="#44403c" />
        <rect x={38} y={54} width={24} height={6} rx={1.5} fill="#44403c" />
      </g>
    ),
    ribbon: "MURPH",
  },
  bench10: {
    shape: "circle", c1: "#99f6e4", c2: "#0f766e", field: "#042f2c",
    icon: (
      <g>
        <circle cx={50} cy={50} r={19} {...S} />
        <polygon points="50,33 55,50 50,67 45,50" fill={INK} />
        <polygon points="50,33 55,50 45,50" fill="#f87171" />
        <circle cx={50} cy={50} r={2.5} fill="#0f766e" />
      </g>
    ),
    ribbon: "25",
  },

  // ---------- Competición ----------
  podium: {
    shape: "octagon", c1: "#e7e5e4", c2: "#78716c", field: "#1c1917",
    icon: (
      <g>
        <rect x={42} y={36} width={16} height={32} rx={1.5} fill={INK} />
        <rect x={27} y={46} width={15} height={22} rx={1.5} fill={INK} opacity={0.85} />
        <rect x={58} y={52} width={15} height={16} rx={1.5} fill={INK} opacity={0.7} />
        <text x={50} y={49} textAnchor="middle" fontSize={11} fontWeight={800} fill="#44403c">1</text>
        <text x={34.5} y={58} textAnchor="middle" fontSize={9} fontWeight={800} fill="#44403c">2</text>
        <text x={65.5} y={63} textAnchor="middle" fontSize={8} fontWeight={800} fill="#44403c">3</text>
      </g>
    ),
    ribbon: "TOP 3",
  },
  winner: {
    shape: "seal", c1: "#fde047", c2: "#a16207", field: "#2e1d02",
    icon: (
      <g>
        <path d="M37 28 L63 28 L63 38 C63 50 57 56 50 56 C43 56 37 50 37 38 Z" fill={INK} />
        <path d="M37 32 C27 32 27 46 39 46 M63 32 C73 32 73 46 61 46" {...S} strokeWidth={3} />
        <path d="M50 56 L50 63" {...S} strokeWidth={4} />
        <rect x={40} y={63} width={20} height={6} rx={1.5} fill={INK} />
      </g>
    ),
    ribbon: "#1",
  },
  winner5: {
    shape: "circle", c1: "#fef08a", c2: "#854d0e", field: "#2a1803",
    icon: (
      <g>
        {[125, 150, 175, 200, 225, 55, 30, 5, -20, -45].map((ang) => {
          const r = (ang * Math.PI) / 180;
          const x = 50 + 23 * Math.cos(r);
          const y = 50 + 23 * Math.sin(r);
          return <ellipse key={ang} cx={x} cy={y} rx={3.2} ry={7} transform={`rotate(${ang} ${x} ${y})`} fill={INK} />;
        })}
        <polygon points="41,47 40,36 46,41 50,32 54,41 60,36 59,47" fill={INK} />
        <text x={50} y={63} textAnchor="middle" fontSize={13} fontWeight={900} fill={INK}>×5</text>
      </g>
    ),
    ribbon: "DINASTÍA",
  },

  // ---------- Comunidad ----------
  social25: {
    shape: "hex", c1: "#fb923c", c2: "#ff542f", field: "#3a0f05",
    icon: (
      <g>
        <path d="M50 66 C36 56 30 49 30 41 C30 34 35 30 41 30 C45 30 48 32 50 36 C52 32 55 30 59 30 C65 30 70 34 70 41 C70 49 64 56 50 66Z" fill={INK} />
        <path d="M24 30 L28 33 M76 30 L72 33 M50 20 L50 25" {...S} strokeWidth={2.6} />
      </g>
    ),
    ribbon: "50",
  },
};

/**
 * times: veces conseguida (medallas que se repiten). Desde 2 sale «×N» arriba a la derecha y la medalla evoluciona:
 * nivel 2 (×3) aro, nivel 3 (×5) aro y brillo, nivel 4 (×10) aro, brillo que late y corona.
 */
export function MedalBadge({ medal, unlocked, size = 76, times = 0 }: { medal: MedalDef; unlocked: boolean; size?: number; times?: number }) {
  const a = ART[medal.code] ?? ART.first;
  const id = `m-${medal.code}`;
  const level = unlocked ? medalLevel(times) : 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {level >= 2 && (
        <div
          aria-hidden
          className={`pointer-events-none absolute rounded-full ${level >= 4 ? "animate-pulse" : ""}`}
          style={{
            inset: -size * 0.06,
            border: `${Math.max(2, size * 0.035)}px solid ${a.c1}`,
            boxShadow: level >= 3 ? `0 0 ${size * 0.18}px ${a.c1}aa, inset 0 0 ${size * 0.08}px ${a.c2}88` : undefined,
          }}
        />
      )}
      {level >= 4 && (
        <svg aria-hidden viewBox="0 0 24 16" width={size * 0.34} className="absolute left-1/2 z-10 -translate-x-1/2" style={{ top: -size * 0.2 }}>
          <path d="M2 14 L4 4 L8.5 9 L12 2 L15.5 9 L20 4 L22 14 Z" fill={a.c2} stroke={a.c1} strokeWidth={1.4} strokeLinejoin="round" />
        </svg>
      )}
      {unlocked && times > 1 && (
        <span
          className="absolute z-10 rounded-full px-1.5 font-display font-bold tabular-nums leading-tight text-black shadow"
          style={{ top: -size * 0.04, right: -size * 0.06, background: a.c2, fontSize: Math.max(11, size * 0.15), border: `2px solid ${a.c1}` }}
        >
          ×{times}
        </span>
      )}
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={medal.name}
        style={{
          filter: unlocked ? `drop-shadow(0 2px 8px ${a.c1}55)` : "grayscale(1) brightness(.55)",
          opacity: unlocked ? 1 : 0.55,
        }}
      >
        <defs>
          <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={a.c1} />
            <stop offset="0.5" stopColor={a.c2} />
            <stop offset="1" stopColor={a.c1} />
          </linearGradient>
          <radialGradient id={`${id}-field`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor={a.c2} />
            <stop offset="1" stopColor={a.field} />
          </radialGradient>
          <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {shapeEl(a.shape, 46, { fill: `url(#${id}-rim)` })}
        {shapeEl(a.shape, 40, { fill: `url(#${id}-field)` })}
        {shapeEl(a.shape, 36.5, { fill: "none", stroke: a.c1, strokeOpacity: 0.45, strokeWidth: 1 })}
        <g transform="translate(0 -3)">{a.icon}</g>
        {shapeEl(a.shape, 40, { fill: `url(#${id}-shine)` })}
        {a.ribbon && (
          <g>
            <path d="M22 78 L78 78 L74 84 L78 90 L22 90 L26 84 Z" fill={a.c2} stroke={a.c1} strokeWidth={1.2} />
            <text x={50} y={87.2} textAnchor="middle" fontSize={a.ribbon.length > 6 ? 7.5 : 9} fontWeight={800} letterSpacing={0.6} fill={INK}>
              {a.ribbon}
            </text>
          </g>
        )}
      </svg>
      {!unlocked && <span className="absolute -bottom-0.5 -right-0.5 rounded-full border border-line bg-card px-1 text-[11px]"><Icon name="lock" size={11} /></span>}
      {unlocked && medal.reward && <span className="absolute -right-1 -top-1"><Icon name="gift" size={15} /></span>}
    </div>
  );
}
