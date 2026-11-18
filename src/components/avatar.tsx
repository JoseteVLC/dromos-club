/** Foto del atleta en pequeño; si no tiene, sus iniciales sobre un color fijo según el nombre. */
const COLORS = ["#ff5a36", "#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ec4899", "#14b8a6", "#64748b"];

export function Avatar({ name, url, size = 32, className = "" }: { name?: string | null; url?: string | null; size?: number; className?: string }) {
  const n = (name || "?").trim();
  const initials = n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const color = COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const style = { width: size, height: size, minWidth: size };
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} loading="lazy" className={`rounded-full object-cover ${className}`} style={style} />;
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ ...style, background: color, fontSize: Math.max(10, size * 0.38) }}
    >
      {initials}
    </span>
  );
}
