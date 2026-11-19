/** Iconos de línea propios (heredan el color del texto). */
type P = { className?: string; size?: number };

/** Barra cargada: calculadora de discos. */
export function BarbellIcon({ className = "", size = 22 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M2 12h20" />
      <rect x="4.5" y="6" width="2.5" height="12" rx="0.8" />
      <rect x="7.5" y="8" width="1.8" height="8" rx="0.6" />
      <rect x="17" y="6" width="2.5" height="12" rx="0.8" />
      <rect x="14.7" y="8" width="1.8" height="8" rx="0.6" />
    </svg>
  );
}

/** Línea ascendente: progreso. */
export function TrendIcon({ className = "", size = 18 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

/** Flechas en círculo: WOD repetido. */
export function RepeatIcon({ className = "", size = 18 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M17 2l3 3-3 3" />
      <path d="M4 11V9a4 4 0 0 1 4-4h12" />
      <path d="M7 22l-3-3 3-3" />
      <path d="M20 13v2a4 4 0 0 1-4 4H4" />
    </svg>
  );
}
