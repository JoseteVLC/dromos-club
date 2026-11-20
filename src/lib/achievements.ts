import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDALS, type MedalProgress } from "./medals";
import { myTrainingDays } from "./streak-data";
import type { Benchmark, PersonalRecord } from "./marcas";
import { compareScore, rankResults } from "./scoring";
import type { Division, Gender, Result, ScoreType, Wod } from "./types";
import { adminDb, hasAdminKey } from "./supabase/admin";
import { sendPush } from "./push";
import { MEDAL_BY_CODE } from "./medals";
import { closeDay, inTime, isClosed } from "./closing";
import { addDays } from "./dates";

type MyResult = Result & { wods: Pick<Wod, "wod_date" | "title" | "score_type" | "score_label" | "is_benchmark" | "published"> };
type Row = { id: string; wod_id: string; user_id: string; division: Division; finished: boolean; time_seconds: number | null; rounds: number | null; reps: number | null; value: number | null; created_at: string | null; flag?: string | null; flag_reviewed?: boolean; profiles: { gender: Gender | null } | null };

const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Calcula el progreso de todas las medallas de un atleta (con su propia sesión). */
/** boxId: las medallas son de cada box (se filtra explícitamente, también con la clave de servidor). */
export async function computeMedals(supabase: SupabaseClient, userId: string, boxId: string): Promise<MedalProgress[]> {
  const [{ days, done, today }, myRes, { data: prData }, { data: benchData }, { data: me }] = await Promise.all([
    myTrainingDays(supabase, userId, boxId),
    (async () => {
      const out: MyResult[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from("results")
          .select("*, wods!inner(wod_date, title, score_type, score_label, is_benchmark, published)")
          .eq("user_id", userId)
          .eq("box_id", boxId)
          .order("id")
          .range(from, from + 999)
          .returns<MyResult[]>();
        out.push(...(data ?? []));
        if (!data || data.length < 1000) return out;
      }
    })(),
    supabase.from("personal_records").select("*").eq("user_id", userId).returns<PersonalRecord[]>(),
    supabase.from("benchmarks").select("*").returns<Benchmark[]>(),
    supabase.from("profiles").select("gender").eq("id", userId).maybeSingle<{ gender: Gender | null }>(),
  ]);
  const [{ data: myComments }, { data: myReactions }, { data: myCommentReactions }] = await Promise.all([
    supabase.from("result_comments").select("created_at").eq("user_id", userId).eq("box_id", boxId).order("created_at").limit(25),
    supabase.from("reactions").select("created_at").eq("user_id", userId).eq("box_id", boxId).order("created_at").limit(25),
    // Si la migración 011 aún no está, da error y cuenta como vacío
    supabase.from("comment_reactions").select("created_at").eq("user_id", userId).eq("box_id", boxId).order("created_at").limit(25),
  ]);

  const got = new Map<string, MedalProgress>();
  const set = (code: string, progress: number, unlockedOn: string | null) => got.set(code, { code, progress, unlockedOn });

  // --- Entrenos y rachas (días de plani con resultado) ---
  const doneSorted = [...done].sort();
  const nth = (n: number) => doneSorted[n - 1] ?? null;
  set("first", Math.min(doneSorted.length, 1), nth(1));
  set("total25", doneSorted.length, nth(25));
  set("total100", doneSorted.length, nth(100));
  set("total250", doneSorted.length, nth(250));
  set("total500", doneSorted.length, nth(500));

  let run = 0;
  let best = 0;
  let at6: string | null = null;
  let at30: string | null = null;
  for (const d of [...days].sort()) {
    if (done.has(d)) {
      run++;
      best = Math.max(best, run);
      if (run === 6 && !at6) at6 = d;
      if (run === 30 && !at30) at30 = d;
    } else if (d < today) {
      run = 0;
    }
  }
  set("week6", best, at6);
  set("streak30", best, at30);

  // Mes perfecto: WODs registrados (un día puede tener varias partes)
  const perMonth = new Map<string, number>();
  let month25: string | null = null;
  let bestMonth = 0;
  for (const d of myRes.map((r) => r.wods.wod_date).sort()) {
    const n = (perMonth.get(d.slice(0, 7)) ?? 0) + 1;
    perMonth.set(d.slice(0, 7), n);
    bestMonth = Math.max(bestMonth, n);
    if (n === 25 && !month25) month25 = d;
  }
  set("month25", bestMonth, month25);

  // --- PRs, Girls y Heroes (Mis marcas + WODs benchmark) ---
  const benchById = new Map((benchData ?? []).map((b) => [b.id, b]));
  const benchByName = new Map((benchData ?? []).map((b) => [norm(b.name), b]));
  type Ev = { key: string; type: ScoreType; date: string; rx: boolean; res: Result; cat: string | null; bench: string };
  const evs: Ev[] = [];
  for (const m of prData ?? []) {
    const b = benchById.get(m.benchmark_id);
    if (!b) continue;
    evs.push({ key: `${norm(b.name)}|${b.score_type}|${m.rm ?? 1}`, type: b.score_type, date: m.performed_on, rx: m.division === "rx", res: m as unknown as Result, cat: b.category, bench: norm(b.name) });
  }
  for (const r of myRes) {
    const cat = benchByName.get(norm(r.wods.title));
    if (!r.wods.is_benchmark && !cat) continue;
    evs.push({ key: `${norm(r.wods.title)}|${r.wods.score_type}|1`, type: r.wods.score_type, date: r.wods.wod_date, rx: r.division !== "scaled", res: r, cat: cat?.category ?? null, bench: norm(r.wods.title) });
  }
  evs.sort((a, b) => a.date.localeCompare(b.date));

  const bestByKey = new Map<string, Ev>();
  let prCount = 0;
  let pr1: string | null = null;
  let pr10: string | null = null;
  const girls = new Set<string>();
  let girls5: string | null = null;
  const heroes = new Set<string>();
  let hero5: string | null = null;
  let murph: string | null = null;
  let pr25: string | null = null;
  let club100: string | null = null;
  const benches = new Set<string>();
  let bench10: string | null = null;
  for (const e of evs) {
    if (!benches.has(e.bench)) {
      benches.add(e.bench);
      if (benches.size === 10 && !bench10) bench10 = e.date;
    }
    if (e.bench === "murph" && !murph) murph = e.date;
    // Club de los 100: snatch (cualquier variante salvo el snatch balance) de 100 kg o más
    if (/snatch/.test(e.bench) && !/balance/.test(e.bench) && e.type === "load" && Number(e.res.value ?? 0) >= 100 && !club100) club100 = e.date;
    if (e.cat === "girls" && !girls.has(e.bench)) {
      girls.add(e.bench);
      if (girls.size === 5 && !girls5) girls5 = e.date;
    }
    if (e.cat === "heroes" && !heroes.has(e.bench)) {
      heroes.add(e.bench);
      if (heroes.size === 5 && !hero5) hero5 = e.date;
    }
    if (!e.rx) continue;
    const prev = bestByKey.get(e.key);
    const better = !prev || compareScore(e.type, e.res, prev.res) < 0;
    if (better) {
      bestByKey.set(e.key, e);
      prCount++;
      if (prCount === 1) pr1 = e.date;
      if (prCount === 10) pr10 = e.date;
      if (prCount === 25) pr25 = e.date;
    }
  }
  set("pr1", Math.min(prCount, 1), pr1);
  set("pr10", prCount, pr10);
  set("girls5", girls.size, girls5);
  set("hero5", heroes.size, hero5);
  set("pr25", prCount, pr25);
  set("murph", murph ? 1 : 0, murph);
  set("club100", club100 ? 1 : 0, club100);
  set("bench10", benches.size, bench10);

  // --- Comunidad: comentarios y reacciones dados ---
  const social = [...(myComments ?? []), ...(myReactions ?? []), ...(myCommentReactions ?? [])].map((x) => String(x.created_at)).sort();
  set("social25", social.length, social[24]?.slice(0, 10) ?? null);

  // --- Podio y victorias (en tu división y género, con al menos 3 atletas) ---
  // Solo WODs ya cerrados (2 días de margen) y solo con los resultados metidos antes del cierre:
  // quien mete tarde sale en el ranking pero no gana ni quita medallas.
  const gender = me?.gender ?? null;
  const eligible = [...myRes]
    .filter((r) => r.division !== "scaled" && r.wods.published && isClosed(r.wods.wod_date) && inTime(r.wods.wod_date, r.created_at))
    .sort((a, b) => a.wods.wod_date.localeCompare(b.wods.wod_date));
  const byWod = new Map<string, Row[]>();
  const wodIds = [...new Set(eligible.map((r) => r.wod_id))];
  if (gender) {
    for (let i = 0; i < wodIds.length; i += 100) {
      const chunk = wodIds.slice(i, i + 100);
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from("results")
          .select("id, wod_id, user_id, division, finished, time_seconds, rounds, reps, value, created_at, flag, flag_reviewed, profiles!results_user_id_fkey(gender)")
          .in("wod_id", chunk)
          .eq("box_id", boxId)
          .order("id")
          .range(from, from + 999)
          .returns<Row[]>();
        for (const r of data ?? []) byWod.set(r.wod_id, [...(byWod.get(r.wod_id) ?? []), r]);
        if (!data || data.length < 1000) break;
      }
    }
  }
  let podium: string | null = null;
  let winner: string | null = null;
  let wins = 0;
  let winner5: string | null = null;
  for (const mine of eligible) {
    if (!gender) break;
    const date = mine.wods.wod_date;
    const rows = (byWod.get(mine.wod_id) ?? [])
      // Los que el detector ve imposibles no cuentan hasta que un coach los da por buenos
      .filter((r) => r.division === mine.division && r.profiles?.gender === gender && inTime(date, r.created_at) && (!r.flag || r.flag_reviewed))
      .map((r) => ({ ...r, profiles: { full_name: "", gender } }) as unknown as Result);
    if (rows.length < 3 || mine.wods.score_type === "check") continue;
    const ranked = rankResults({ score_type: mine.wods.score_type, score_label: mine.wods.score_label, score2_type: null, score2_label: null }, rows, { gender, division: mine.division });
    const pos = ranked.find((r) => r.user_id === userId)?.rank;
    const on = closeDay(date); // la medalla se gana al cerrar el WOD
    if (pos && pos <= 3 && !podium) podium = on;
    if (pos === 1) {
      wins++;
      if (!winner) winner = on;
      if (wins === 5) winner5 = on;
    }
  }
  set("podium", podium ? 1 : 0, podium);
  set("winner", winner ? 1 : 0, winner);
  set("winner5", wins, winner5);

  return MEDALS.map((m) => got.get(m.code) ?? { code: m.code, progress: 0, unlockedOn: null });
}

/**
 * Calcula y guarda las medallas nuevas. Las medallas no se pierden aunque luego se borre un resultado.
 * Devuelve las medallas guardadas del atleta (código → fecha).
 */
export async function syncMedals(supabase: SupabaseClient, userId: string, box: { id: string; slug: string }) {
  const progress = await computeMedals(supabase, userId, box.id);
  const { data: have } = await supabase.from("user_achievements").select("code, unlocked_on").eq("user_id", userId).eq("box_id", box.id);
  const owned = new Map((have ?? []).map((h) => [h.code as string, h.unlocked_on as string]));
  const fresh = progress.filter((p) => p.unlockedOn && !owned.has(p.code));
  if (fresh.length && hasAdminKey()) {
    await adminDb()
      .from("user_achievements")
      .upsert(fresh.map((p) => ({ box_id: box.id, user_id: userId, code: p.code, unlocked_on: p.unlockedOn })), { onConflict: "box_id,user_id,code", ignoreDuplicates: true });
    for (const p of fresh) owned.set(p.code, p.unlockedOn!);
    // Push solo por medallas recién ganadas (de los últimos 3 días), no por las de antes de existir el sistema
    const recent = fresh.filter((p) => p.unlockedOn! >= new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10));
    if (recent.length) {
      const first = MEDAL_BY_CODE.get(recent[0].code);
      await sendPush([userId], "medals", {
        title: recent.length === 1 ? `🏅 ¡Medalla desbloqueada: ${first?.name}!` : `🏅 ¡Has desbloqueado ${recent.length} medallas!`,
        body: recent.length === 1 ? (first?.desc ?? "") : recent.map((p) => MEDAL_BY_CODE.get(p.code)?.name).join(" · "),
        url: "/medallas",
        tag: "medal",
        box: box.slug,
      });
    }
  }
  return { progress, owned };
}

/**
 * Para el cron diario: reparte las medallas de competición de los WODs que acaban de cerrar
 * (los de hace 3 y 4 días, por si un día el cron no corre). Usa la clave de servidor.
 */
export async function syncMedalsForClosedWods(db: SupabaseClient, today: string) {
  const { data: wods } = await db
    .from("wods")
    .select("id, box_id, boxes!inner(slug)")
    .eq("published", true)
    .gte("wod_date", addDays(today, -4))
    .lte("wod_date", addDays(today, -3))
    .returns<{ id: string; box_id: string; boxes: { slug: string } }[]>();
  if (!wods?.length) return 0;
  const slugOf = new Map(wods.map((w) => [w.box_id, w.boxes.slug]));
  const { data: rows } = await db
    .from("results")
    .select("user_id, box_id")
    .in("wod_id", wods.map((w) => w.id))
    .neq("division", "scaled")
    .limit(5000)
    .returns<{ user_id: string; box_id: string }[]>();
  const pairs = [...new Set((rows ?? []).map((r) => `${r.box_id}|${r.user_id}`))];
  for (const p of pairs) {
    const [boxId, userId] = p.split("|");
    try {
      await syncMedals(db, userId, { id: boxId, slug: slugOf.get(boxId) ?? "" });
    } catch {
      // seguimos con el resto
    }
  }
  return pairs.length;
}
