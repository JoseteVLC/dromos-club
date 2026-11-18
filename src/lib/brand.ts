/**
 * Marca de la plataforma, en un solo sitio. Si cambia el nombre, se cambia aquí
 * (y los logos de public/brand). Los textos usan {app} y {appLong}, que se rellenan solos.
 */
export const BRAND = {
  /** Nombre corto: icono del móvil, notificaciones, textos */
  short: "Dromos",
  /** Nombre completo de la app */
  name: "Dromos Club",
  /** Dominio previsto (aún sin comprar) */
  domain: "dromosclub.com",
  email: "hola@dromosclub.com",
  /** Logo horizontal (símbolo + nombre) sobre fondo oscuro */
  logo: "/brand/logo.svg",
  /** Solo el símbolo */
  mark: "/brand/mark.svg",
  colors: { bg: "#0C0D10", card: "#16181D", line: "#2A2D34", fg: "#F2F1EC", muted: "#9A9CA3", accent: "#C8F135", accentFg: "#0C0D10", alert: "#FF5A36" },
} as const;
