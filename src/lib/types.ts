export type ScoreType =
  | "for_time"
  | "amrap"
  | "load"
  | "reps"
  | "calories"
  | "distance"
  | "emom";

export type Division = "elite" | "rx" | "scaled";
export type Gender = "M" | "F";

export type Profile = {
  id: string;
  full_name: string;
  gender: Gender | null;
  role: "athlete" | "coach";
  is_admin?: boolean;
  active?: boolean;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  birth_date?: string | null;
  division?: Division | null;
  avatar_url?: string | null;
  created_at?: string;
  messages_seen_at?: string | null;
  bio?: string | null;
  instagram?: string | null;
  show_box?: boolean;
  show_age?: boolean;
  // Privados (solo el propio atleta, vía my_private_profile)
  box?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  shirt_size?: string | null;
};

export type Wod = {
  id: string;
  wod_date: string;
  title: string;
  description: string;
  score_type: ScoreType;
  time_cap_seconds: number | null;
  score_label: string | null;
  published: boolean;
  part: string;
  is_benchmark: boolean;
  /** Nombre del score principal (opcional; útil cuando hay segundo score) */
  score_name?: string | null;
  /** Segundo score opcional: siempre numérico, más es mejor */
  score2_type?: Score2Type | null;
  score2_name?: string | null;
  score2_label?: string | null;
};

export type Score2Type = "load" | "reps" | "calories" | "distance";
export const SCORE2_TYPES: Score2Type[] = ["load", "reps", "calories", "distance"];

export type Result = {
  id: string;
  wod_id: string;
  user_id: string;
  division: Division;
  finished: boolean;
  time_seconds: number | null;
  rounds: number | null;
  reps: number | null;
  value: number | null;
  value2?: number | null;
  notes: string | null;
  created_at?: string | null;
  /** Motivo si el detector lo ve imposible (solo lo usan los coaches) */
  flag?: string | null;
  flag_reviewed?: boolean;
  profiles?: Pick<Profile, "full_name" | "gender"> & { avatar_url?: string | null } | null;
};

export const SCORE_TYPES: Record<
  ScoreType,
  { label: string; help: string; unit?: string }
> = {
  for_time: { label: "For Time", help: "Menor tiempo gana. Si no acaba en el time cap, cuentan las reps." },
  amrap: { label: "AMRAP", help: "Rondas + reps. Más es mejor." },
  load: { label: "Carga (kg)", help: "Más kilos gana.", unit: "kg" },
  reps: { label: "Repeticiones", help: "Más reps gana.", unit: "reps" },
  calories: { label: "Calorías", help: "Más calorías gana.", unit: "cal" },
  distance: { label: "Distancia (m)", help: "Más metros gana.", unit: "m" },
  emom: { label: "EMOM", help: "Reps o rondas totales completadas. Más es mejor.", unit: "reps" },
};

export const DIVISIONS: { value: Division; label: string }[] = [
  { value: "elite", label: "Elite" },
  { value: "rx", label: "RX" },
  { value: "scaled", label: "Escalado" },
];
/** Solo Elite y RX tienen ranking; los escalados salen aparte, sin posición. */
export const RANKED_DIVISIONS = DIVISIONS.filter((d) => d.value !== "scaled");

export type Box = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  accent: string | null;
  rewards_enabled: boolean;
  status: "trial" | "active" | "paused";
  join_code: string;
  join_mode: "approval" | "open";
};
