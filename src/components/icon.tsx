import { useId } from "react";

/**
 * Iconos de la app: trazos de Lucide (licencia ISC) con degradado de color propio de cada icono y un brillo suave.
 * tile = dentro de una tarjeta oscura con relieve (cabeceras y secciones destacadas).
 */
const PATHS = {
  "wod": "<path d=\"M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z\" /> <path d=\"m2.5 21.5 1.4-1.4\" /> <path d=\"m20.1 3.9 1.4-1.4\" /> <path d=\"M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z\" /> <path d=\"m9.6 14.4 4.8-4.8\" />",
  "clipboard": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /> <path d=\"M12 11h4\" /> <path d=\"M12 16h4\" /> <path d=\"M8 11h.01\" /> <path d=\"M8 16h.01\" />",
  "flame": "<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\" />",
  "timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /> <line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /> <circle cx=\"12\" cy=\"14\" r=\"8\" />",
  "tip": "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\" /> <path d=\"M9 18h6\" /> <path d=\"M10 22h4\" />",
  "question": "<path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\" /> <path d=\"M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5\" /> <path d=\"M12 17h.01\" />",
  "mail": "<path d=\"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7\" /> <rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\" />",
  "bell": "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\" /> <path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\" />",
  "medal": "<path d=\"M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15\" /> <path d=\"M11 12 5.12 2.2\" /> <path d=\"m13 12 5.88-9.8\" /> <path d=\"M8 7h8\" /> <circle cx=\"12\" cy=\"17\" r=\"5\" /> <path d=\"M12 18v-2h-.5\" />",
  "trophy": "<path d=\"M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2\" /> <path d=\"M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2\" /> <path d=\"M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3\" /> <path d=\"M4 22h16\" /> <path d=\"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z\" /> <path d=\"M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3\" />",
  "chart": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /> <path d=\"M18 17V9\" /> <path d=\"M13 17V5\" /> <path d=\"M8 17v-3\" />",
  "alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /> <path d=\"M12 9v4\" /> <path d=\"M12 17h.01\" />",
  "repeat": "<path d=\"m2 9 3-3 3 3\" /> <path d=\"M13 18H7a2 2 0 0 1-2-2V6\" /> <path d=\"m22 15-3 3-3-3\" /> <path d=\"M11 6h6a2 2 0 0 1 2 2v10\" />",
  "trend": "<path d=\"M16 7h6v6\" /> <path d=\"m22 7-8.5 8.5-5-5L2 17\" />",
  "pin": "<path d=\"M12 17v5\" /> <path d=\"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z\" />",
  "camera": "<path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\" /> <circle cx=\"12\" cy=\"13\" r=\"3\" />",
  "gift": "<path d=\"M12 7v14\" /> <path d=\"M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\" /> <path d=\"M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5\" /> <rect x=\"3\" y=\"7\" width=\"18\" height=\"4\" rx=\"1\" />",
  "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />",
  "calendar": "<path d=\"M8 2v3\" /> <path d=\"M16 2v3\" /> <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /> <path d=\"M3 9h18\" /> <path d=\"M8 13h.01\" /> <path d=\"M12 13h.01\" /> <path d=\"M16 13h.01\" /> <path d=\"M8 17h.01\" /> <path d=\"M12 17h.01\" /> <path d=\"M16 17h.01\" />",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /> <path d=\"m15 5 4 4\" />",
  "plus": "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />",
  "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\" /> <circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "book": "<path d=\"M12 5v16\" /> <path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" />",
  "phone": "<rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\" /> <path d=\"M12 18h.01\" />",
  "mappin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\" /> <circle cx=\"12\" cy=\"10\" r=\"3\" />",
  "list": "<path d=\"M11 5h10\" /> <path d=\"M11 12h10\" /> <path d=\"M11 19h10\" /> <path d=\"M4 4h1v5\" /> <path d=\"M4 9h2\" /> <path d=\"M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02\" />",
  "comment": "<path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\" />",
  "flag": "<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\" />",
  "hourglass": "<path d=\"M5 22h14\" /> <path d=\"M5 2h14\" /> <path d=\"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22\" /> <path d=\"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2\" />",
  "help": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5\" /> <path d=\"M12 17h.01\" />",
  "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /> <circle cx=\"12\" cy=\"7\" r=\"4\" />",
  "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /> <path d=\"M16 3.128a4 4 0 0 1 0 7.744\" /> <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" /> <circle cx=\"9\" cy=\"7\" r=\"4\" />",
  "megaphone": "<path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\" /> <path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\" /> <path d=\"M8 6v8\" />",
  "dumbbell": "<path d=\"M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z\" /> <path d=\"m2.5 21.5 1.4-1.4\" /> <path d=\"m20.1 3.9 1.4-1.4\" /> <path d=\"M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z\" /> <path d=\"m9.6 14.4 4.8-4.8\" />",
  "weight": "<circle cx=\"12\" cy=\"5\" r=\"3\" /> <path d=\"M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z\" />",
  "shield": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" />",
  "heart": "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\" /> <path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\" />",
  "biceps": "<path d=\"M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1\" /> <path d=\"M15 14a5 5 0 0 0-7.584 2\" /> <path d=\"M9.964 6.825C8.019 7.977 9.5 13 8 15\" />",
  "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /> <path d=\"M20 2v4\" /> <path d=\"M22 4h-4\" /> <circle cx=\"4\" cy=\"20\" r=\"2\" />",
  "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />",
  "person": "<circle cx=\"12\" cy=\"5\" r=\"1\" /> <path d=\"m9 20 3-6 3 6\" /> <path d=\"m6 8 6 2 6-2\" /> <path d=\"M12 10v4\" />",
  "plates": "<rect x=\"1\" y=\"16\" width=\"22\" height=\"1.8\" rx=\"0.9\"/><rect x=\"3\" y=\"12\" width=\"2.6\" height=\"10\" rx=\"0.9\"/><rect x=\"18.4\" y=\"12\" width=\"2.6\" height=\"10\" rx=\"0.9\"/><path d=\"M9.5 10l5-7\"/><circle cx=\"9.7\" cy=\"4\" r=\"1.5\"/><circle cx=\"14.3\" cy=\"9\" r=\"1.5\"/>"
} as const;

export type IconName = keyof typeof PATHS;

const COLORS: Record<IconName, string[]> = {"wod": ["#ffd35a", "#ff8a2a", "#ff3d2e"], "clipboard": ["#8be9ff", "#22b8cf"], "flame": ["#ffd35a", "#ff8a2a", "#ff3d2e"], "timer": ["#ffffff", "#b8bcc6"], "tip": ["#fff3a3", "#ffcf3f", "#f59e0b"], "question": ["#7cc4ff", "#3b82f6"], "mail": ["#8be9ff", "#22b8cf"], "bell": ["#ffe58a", "#f5b301"], "medal": ["#fff0a8", "#f4c430", "#c98a00"], "trophy": ["#fff0a8", "#f4c430", "#c98a00"], "chart": ["#9cf27a", "#22c55e"], "alert": ["#ffd27a", "#ff8a1f"], "repeat": ["#9cf27a", "#22c55e"], "trend": ["#9cf27a", "#22c55e"], "pin": ["#ff7b6b", "#e0302a"], "camera": ["#d6b4ff", "#8b5cf6"], "gift": ["#ffa3bf", "#f43f5e"], "lock": ["#ffffff", "#b8bcc6"], "calendar": ["#ffffff", "#b8bcc6"], "pencil": ["#ffffff", "#b8bcc6"], "plus": ["#9cf27a", "#22c55e"], "eye": ["#ffffff", "#b8bcc6"], "book": ["#7cc4ff", "#3b82f6"], "phone": ["#8be9ff", "#22b8cf"], "mappin": ["#ff7b6b", "#e0302a"], "list": ["#d6b4ff", "#8b5cf6"], "comment": ["#7cc4ff", "#3b82f6"], "flag": ["#9cf27a", "#22c55e"], "hourglass": ["#ffd27a", "#ff8a1f"], "help": ["#7cc4ff", "#3b82f6"], "user": ["#d6b4ff", "#8b5cf6"], "users": ["#d6b4ff", "#8b5cf6"], "megaphone": ["#ff7b6b", "#e0302a"], "dumbbell": ["#ffffff", "#b8bcc6"], "weight": ["#fff0a8", "#f4c430", "#c98a00"], "shield": ["#7cc4ff", "#3b82f6"], "heart": ["#ffa3bf", "#f43f5e"], "biceps": ["#ffd35a", "#ff8a2a", "#ff3d2e"], "sparkles": ["#d6b4ff", "#8b5cf6"], "activity": ["#ffa3bf", "#f43f5e"], "person": ["#8be9ff", "#22b8cf"], "plates": ["#ff7b6b", "#e0302a"]};

/** Iconos con forma cerrada: llevan además un relleno suave */
const FILLED = new Set<IconName>(["alert", "bell", "book", "calendar", "comment", "flag", "flame", "gift", "heart", "lock", "mail", "mappin", "medal", "megaphone", "phone", "pin", "plates", "question", "shield", "trophy"] as IconName[]);

export function Icon({
  name,
  size = 18,
  tile = false,
  mono = false,
  className = "",
}: {
  name: IconName;
  size?: number;
  tile?: boolean;
  /** Sin color: un solo tono (el del texto), p. ej. pestañas inactivas */
  mono?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  if (mono)
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={`inline-block shrink-0 ${className}`}>
        <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
      </svg>
    );
  const cols = COLORS[name];
  const glow = cols[Math.floor(cols.length / 2)];
  const solid = name === "plates";
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={tile ? "" : `inline-block shrink-0 align-[-0.15em] ${className}`}
      style={{ filter: `drop-shadow(0 0 ${Math.max(2, size / 5)}px ${glow}55)` }}
    >
      <defs>
        <linearGradient id={`g${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="22">
          {cols.map((c, i) => (
            <stop key={i} offset={cols.length === 1 ? 0 : i / (cols.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <g
        fill={`url(#g${id})`}
        fillOpacity={solid ? 1 : FILLED.has(name) ? 0.22 : 0}
        stroke={`url(#g${id})`}
        strokeWidth={solid ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: PATHS[name] }}
      />
      {solid && <path d="M9.5 10l5-7" stroke={`url(#g${id})`} strokeWidth={1.8} strokeLinecap="round" />}
    </svg>
  );
  if (!tile) return svg;
  const box = Math.round(size * 1.9);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border border-white/[0.07] ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.29),
        background: "linear-gradient(160deg,#24262c,#131418)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 6px 16px rgba(0,0,0,.45)",
      }}
    >
      {svg}
    </span>
  );
}
