/** Reglas de los slugs de box (sirven en el proxy, en el servidor y en el navegador). */
export const BOX_COOKIE = "box";
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// Mismo listado que slug_reserved() en la base de datos (migración 013)
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "auth", "login", "logout", "invitacion", "inactivo", "ayuda", "boxes", "box",
  "nuevo", "nuevo-box", "d", "r", "wod", "coach", "ranking", "historial", "marcas", "medallas", "mensajes", "perfil", "atleta", "avisos",
  "mail", "email", "static", "assets", "cdn", "status", "blog", "help", "soporte", "dromos", "dromosclub", "demo", "test", "dev", "staging",
  "unirse", "cartel", "manual",
]);

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s) && !s.includes("--") && !RESERVED_SLUGS.has(s);
}

/** Convierte un nombre en un slug propuesto: «CrossFit Valencia» → «crossfit-valencia». */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/**
 * Dónde vive cada box. Hoy, en la ruta (/cfvalencia). Cuando haya dominio propio
 * (NEXT_PUBLIC_ROOT_DOMAIN=dromosclub.com), en el subdominio (cfvalencia.dromosclub.com).
 */
export function boxUrl(slug: string, origin = ""): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  return root ? `https://${slug}.${root}` : `${origin}/${slug}`;
}

/** El box que indica el host (subdominio del dominio raíz), si lo hay. */
export function slugFromHost(host: string | null | undefined): string | null {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root || !host) return null;
  const h = host.split(":")[0].toLowerCase();
  if (!h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -root.length - 1);
  return isValidSlug(sub) ? sub : null;
}
