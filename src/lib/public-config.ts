/**
 * Datos públicos del proyecto (no son secretos: acaban en el navegador igualmente).
 * Las variables de entorno mandan si existen; si no, se usan estos valores.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://mcibyzvnjptzkymjcuqc.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_GnfPSiXjVBfpuApj4DE7-w_kv159hvR";
