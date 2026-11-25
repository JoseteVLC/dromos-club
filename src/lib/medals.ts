/** Catálogo de medallas (se puede importar desde cliente y servidor). */
export type MedalGroup = "constancia" | "volumen" | "prs" | "benchmarks" | "competicion" | "comunidad";

export type MedalDef = {
  code: string;
  name: string;
  desc: string;
  target: number;
  group: MedalGroup;
  /** Se puede ganar varias veces (sale ×N y sube de nivel a las 3, 5 y 10) */
  repeat?: boolean;
  /** Lleva premio físico del box (lo gestiona un admin) */
  reward?: boolean;
};

export const MEDAL_GROUPS: { value: MedalGroup; label: string }[] = [
  { value: "constancia", label: "Constancia" },
  { value: "volumen", label: "Entrenos" },
  { value: "prs", label: "Récords" },
  { value: "benchmarks", label: "Benchmarks" },
  { value: "competicion", label: "Competición" },
  { value: "comunidad", label: "Comunidad" },
];

export const MEDALS: MedalDef[] = [
  { code: "first", name: "Primer paso", desc: "Mete tu primer entreno", target: 1, group: "constancia" },
  { code: "week6", name: "Semana de fuego", desc: "6 días de plani seguidos: una semana completa", target: 6, group: "constancia", repeat: true },
  { code: "month25", name: "Mes perfecto", desc: "25 días entrenados en un mismo mes", target: 25, group: "constancia", repeat: true },
  { code: "streak30", name: "Imparable", desc: "30 días de plani seguidos sin fallar", target: 30, group: "constancia", reward: true, repeat: true },

  { code: "total25", name: "En marcha", desc: "25 entrenos registrados", target: 25, group: "volumen" },
  { code: "total100", name: "Centurión", desc: "100 entrenos registrados", target: 100, group: "volumen", reward: true },
  { code: "total250", name: "Leyenda", desc: "250 entrenos registrados", target: 250, group: "volumen", reward: true },
  { code: "total500", name: "Inmortal", desc: "500 entrenos registrados", target: 500, group: "volumen", reward: true },

  { code: "pr1", name: "Rompe-récords", desc: "Consigue tu primer PR", target: 1, group: "prs", repeat: true },
  { code: "pr10", name: "Coleccionista", desc: "Bate 10 PRs", target: 10, group: "prs" },
  { code: "pr25", name: "Cohete", desc: "Bate 25 PRs", target: 25, group: "prs" },
  { code: "club100", name: "Club de los 100", desc: "Snatch de 100 kg o más", target: 1, group: "prs" },

  { code: "girls5", name: "Las chicas", desc: "Completa 5 Girls distintas", target: 5, group: "benchmarks" },
  { code: "hero5", name: "Héroe", desc: "Completa 5 Hero WODs distintos", target: 5, group: "benchmarks" },
  { code: "murph", name: "Murph", desc: "Completa Murph", target: 1, group: "benchmarks" },
  { code: "bench10", name: "Explorador", desc: "Completa 10 benchmarks distintos", target: 10, group: "benchmarks" },

  { code: "podium", name: "Podio", desc: "Top 3 en un WOD de tu categoría (mín. 3 atletas)", target: 1, group: "competicion", repeat: true },
  { code: "winner", name: "Campeón", desc: "Gana un WOD de tu categoría (mín. 3 atletas)", target: 1, group: "competicion", repeat: true },
  { code: "winner5", name: "Dinastía", desc: "Gana 5 WODs de tu categoría", target: 5, group: "competicion" },

  { code: "social25", name: "Alma del box", desc: "Anima a la comunidad: 25 comentarios o reacciones", target: 25, group: "comunidad" },
];

export const MEDAL_BY_CODE = new Map(MEDALS.map((m) => [m.code, m]));
export const REWARD_CODES = MEDALS.filter((m) => m.reward).map((m) => m.code);

export type MedalProgress = { code: string; progress: number; unlockedOn: string | null; times: number };

/** Niveles de las medallas que se repiten: 1 vez → nivel 1; 3 → 2; 5 → 3; 10 → 4 (máximo). */
export const LEVEL_STEPS = [1, 3, 5, 10];
export const medalLevel = (times: number) => LEVEL_STEPS.filter((n) => times >= n).length;
export const nextLevelAt = (times: number) => LEVEL_STEPS.find((n) => n > times) ?? null;
