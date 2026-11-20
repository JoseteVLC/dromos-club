"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncMedals } from "@/lib/achievements";
import { adminIds, allActiveIds, sendPush, staffIds } from "@/lib/push";
import { wodsFromPhotos } from "@/lib/photo-wods";
import { checkCandidate, checkPersonalRecord } from "@/lib/plausibility";
import { makeTip, tipFor } from "@/lib/ai-tips";
import { makeWarmup } from "@/lib/warmup";
import { hasAi } from "@/lib/ai";
import { COMMENT_EMOJIS } from "@/lib/comment-reactions";
import { BOX_COOKIE, boxUrl, isValidSlug } from "@/lib/box-shared";
import { redirect } from "next/navigation";
import { createClient, isCoachProfile, memberSince, requireAdmin, requireCoach, requireUser } from "@/lib/supabase/server";
import { adminDb, hasAdminKey } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";
import { inviteEmail, sendEmail } from "@/lib/email";
import { randomBytes } from "node:crypto";
import { formatScore, parseTime } from "@/lib/scoring";
import { dayHref, isISODate } from "@/lib/dates";
import { DIVISIONS, detectDivisions, wodDivisions, SCORE2_TYPES, SCORE_TYPES, type Division, type Result, type Score2Type, type ScoreType, type Wod } from "@/lib/types";
import { BRAND } from "@/lib/brand";
import { getI18n } from "@/lib/i18n/server";

/** Los textos van en español: el cliente los traduce (FormMessage) con `vars` para las partes variables. */
export type ActionState = { error?: string; ok?: string; vars?: Record<string, string | number>; confirm?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

// ---------------- AUTH ----------------

function authError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con ese email. Entra con tu contraseña.";
  if (m.includes("password should be at least") || m.includes("weak password")) return "La contraseña es demasiado corta (mínimo 6 caracteres).";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "El email no es válido.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  if (m.includes("email not confirmed")) return "Tienes que confirmar tu email antes de entrar (revisa tu correo).";
  return msg;
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email"),
    password: str(fd, "password"),
  });
  if (error) {
    const t = authError(error.message);
    return { error: t === error.message ? "Email o contraseña incorrectos." : t };
  }
  redirect(safeNext(str(fd, "next")));
}

/** Solo rutas internas (evita redirecciones a otros dominios). */
function safeNext(next: string): "/" {
  return (next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/") as "/";
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const first_name = str(fd, "first_name");
  const last_name = str(fd, "last_name");
  const gender = str(fd, "gender");
  const division = str(fd, "division");
  const birth = str(fd, "birth_date");
  if (!first_name) return { error: "Pon tu nombre." };
  if (gender !== "M" && gender !== "F") return { error: "Elige categoría (chico/chica)." };
  if (birth && (!isISODate(birth) || birth > new Date().toISOString().slice(0, 10) || birth < "1920-01-01"))
    return { error: "Fecha de nacimiento no válida." };
  const opt = (k: string, max: number) => str(fd, k).slice(0, max) || null;
  const insta = str(fd, "instagram").replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  if (insta && !/^[A-Za-z0-9._]{1,30}$/.test(insta)) return { error: "Usuario de Instagram no válido." };
  const size = str(fd, "shirt_size");
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name,
      last_name,
      full_name: `${first_name} ${last_name}`.trim(),
      gender,
      division: ["elite", "rx", "scaled"].includes(division) ? division : null,
      bio: opt("bio", 200),
      instagram: insta || null,
      show_box: fd.get("show_box") === "on",
      show_age: fd.get("show_age") === "on",
      phone: opt("phone", 30),
      birth_date: birth || null,
      box: opt("box", 80),
      address_line: opt("address_line", 200),
      postal_code: opt("postal_code", 12),
      city: opt("city", 80),
      country: opt("country", 60),
      shirt_size: ["XS", "S", "M", "L", "XL", "XXL"].includes(size) ? size : null,
    })
    .eq("id", user.id);
  if (error) return { error: "No se pudieron guardar los datos." };
  revalidatePath("/", "layout");
  return { ok: "Datos guardados." };
}

/** Foto de perfil: llega ya recortada y reducida desde el navegador (JPEG cuadrado pequeño). */
export async function uploadAvatar(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const file = fd.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una foto." };
  if (file.size > 1024 * 1024) return { error: "La foto es demasiado grande." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { error: "Formato no válido (JPG, PNG o WebP)." };
  const db = adminDb();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await db.storage.from("avatars").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (upErr) return { error: "No se pudo subir la foto." };
  // Borramos las fotos anteriores
  const { data: old } = await db.storage.from("avatars").list(user.id);
  const stale = (old ?? []).map((o) => `${user.id}/${o.name}`).filter((p) => p !== path);
  if (stale.length) await db.storage.from("avatars").remove(stale);
  const url = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: "Foto actualizada." };
}

export async function removeAvatar() {
  const { supabase, user } = await requireUser();
  const db = adminDb();
  const { data: old } = await db.storage.from("avatars").list(user.id);
  if (old?.length) await db.storage.from("avatars").remove(old.map((o) => `${user.id}/${o.name}`));
  await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  revalidatePath("/", "layout");
}

/** Admin: marcar como entregado (o no) el premio de una medalla. */
export async function setRewardDelivered(fd: FormData) {
  const { box } = await requireAdmin();
  const delivered = str(fd, "delivered") === "1";
  await adminDb()
    .from("user_achievements")
    .update({ delivered_at: delivered ? new Date().toISOString() : null })
    .eq("box_id", box.id)
    .eq("user_id", str(fd, "user_id"))
    .eq("code", str(fd, "code"));
  revalidatePath("/admin");
}

/** Revisa medallas en segundo plano, después de responder al atleta. */
function checkMedalsLater(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string, box: { id: string; slug: string }) {
  after(async () => {
    try {
      await syncMedals(supabase, userId, box);
    } catch {
      // Las medallas se recalculan también al abrir el perfil
    }
  });
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const password = str(fd, "password");
  if (password.length < 6) return { error: "Mínimo 6 caracteres." };
  if (password !== str(fd, "password2")) return { error: "Las contraseñas no coinciden." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authError(error.message) };
  return { ok: "Contraseña cambiada." };
}

// ---------------- RESULTADOS ----------------

export async function saveResult(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, box } = await requireUser();
  const wodId = str(fd, "wod_id");
  const division = str(fd, "division") as Division;
  if (!["elite", "rx", "scaled"].includes(division)) return { error: "Elige Elite, RX o Escalado." };

  const { data: wod } = await supabase
    .from("wods")
    .select("*")
    .eq("id", wodId)
    .single<Pick<Wod, "score_type" | "time_cap_seconds" | "score2_type" | "wod_date" | "divisions" | "title" | "score_label">>();
  if (!wod) return { error: "WOD no encontrado." };
  if (!wodDivisions(wod).includes(division)) return { error: "Este WOD no tiene esa categoría." };
  const since = memberSince((await requireUser()).profile);
  if (since && wod.wod_date < since) return { error: "Este WOD es anterior a tu alta: no puedes meter resultado." };

  const row = {
    wod_id: wodId,
    user_id: user.id,
    division,
    finished: true,
    time_seconds: null as number | null,
    rounds: null as number | null,
    reps: null as number | null,
    value: null as number | null,
    value2: undefined as number | undefined,
    notes: str(fd, "notes") || null,
    updated_at: new Date().toISOString(),
  };

  // Escalado: el resultado es lo que cuentas en las notas (sin score ni ranking)
  if (division === "scaled") {
    if (!row.notes) return { error: "Cuenta en las notas qué has hecho." };
  } else switch (wod.score_type as ScoreType) {
    case "for_time": {
      row.finished = str(fd, "finished") !== "no";
      if (row.finished) {
        const mins = int(fd, "time_min") ?? 0;
        const secs = int(fd, "time_sec") ?? 0;
        if (Number.isNaN(mins) || Number.isNaN(secs) || secs > 59)
          return { error: "Tiempo no válido: minutos y segundos (0–59)." };
        const t = mins * 60 + secs;
        if (t <= 0) return { error: "Mete tu tiempo (minutos y segundos)." };
        if (wod.time_cap_seconds && t > wod.time_cap_seconds)
          return { error: "Ese tiempo supera el time cap. Marca «No acabé» y mete las reps." };
        row.time_seconds = t;
      } else {
        const r = int(fd, "reps");
        if (r == null || Number.isNaN(r)) return { error: "Mete las reps que hiciste." };
        row.reps = r;
      }
      break;
    }
    case "pace": {
      const mins = int(fd, "pace_min") ?? 0;
      const secs = int(fd, "pace_sec") ?? 0;
      if (Number.isNaN(mins) || Number.isNaN(secs) || secs > 59) return { error: "Ritmo no válido: minutos y segundos (0–59)." };
      const p = mins * 60 + secs;
      if (p <= 0) return { error: "Mete tu ritmo medio (minutos y segundos por km)." };
      row.time_seconds = p;
      break;
    }
    case "check":
      break;
    case "amrap": {
      const rounds = int(fd, "rounds");
      const reps = int(fd, "reps") ?? 0;
      if (rounds == null || Number.isNaN(rounds) || Number.isNaN(reps))
        return { error: "Mete rondas y reps (números enteros)." };
      row.rounds = rounds;
      row.reps = reps;
      break;
    }
    default: {
      const v = Number(str(fd, "value").replace(",", "."));
      if (!str(fd, "value") || !Number.isFinite(v) || v < 0)
        return { error: "Mete un número válido ({type}).", vars: { type: SCORE_TYPES[wod.score_type as ScoreType].label } };
      row.value = v;
    }
  }

  // Segundo score (opcional para el atleta)
  if (wod.score2_type) {
    row.value2 = undefined;
    const raw = division !== "scaled" ? str(fd, "value2") : "";
    if (raw) {
      const v2 = Number(raw.replace(",", "."));
      if (!Number.isFinite(v2) || v2 < 0) return { error: "El segundo score no es un número válido." };
      row.value2 = v2;
    } else {
      (row as { value2?: number | null }).value2 = null;
    }
  }

  // Si el resultado parece imposible, se lo preguntamos a quien lo mete antes de guardarlo
  const i18n = await getI18n();
  const check = hasAdminKey() ? await checkCandidate(adminDb(), wodId, user.id, { ...row, id: "" } as unknown as Result, i18n.t, i18n.locale).catch(() => null) : null;
  if (check && str(fd, "confirm") !== "1") return { confirm: check.reason };

  const { error } = await supabase.from("results").upsert(row, { onConflict: "wod_id,user_id" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  checkMedalsLater(supabase, user.id, box);
  // Si confirma algo imposible sin discusión (p. ej. por encima del récord mundial), queda para que lo mire el coach
  // y no cuenta para medallas hasta entonces. Si lo ha corregido, se borra el aviso anterior.
  if (hasAdminKey())
    after(async () => {
      await adminDb()
        .from("results")
        .update({ flag: check?.hard ? `El atleta confirma: ${check.reasonEs}` : null, flag_reviewed: false })
        .eq("wod_id", wodId)
        .eq("user_id", user.id);
      if (check?.hard) {
        const who = (await adminDb().from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string }>()).data?.full_name || "Un atleta";
        await sendPush(await adminIds(box.id), "messages", {
          title: `⚠️ ${who} ha confirmado un resultado imposible`,
          body: `${wod.title}: ${formatScore(wod, row as unknown as Result)}. Revísalo en Coach.`,
          url: "/coach",
          tag: `flag-r-${wodId}-${user.id}`, box: box.slug,
        });
      }
    });
  return { ok: "¡Resultado guardado!" };
}

/** Partes «Hecho» (calentamiento, técnica…): marcar o desmarcar de un toque desde el día completo. */
export async function toggleDone(fd: FormData) {
  const { supabase, user, profile, box } = await requireUser();
  const wodId = str(fd, "wod_id");
  const { data: wod } = await supabase.from("wods").select("*").eq("id", wodId).maybeSingle<Wod>();
  if (!wod || wod.score_type !== "check") return;
  const since = memberSince(profile);
  if (since && wod.wod_date < since) return;
  const { data: had } = await supabase.from("results").select("id").eq("wod_id", wodId).eq("user_id", user.id).maybeSingle();
  if (had) await supabase.from("results").delete().eq("id", had.id);
  else {
    const allowed: Division[] = wodDivisions(wod).filter((d) => d !== "scaled");
    const division = allowed.includes(profile?.division as Division) ? (profile!.division as Division) : (allowed[0] ?? "rx");
    await supabase.from("results").upsert(
      { wod_id: wodId, user_id: user.id, division, finished: true, updated_at: new Date().toISOString() },
      { onConflict: "wod_id,user_id" },
    );
    checkMedalsLater(supabase, user.id, box);
  }
  revalidatePath("/", "layout");
  const back = str(fd, "back");
  if (back.startsWith("/")) redirect(back);
}

export async function deleteResult(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("results").delete().eq("id", str(fd, "id"));
  revalidatePath("/", "layout");
  const back = str(fd, "back");
  if (back.startsWith("/")) redirect(back);
}

/** Consejo de peso y escalado para el WOD (se guarda: la segunda vez no vuelve a gastar). */
export async function getAiTip(wodId: string): Promise<{ body?: string; error?: string }> {
  const { supabase, user, box } = await requireUser();
  if (!hasAdminKey() || !hasAi()) return { error: "El consejo no está disponible ahora mismo." };
  const db = adminDb();
  const { locale } = await getI18n();
  const { data: cached } = await db.from("ai_tips").select("body").eq("wod_id", wodId).eq("user_id", user.id).maybeSingle<{ body: string }>();
  // Se guarda con el idioma delante («[en] …»): si cambias el idioma de la app, se prepara de nuevo
  const hit = cached && tipFor(cached.body, locale);
  if (hit) return { body: hit };
  const { count } = await db.from("ai_tips").select("wod_id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 864e5).toISOString());
  if ((count ?? 0) >= 15) return { error: "Has pedido muchos consejos hoy. Vuelve mañana." };
  // Con el cliente del atleta: si no puede ver el WOD (otro box, borrador), no hay consejo
  const { data: wod } = await supabase.from("wods").select("*").eq("id", wodId).maybeSingle<Wod>();
  if (!wod) return { error: "WOD no encontrado." };
  const body = await makeTip(db, wod, user.id, box.id, locale);
  if (!body) return { error: "No hemos podido preparar el consejo. Prueba en un momento." };
  await db.from("ai_tips").upsert({ box_id: box.id, wod_id: wodId, user_id: user.id, body: `[${locale}] ${body}` });
  return { body };
}

/** El coach da por bueno un resultado que el detector había marcado. */
export async function markResultOk(fd: FormData) {
  const { box } = await requireCoach();
  await adminDb().from("results").update({ flag_reviewed: true }).eq("id", str(fd, "id")).eq("box_id", box.id);
  revalidatePath("/", "layout");
}

// ---------------- WODS (coach) ----------------

function wodFromForm(fd: FormData) {
  const score_type = str(fd, "score_type") as ScoreType;
  const capRaw = str(fd, "time_cap");
  const time_cap_seconds = score_type === "for_time" && capRaw ? parseTime(capRaw) : null;
  return {
    title: str(fd, "title"),
    wod_date: str(fd, "wod_date"),
    description: String(fd.get("description") ?? ""),
    score_type,
    time_cap_seconds,
    score_label: str(fd, "score_label") || null,
    ...score2FromForm(fd),
    published: fd.get("published") === "on",
    part: (str(fd, "part") || "A").toUpperCase().slice(0, 3),
    is_benchmark: fd.get("is_benchmark") === "on",
    divisions: DIVISIONS.map((d) => d.value).filter((v) => fd.getAll("divisions").includes(v)),
    capRaw,
  };
}

function score2FromForm(fd: FormData) {
  const t = str(fd, "score2_type");
  const score2_type = (SCORE2_TYPES as string[]).includes(t) ? (t as Score2Type) : null;
  // Si no hay segundo score no se mandan las columnas (funciona aunque falte la migración 005)
  if (!score2_type) return {};
  return {
    score_name: str(fd, "score_name") || null,
    score2_type,
    score2_name: str(fd, "score2_name") || null,
    score2_label: str(fd, "score2_label") || null,
  };
}

function validateWod(w: ReturnType<typeof wodFromForm>): string | null {
  if (!w.title) return "Pon un título al WOD.";
  if (!w.wod_date) return "Pon la fecha.";
  if (!(w.score_type in SCORE_TYPES)) return "Elige el tipo de resultado.";
  if (!w.divisions.some((d) => d !== "scaled")) return "Deja al menos Élite o RX.";
  if (w.score_type === "for_time" && w.capRaw && w.time_cap_seconds == null)
    return "Time cap no válido. Usa mm:ss.";
  return null;
}

export async function createWod(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await requireCoach();
  const w = wodFromForm(fd);
  const err = validateWod(w);
  if (err) return { error: err };
  const { capRaw, ...data } = w;
  void capRaw;
  const { data: created, error } = await supabase
    .from("wods")
    .insert({ ...data, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(dayHref(data.wod_date, { w: created.id }));
}

export async function updateWod(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireCoach();
  const id = str(fd, "id");
  const w = wodFromForm(fd);
  const err = validateWod(w);
  if (err) return { error: err };

  // Cambiar el tipo de score con resultados ya metidos los dejaría incoherentes
  const { data: before } = await supabase.from("wods").select("*").eq("id", id).single();
  const newScore2 = "score2_type" in w ? w.score2_type : null;
  const score2Changed = !!before?.score2_type && before.score2_type !== newScore2;
  if (before && (before.score_type !== w.score_type || score2Changed)) {
    const { count } = await supabase.from("results").select("id", { count: "exact", head: true }).eq("wod_id", id);
    if (count) return { error: "No se puede cambiar el tipo de resultado: ya hay {n} resultado(s). Bórralos antes o crea otro WOD.", vars: { n: count } };
  }
  const { capRaw, ...rest } = w;
  void capRaw;
  // Quitar el segundo score: vaciar sus columnas (solo existen si ya estaba puesto)
  const data = before?.score2_type && !newScore2 ? { ...rest, score_name: null, score2_type: null, score2_name: null, score2_label: null } : rest;
  const { error } = await supabase.from("wods").update(data).eq("id", id);
  if (error) return { error: error.message };
  // Si se quita Élite o RX, los resultados que ya estaban ahí pasan a la que queda (un solo ranking)
  const kept = w.divisions;
  for (const [gone, to] of [["rx", "elite"], ["elite", "rx"]] as const)
    if (!kept.includes(gone) && kept.includes(to)) await supabase.from("results").update({ division: to }).eq("wod_id", id).eq("division", gone);
  revalidatePath("/", "layout");
  redirect(dayHref(data.wod_date, { w: id }));
}

/** Cambiar el orden de las partes de un día (A ↔ B…): intercambia la letra con la de al lado. */
export async function moveWod(fd: FormData) {
  const { supabase } = await requireCoach();
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const { data: me } = await supabase.from("wods").select("id, part, wod_date").eq("id", id).maybeSingle<{ id: string; part: string; wod_date: string }>();
  if (!me) return;
  const { data: day } = await supabase.from("wods").select("id, part").eq("wod_date", me.wod_date).order("part").order("created_at").returns<{ id: string; part: string }[]>();
  const list = [...(day ?? [])];
  const i = list.findIndex((w) => w.id === id);
  if (i < 0 || !list[i + dir]) return;
  // Se mueve en la lista y se vuelven a poner las letras A, B, C… en orden (así también se arreglan letras repetidas)
  [list[i], list[i + dir]] = [list[i + dir], list[i]];
  for (const [k, w] of list.entries()) {
    const want = String.fromCharCode(65 + Math.min(k, 25));
    if (w.part !== want) await supabase.from("wods").update({ part: want }).eq("id", w.id);
  }
  revalidatePath("/", "layout");
  redirect(dayHref(me.wod_date, { w: me.id }));
}

export async function deleteWod(fd: FormData) {
  const { supabase } = await requireCoach();
  const { data: gone } = await supabase.from("wods").select("wod_date").eq("id", str(fd, "id")).maybeSingle();
  await supabase.from("wods").delete().eq("id", str(fd, "id"));
  // Renombrar las partes que quedan ese día: si borras la A, la B pasa a A, la C a B…
  const date = gone?.wod_date ?? str(fd, "wod_date");
  if (date) {
    const { data: rest } = await supabase.from("wods").select("id, part").eq("wod_date", date).order("part");
    const letters = (rest ?? []).filter((w) => /^[A-Z]$/.test(w.part));
    for (const [i, w] of letters.entries()) {
      const want = String.fromCharCode(65 + i);
      if (w.part !== want) await supabase.from("wods").update({ part: want }).eq("id", w.id);
    }
  }
  revalidatePath("/", "layout");
  redirect(dayHref(str(fd, "wod_date")));
}

/** Coach: borra todas las partes entre dos fechas (un día o una semana). Los resultados se van con ellas. */
export async function deleteWodsRange(fd: FormData) {
  const { supabase, box } = await requireCoach();
  const from = str(fd, "from");
  const to = str(fd, "to");
  if (!isISODate(from) || !isISODate(to) || to < from) return;
  await supabase
    .from("wods")
    .delete()
    .eq("box_id", box.id)
    .gte("wod_date", from)
    .lte("wod_date", to);
  revalidatePath("/", "layout");
  const back = str(fd, "back");
  redirect(back.startsWith("/") ? back : dayHref(from));
}

export async function createWodsBulk(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user } = await requireCoach();
  let items: {
    wod_date: string;
    part: string;
    title: string;
    description: string;
    score_type: ScoreType;
    time_cap: string;
    is_benchmark: boolean;
  }[];
  try {
    items = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    return { error: "Datos no válidos." };
  }
  if (!items.length) return { error: "No hay nada seleccionado." };

  const rows = [];
  for (const it of items) {
    const title = String(it.title ?? "").trim();
    if (!title) return { error: "Hay una parte sin título." };
    if (!isISODate(String(it.wod_date))) return { error: "Fecha no válida en «{title}».", vars: { title } };
    if (!(it.score_type in SCORE_TYPES)) return { error: "Tipo de resultado no válido en «{title}».", vars: { title } };
    let cap: number | null = null;
    if (it.score_type === "for_time" && String(it.time_cap ?? "").trim()) {
      cap = parseTime(String(it.time_cap));
      if (cap == null) return { error: "Time cap no válido en «{title}». Usa mm:ss.", vars: { title } };
    }
    rows.push({
      wod_date: it.wod_date,
      part: (String(it.part || "A").toUpperCase().slice(0, 3)) || "A",
      title: title.slice(0, 120),
      description: String(it.description ?? ""),
      score_type: it.score_type,
      time_cap_seconds: cap,
      is_benchmark: Boolean(it.is_benchmark),
      divisions: detectDivisions(`${title}\n${it.description ?? ""}`),
      published: true,
      created_by: user.id,
    });
  }

  // Si ese día ya hay partes (A, B…), las nuevas van detrás (C, D…) en vez de repetir letra
  const dates = [...new Set(rows.map((r) => r.wod_date))];
  const { data: existing } = await supabase.from("wods").select("wod_date, part").in("wod_date", dates).returns<{ wod_date: string; part: string }[]>();
  const used = new Map<string, Set<string>>();
  for (const e of existing ?? []) used.set(e.wod_date, (used.get(e.wod_date) ?? new Set()).add(e.part));
  for (const r of rows) {
    const taken = used.get(r.wod_date) ?? new Set<string>();
    if (taken.has(r.part)) r.part = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !taken.has(l)) ?? r.part;
    used.set(r.wod_date, taken.add(r.part));
  }

  const { error } = await supabase.from("wods").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(dayHref(rows[0].wod_date));
}

// ---------------- REACCIONES ----------------

export async function setReaction(resultId: string, emoji: string, on: boolean) {
  const { supabase, user, box } = await requireUser();
  if (!["👊", "🔥"].includes(emoji)) return;
  const row = { result_id: resultId, user_id: user.id, emoji };
  // Idempotente: poner o quitar sin leer antes. Sin revalidar: el cliente ya pinta el cambio.
  if (on) await supabase.from("reactions").upsert(row, { onConflict: "result_id,user_id,emoji", ignoreDuplicates: true });
  else await supabase.from("reactions").delete().match(row);
  if (on) {
    const { profile } = await requireUser();
    after(async () => {
      const { data: r } = await supabase.from("results").select("user_id, wods(title)").eq("id", resultId).maybeSingle<{ user_id: string; wods: { title: string } | null }>();
      if (!r || r.user_id === user.id) return;
      await sendPush([r.user_id], "social", {
        title: `${emoji} ${profile?.full_name || "Alguien"}`,
        body: `Ha reaccionado a tu resultado${r.wods?.title ? ` en ${r.wods.title}` : ""}`,
        url: `/r/${resultId}`,
        tag: `react-${resultId}`, box: box.slug,
      });
    });
  }
}


// ---------------- COMENTARIOS ----------------

export async function addComment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, box } = await requireUser();
  const body = str(fd, "body").slice(0, 500);
  const resultId = str(fd, "result_id");
  if (!body) return { error: "Escribe algo." };
  const { error } = await supabase.from("result_comments").insert({ result_id: resultId, user_id: user.id, body });
  if (error) return { error: "No se ha podido enviar el comentario." };
  revalidatePath(`/r/${resultId}`);
  revalidatePath("/", "layout");
  const { profile } = await requireUser();
  after(async () => {
    // Avisamos al dueño del resultado y a quien ya haya comentado en esa conversación
    const [{ data: r }, { data: others }] = await Promise.all([
      supabase.from("results").select("user_id, wods(title)").eq("id", resultId).maybeSingle<{ user_id: string; wods: { title: string } | null }>(),
      supabase.from("result_comments").select("user_id").eq("result_id", resultId),
    ]);
    if (!r) return;
    const who = profile?.full_name || "Alguien";
    const text = body.length > 120 ? body.slice(0, 117) + "…" : body;
    const wod = r.wods?.title ? ` · ${r.wods.title}` : "";
    if (r.user_id !== user.id) await sendPush([r.user_id], "social", { title: `💬 ${who}${wod}`, body: text, url: `/r/${resultId}`, tag: `c-${resultId}`, box: box.slug });
    const rest = [...new Set((others ?? []).map((o) => o.user_id as string))].filter((id) => id !== user.id && id !== r.user_id);
    if (rest.length) await sendPush(rest, "social", { title: `💬 ${who} ha contestado${wod}`, body: text, url: `/r/${resultId}`, tag: `c-${resultId}`, box: box.slug });
  });
  return { ok: "sent" };
}

// ---------------- DUDAS DEL WOD ----------------

/** Pregunta o respuesta en las dudas del WOD. Avisa a los coaches (si pregunta un atleta) y a quien ya participó. */
export async function addWodComment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, profile, box } = await requireUser();
  const body = str(fd, "body").slice(0, 500);
  const wodId = str(fd, "wod_id");
  if (!body) return { error: "Escribe algo." };
  const { error } = await supabase.from("wod_comments").insert({ wod_id: wodId, user_id: user.id, body });
  if (error) return { error: "No se ha podido enviar el comentario." };
  revalidatePath("/", "layout");
  after(async () => {
    const [{ data: w }, { data: others }, staff] = await Promise.all([
      supabase.from("wods").select("title, part").eq("id", wodId).maybeSingle<{ title: string; part: string }>(),
      supabase.from("wod_comments").select("user_id").eq("wod_id", wodId),
      staffIds(box.id),
    ]);
    if (!w) return;
    const who = profile?.full_name || "Alguien";
    const text = body.length > 120 ? body.slice(0, 117) + "…" : body;
    const url = `/wod/${wodId}#dudas`;
    const isStaff = staff.includes(user.id);
    const done = new Set<string>([user.id]);
    // A los coaches les llega cada duda de un atleta
    if (!isStaff) {
      const to = staff.filter((id) => !done.has(id));
      to.forEach((id) => done.add(id));
      if (to.length) await sendPush(to, "messages", { title: `❓ ${who} · ${w.part} ${w.title}`, body: text, url, tag: `wc-${wodId}`, box: box.slug });
    }
    const rest = [...new Set((others ?? []).map((o) => o.user_id as string))].filter((id) => !done.has(id));
    if (rest.length) await sendPush(rest, "social", { title: `💬 ${who} · ${w.part} ${w.title}`, body: text, url, tag: `wc-${wodId}`, box: box.slug });
  });
  return { ok: "sent" };
}

/** Reacción a un comentario de las dudas (una por persona; `null` la quita). */
export async function setWodCommentReaction(commentId: string, emoji: string | null) {
  const { supabase, user, profile, box } = await requireUser();
  if (emoji !== null && !(COMMENT_EMOJIS as readonly string[]).includes(emoji)) return;
  if (emoji === null) {
    await supabase.from("wod_comment_reactions").delete().match({ comment_id: commentId, user_id: user.id });
    return;
  }
  const { error } = await supabase
    .from("wod_comment_reactions")
    .upsert({ comment_id: commentId, user_id: user.id, emoji, created_at: new Date().toISOString() }, { onConflict: "comment_id,user_id" });
  if (error) throw new Error("reaction");
  after(async () => {
    const { data: c } = await supabase.from("wod_comments").select("user_id, body, wod_id").eq("id", commentId).maybeSingle<{ user_id: string; body: string; wod_id: string }>();
    if (!c || c.user_id === user.id) return;
    const text = c.body.length > 80 ? c.body.slice(0, 77) + "…" : c.body;
    await sendPush([c.user_id], "social", { title: `${emoji} ${profile?.full_name || "Alguien"}`, body: `Ha reaccionado a tu comentario: «${text}»`, url: `/wod/${c.wod_id}#dudas`, tag: `wcr-${commentId}`, box: box.slug });
  });
}

export async function deleteWodComment(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("wod_comments").delete().eq("id", str(fd, "id"));
  revalidatePath("/", "layout");
}

/** El coach fija la respuesta buena arriba (solo una fijada por WOD); tocarla otra vez la suelta. */
export async function pinWodComment(fd: FormData) {
  const { supabase } = await requireCoach();
  const id = str(fd, "id");
  const { data: c } = await supabase.from("wod_comments").select("wod_id, pinned").eq("id", id).maybeSingle<{ wod_id: string; pinned: boolean }>();
  if (!c) return;
  const db = adminDb();
  await db.from("wod_comments").update({ pinned: false }).eq("wod_id", c.wod_id);
  if (!c.pinned) await db.from("wod_comments").update({ pinned: true }).eq("id", id);
  revalidatePath("/", "layout");
}

/** Calentamiento específico para el WOD (se prepara una vez por WOD e idioma). */
export async function getWarmup(wodId: string): Promise<{ body?: string; error?: string }> {
  const { supabase } = await requireUser();
  if (!hasAdminKey() || !hasAi()) return { error: "El calentamiento no está disponible ahora mismo." };
  const { locale } = await getI18n();
  const db = adminDb();
  const { data: cached } = await db.from("wod_warmups").select("body").eq("wod_id", wodId).eq("locale", locale).maybeSingle<{ body: string }>();
  if (cached) return { body: cached.body };
  // Con el cliente del atleta: si no puede ver el WOD, no hay calentamiento
  const { data: wod } = await supabase.from("wods").select("*").eq("id", wodId).maybeSingle<Wod>();
  if (!wod) return { error: "WOD no encontrado." };
  const { data: day } = await supabase.from("wods").select("part, title").eq("wod_date", wod.wod_date).neq("id", wod.id).order("part").returns<{ part: string; title: string }[]>();
  const body = await makeWarmup(wod, day ?? [], locale);
  if (!body) return { error: "No hemos podido preparar el calentamiento. Prueba en un momento." };
  await db.from("wod_warmups").upsert({ wod_id: wodId, locale, body });
  return { body };
}

/** Reacción a un comentario, como en WhatsApp: una por persona; otra la sustituye y `null` la quita. */
export async function setCommentReaction(commentId: string, emoji: string | null) {
  const { supabase, user, box } = await requireUser();
  if (emoji !== null && !(COMMENT_EMOJIS as readonly string[]).includes(emoji)) return;
  if (emoji === null) {
    await supabase.from("comment_reactions").delete().match({ comment_id: commentId, user_id: user.id });
    return;
  }
  const { error } = await supabase
    .from("comment_reactions")
    .upsert({ comment_id: commentId, user_id: user.id, emoji, created_at: new Date().toISOString() }, { onConflict: "comment_id,user_id" });
  if (error) throw new Error("reaction");
  const { profile } = await requireUser();
  after(async () => {
    const { data: c } = await supabase
      .from("result_comments")
      .select("user_id, body, result_id")
      .eq("id", commentId)
      .maybeSingle<{ user_id: string; body: string; result_id: string }>();
    if (!c || c.user_id === user.id) return;
    const text = c.body.length > 80 ? c.body.slice(0, 77) + "…" : c.body;
    await sendPush([c.user_id], "social", {
      title: `${emoji} ${profile?.full_name || "Alguien"}`,
      body: `Ha reaccionado a tu comentario: «${text}»`,
      url: `/r/${c.result_id}`,
      tag: `cr-${commentId}`, box: box.slug,
    });
  });
}

export async function deleteComment(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("result_comments").delete().eq("id", str(fd, "id"));
  revalidatePath(`/r/${str(fd, "result_id")}`);
}

// ---------------- ADMIN: invitaciones y personas ----------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteState = { error?: string; ok?: string; vars?: Record<string, string | number>; link?: string; name?: string; email?: string } | undefined;

export async function createInvitation(_: InviteState, fd: FormData): Promise<InviteState> {
  const { user, box } = await requireAdmin();
  const first_name = str(fd, "first_name");
  const last_name = str(fd, "last_name");
  const email = str(fd, "email").toLowerCase();
  const r = str(fd, "role");
  const role = r === "coach" || r === "admin" ? r : "athlete";
  if (!first_name) return { error: "Pon el nombre." };
  if (!EMAIL_RE.test(email)) return { error: "El email no es válido." };

  const db = adminDb();
  // ¿Ya tiene cuenta en la plataforma (quizá en otro box)? Lo añadimos a este box directamente.
  const { data: existing } = await db.rpc("user_id_by_email", { p_email: email });
  if (existing) {
    const { data: already } = await db.from("box_members").select("active, pending").eq("box_id", box.id).eq("user_id", existing).maybeSingle<{ active: boolean; pending: boolean }>();
    if (already?.pending) {
      // Ya lo había pedido con el QR: invitarle es aceptarle
      await db.from("box_members").update({ pending: false, active: true, role, joined_at: new Date().toISOString() }).eq("box_id", box.id).eq("user_id", existing);
      revalidatePath("/admin");
      return { ok: "Ya tenía cuenta: la hemos añadido a tu box. Que entre con su email y contraseña de siempre.", link: boxUrl(box.slug, await siteUrl()), name: first_name, email };
    }
    if (already) return { error: "Esa persona ya está en tu box. Búscala en Personas (puedes activarla si estaba desactivada)." };
    const { error } = await db.from("box_members").insert({ box_id: box.id, user_id: existing, role });
    if (error) return { error: "No se ha podido añadir: {msg}", vars: { msg: error.message } } as InviteState;
    revalidatePath("/admin");
    return { ok: "Ya tenía cuenta: la hemos añadido a tu box. Que entre con su email y contraseña de siempre.", link: boxUrl(box.slug, await siteUrl()), name: first_name, email };
  }

  const token = randomBytes(24).toString("base64url");
  // Si ya había una invitación pendiente para ese email en este box, la sustituimos
  await db.from("invitations").delete().eq("box_id", box.id).eq("email", email).is("accepted_at", null);
  const { error } = await db.from("invitations").insert({ token, email, first_name, last_name, role, created_by: user.id, box_id: box.id });
  if (error) return { error: "No se ha podido crear la invitación: {msg}", vars: { msg: error.message } } as InviteState;
  revalidatePath("/admin");
  return { ok: "Invitación creada.", link: `${await siteUrl()}/invitacion/${token}`, name: first_name, email };
}

/** Envía la invitación por email (con Resend), con un email de bienvenida y el enlace para crear la cuenta. */
export async function sendInviteEmail(token: string): Promise<{ ok?: string; error?: string; vars?: Record<string, string> }> {
  const { box, profile } = await requireAdmin();
  const { t } = await getI18n();
  const { data: inv } = await adminDb()
    .from("invitations")
    .select("email, first_name, role, accepted_at")
    .eq("token", token).eq("box_id", box.id)
    .maybeSingle<{ email: string; first_name: string; role: "athlete" | "coach"; accepted_at: string | null }>();
  if (!inv) return { error: "No encuentro esa invitación." };
  if (inv.accepted_at) return { error: "Esa invitación ya se ha usado." };
  const site = await siteUrl();
  const link = `${site}/invitacion/${token}`;
  const accent = /^#[0-9a-f]{6}$/i.test(box.accent ?? "") ? box.accent! : "#c8f135";
  const fg = luminance(accent) > 0.5 ? "#0c0d10" : "#ffffff";
  const logo = box.logo_url && /^https?:\/\//.test(box.logo_url) ? box.logo_url : null;
  const mail = inviteEmail({ brand: box.name, accent, accentFg: fg, logoUrl: logo, name: inv.first_name, link, role: inv.role, inviter: profile?.full_name ?? null, t });
  const err = await sendEmail({ to: inv.email, ...mail, replyTo: null });
  if (err) return { error: "No se ha podido enviar el email: {msg}", vars: { msg: err } };
  return { ok: "Email enviado a {email}", vars: { email: inv.email } };
}

/** Luminosidad relativa de un color hex (para elegir texto negro o blanco encima). */
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export async function deleteInvitation(fd: FormData) {
  const { box } = await requireAdmin();
  await adminDb().from("invitations").delete().eq("id", str(fd, "id")).eq("box_id", box.id);
  revalidatePath("/admin");
}

/** Admin del box: activar/desactivar a alguien en el box o cambiar su rol (atleta, coach, admin). */
export async function setUserFlag(fd: FormData) {
  const { user, box } = await requireAdmin();
  const id = str(fd, "id");
  const flag = str(fd, "flag");
  const on = str(fd, "on") === "1";
  if (id === user.id && (flag === "active" || flag === "is_admin") && !on) return; // no te quites a ti mismo
  const db = adminDb();
  const { data: m } = await db.from("box_members").select("role").eq("box_id", box.id).eq("user_id", id).maybeSingle<{ role: string }>();
  if (!m) return;
  const patch =
    flag === "active"
      ? { active: on }
      : flag === "is_admin"
        ? { role: on ? "admin" : "coach" }
        : flag === "coach"
          ? { role: on ? (m.role === "admin" ? "admin" : "coach") : "athlete" }
          : null;
  if (!patch) return;
  await db.from("box_members").update(patch).eq("box_id", box.id).eq("user_id", id);
  revalidatePath("/admin");
}

// ---------------- INVITACIÓN: crear la cuenta ----------------

export async function acceptInvitation(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = str(fd, "token");
  const password = str(fd, "password");
  const gender = str(fd, "gender");
  const first_name = str(fd, "first_name");
  const last_name = str(fd, "last_name");
  if (!first_name) return { error: "Pon tu nombre." };
  if (gender !== "M" && gender !== "F") return { error: "Elige categoría (chico/chica)." };
  if (password.length < 6) return { error: "La contraseña tiene que tener al menos 6 caracteres." };
  if (password !== str(fd, "password2")) return { error: "Las contraseñas no coinciden." };

  const db = adminDb();
  const { data: inv } = await db
    .from("invitations")
    .select("id, email, role, accepted_at, box_id, boxes(slug)")
    .eq("token", token)
    .maybeSingle<{ id: string; email: string; role: string; accepted_at: string | null; box_id: string; boxes: { slug: string } | null }>();
  if (!inv) return { error: "Esta invitación no existe o la han anulado." };
  if (inv.accepted_at) return { error: "Esta invitación ya se usó. Entra con tu email y contraseña." };

  const { data: created, error } = await db.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
    user_metadata: { first_name, last_name, full_name: `${first_name} ${last_name}`.trim(), gender, role: inv.role },
  });
  if (error || !created.user) {
    if (/already|registered|exists/i.test(error?.message ?? "")) return { error: "Ese email ya tiene cuenta. Entra con tu contraseña." };
    return { error: "No se ha podido crear la cuenta: {msg}", vars: { msg: error?.message ?? "" } };
  }
  await db.from("invitations").update({ accepted_at: new Date().toISOString(), user_id: created.user.id }).eq("id", inv.id);
  await db.from("box_members").upsert({ box_id: inv.box_id, user_id: created.user.id, role: inv.role, active: true, pending: false }, { onConflict: "box_id,user_id" });

  const supabase = await createClient(null);
  await supabase.auth.signInWithPassword({ email: inv.email, password });
  if (inv.boxes?.slug) await setBoxCookie(inv.boxes.slug);
  redirect("/perfil?bienvenida=1");
}

async function setBoxCookie(slug: string) {
  const { cookies } = await import("next/headers");
  (await cookies()).set(BOX_COOKIE, slug, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

// ---------------- ALTA CON QR ----------------

type JoinBox = { id: string; slug: string; name: string; join_mode: "approval" | "open" };

/** El atleta escanea el QR del box: crea su cuenta si no tiene y entra (o queda pendiente de aprobación). */
export async function joinBox(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasAdminKey()) return { error: "Falta configurar el servidor (SUPABASE_SECRET_KEY)." };
  const db = adminDb();
  const code = str(fd, "code");
  const { data: box } = await db.from("boxes").select("id, slug, name, join_mode").eq("join_code", code).maybeSingle<JoinBox>();
  if (!box) return { error: "Este código ya no vale. Pide al box el QR nuevo." };

  let supabase = await createClient(null);
  let userId = (await supabase.auth.getClaims()).data?.claims?.sub as string | undefined;
  if (!userId) {
    const email = str(fd, "email").toLowerCase();
    const password = str(fd, "password");
    const first_name = str(fd, "first_name");
    const last_name = str(fd, "last_name");
    const gender = str(fd, "gender");
    if (!first_name) return { error: "Pon tu nombre." };
    if (gender !== "M" && gender !== "F") return { error: "Elige categoría (chico/chica)." };
    if (!EMAIL_RE.test(email)) return { error: "El email no es válido." };
    if (password.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres." };
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, gender, full_name: `${first_name} ${last_name}`.trim() },
    });
    if (error || !created.user) {
      if (/already|registered|exists/i.test(error?.message ?? "")) return { error: "Ese email ya tiene cuenta: pulsa «Ya tengo cuenta» y entra con tu contraseña." };
      return { error: "No se ha podido crear la cuenta: {msg}", vars: { msg: error?.message ?? "" } };
    }
    userId = created.user.id;
    supabase = await createClient(null);
    await supabase.auth.signInWithPassword({ email, password });
  }

  const open = box.join_mode === "open";
  const { data: existing } = await db.from("box_members").select("active, pending").eq("box_id", box.id).eq("user_id", userId).maybeSingle<{ active: boolean; pending: boolean }>();
  if (!existing) {
    await db.from("box_members").insert({ box_id: box.id, user_id: userId, role: "athlete", active: open, pending: !open });
  } else if (!existing.active && !existing.pending) {
    // Estaba de baja y vuelve: según el box, entra directo o vuelve a pedir paso
    await db.from("box_members").update(open ? { active: true } : { pending: true }).eq("box_id", box.id).eq("user_id", userId);
  }
  await setBoxCookie(box.slug);

  const waiting = !open && !existing?.active;
  if (waiting) {
    const { data: who } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle<{ full_name: string }>();
    const { data: admins } = await db.from("box_members").select("user_id").eq("box_id", box.id).eq("role", "admin").eq("active", true).returns<{ user_id: string }[]>();
    after(() =>
      sendPush((admins ?? []).map((a) => a.user_id), "messages", {
        title: `${box.name} · ${BRAND.short}`,
        body: `${who?.full_name || "Alguien"} quiere unirse al box. Acéptalo en Admin.`,
        url: "/admin",
        tag: "join",
        box: box.slug,
      }),
    );
  }
  redirect("/");
}

/** Aceptar o rechazar una solicitud del QR. */
export async function resolveJoinRequest(fd: FormData) {
  const { box } = await requireAdmin();
  const id = str(fd, "id");
  const ok = str(fd, "ok") === "1";
  const db = adminDb();
  if (ok) {
    await db.from("box_members").update({ pending: false, active: true, joined_at: new Date().toISOString() }).eq("box_id", box.id).eq("user_id", id).eq("pending", true);
    after(() => sendPush([id], "messages", { title: `${box.name} · ${BRAND.short}`, body: "¡Ya estás dentro! Mete tu primer resultado.", url: "/", tag: "join", box: box.slug }));
  } else {
    // Si nunca llegó a entrar, se borra la solicitud; si era antiguo socio, queda de baja como estaba
    const { count } = await db.from("results").select("id", { count: "exact", head: true }).eq("box_id", box.id).eq("user_id", id);
    if (count) await db.from("box_members").update({ pending: false }).eq("box_id", box.id).eq("user_id", id);
    else await db.from("box_members").delete().eq("box_id", box.id).eq("user_id", id).eq("pending", true);
  }
  revalidatePath("/admin");
}

/** Con aprobación (por defecto) o entrada directa. */
export async function setJoinMode(fd: FormData) {
  const { box } = await requireAdmin();
  const mode = str(fd, "mode") === "open" ? "open" : "approval";
  await adminDb().from("boxes").update({ join_mode: mode }).eq("id", box.id);
  revalidatePath("/admin");
}

/** Nuevo QR: el anterior deja de valer. */
export async function rotateJoinCode() {
  const { box } = await requireAdmin();
  await adminDb().from("boxes").update({ join_code: randomBytes(6).toString("hex") }).eq("id", box.id);
  revalidatePath("/admin");
}

/** Dar de baja de golpe a los atletas sin resultados en los últimos 60 días. */
export async function deactivateInactive(fd: FormData) {
  const { user, box } = await requireAdmin();
  const ids = str(fd, "ids").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x) && x !== user.id);
  if (!ids.length) return;
  await adminDb().from("box_members").update({ active: false }).eq("box_id", box.id).eq("role", "athlete").in("user_id", ids);
  revalidatePath("/admin");
}

/** El atleta se sale del box (su cuenta sigue para otros boxes; sus resultados se quedan). */
export async function leaveBox() {
  const { user, box, boxRole } = await requireUser();
  const db = adminDb();
  if (boxRole === "admin") {
    const { count } = await db.from("box_members").select("user_id", { count: "exact", head: true }).eq("box_id", box.id).eq("role", "admin").eq("active", true);
    if ((count ?? 0) <= 1) redirect("/perfil?salir=admin");
  }
  await db.from("box_members").update({ active: false }).eq("box_id", box.id).eq("user_id", user.id);
  const { cookies } = await import("next/headers");
  (await cookies()).delete(BOX_COOKIE);
  redirect("/boxes?cambiar=1");
}

// ---------------- AJUSTES DEL BOX (admin) ----------------

export async function updateBox(_: ActionState, fd: FormData): Promise<ActionState> {
  const { box } = await requireAdmin();
  const name = str(fd, "box_name").slice(0, 60);
  if (name.length < 2) return { error: "Pon el nombre del box." };
  const { error } = await adminDb().from("boxes").update({ name, rewards_enabled: fd.get("rewards") === "on" }).eq("id", box.id);
  if (error) return { error: "No se han podido guardar los cambios." };
  revalidatePath("/", "layout");
  return { ok: "Guardado." };
}

// ---------------- ALTA DE UN BOX ----------------

export async function createBox(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "box_name").slice(0, 60);
  const slug = str(fd, "slug").toLowerCase();
  if (name.length < 2) return { error: "Pon el nombre del box." };
  if (!isValidSlug(slug)) return { error: "La dirección no es válida: entre 3 y 30 letras minúsculas, números o guiones." };
  if (!hasAdminKey()) return { error: "Falta configurar el servidor (SUPABASE_SECRET_KEY)." };
  const db = adminDb();
  const { data: taken } = await db.from("boxes").select("id").eq("slug", slug).maybeSingle();
  if (taken) return { error: "Esa dirección ya la usa otro box. Prueba con otra." };

  // ¿Ya tiene sesión? Si no, creamos la cuenta del dueño
  let supabase = await createClient(null);
  let { data: claims } = await supabase.auth.getClaims();
  let userId = claims?.claims?.sub as string | undefined;
  if (!userId) {
    const email = str(fd, "email").toLowerCase();
    const password = str(fd, "password");
    const first_name = str(fd, "first_name");
    const last_name = str(fd, "last_name");
    if (!first_name) return { error: "Pon tu nombre." };
    if (!EMAIL_RE.test(email)) return { error: "El email no es válido." };
    if (password.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres." };
    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, full_name: `${first_name} ${last_name}`.trim() },
    });
    if (error || !created.user) {
      if (/already|registered|exists/i.test(error?.message ?? "")) return { error: "Ese email ya tiene cuenta: entra primero y vuelve a esta página." };
      return { error: "No se ha podido crear la cuenta: {msg}", vars: { msg: error?.message ?? "" } };
    }
    userId = created.user.id;
    supabase = await createClient(null);
    await supabase.auth.signInWithPassword({ email, password });
    ({ data: claims } = await supabase.auth.getClaims());
  }

  const { data: box, error: boxErr } = await db.from("boxes").insert({ slug, name, created_by: userId }).select("id").single();
  if (boxErr || !box) return { error: "No se ha podido crear el box: {msg}", vars: { msg: boxErr?.message ?? "" } };
  await db.from("box_members").insert({ box_id: box.id, user_id: userId, role: "admin" });
  await setBoxCookie(slug);
  redirect("/admin?nuevo=1");
}

// ---------------- IDIOMA ----------------

export async function setLanguage(lang: string) {
  const { LANG_COOKIE, isLang } = await import("@/lib/i18n/core");
  if (!isLang(lang)) return;
  const { cookies } = await import("next/headers");
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// =====================================================================
// MARCAS PERSONALES (benchmarks, RM, gimnásticos, cardio)
// =====================================================================

/** Apuntar una marca con fecha. Cada vez que la repites queda en tu historial; la mejor es tu PR. */
export async function savePersonalRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, box } = await requireUser();
  const benchmarkId = str(fd, "benchmark_id");
  const { data: b } = await supabase.from("benchmarks").select("id, name, description, category, score_type").eq("id", benchmarkId).maybeSingle();
  if (!b) return { error: "Ese benchmark no existe." };
  const date = str(fd, "performed_on");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Elige la fecha en que lo hiciste." };
  if (date > new Date().toISOString().slice(0, 10)) return { error: "La fecha no puede ser futura." };

  const row = {
    user_id: user.id,
    benchmark_id: benchmarkId,
    performed_on: date,
    division: str(fd, "division") === "scaled" ? "scaled" : "rx",
    rm: null as number | null,
    finished: true,
    time_seconds: null as number | null,
    rounds: null as number | null,
    reps: null as number | null,
    value: null as number | null,
    notes: str(fd, "notes").slice(0, 500) || null,
  };
  if (["lifts", "olympic"].includes(b.category)) {
    const rm = int(fd, "rm") ?? 1;
    row.rm = Number.isNaN(rm) || rm < 1 || rm > 20 ? 1 : rm;
  }
  switch (b.score_type as ScoreType) {
    case "for_time": {
      row.finished = str(fd, "finished") !== "no";
      if (row.finished) {
        const h = int(fd, "time_h") ?? 0;
        const m = int(fd, "time_min") ?? 0;
        const s = int(fd, "time_sec") ?? 0;
        if ([h, m, s].some(Number.isNaN) || s > 59 || (h > 0 && m > 59)) return { error: "Tiempo no válido." };
        const t = h * 3600 + m * 60 + s;
        if (t <= 0) return { error: "Mete tu tiempo." };
        row.time_seconds = t;
      } else {
        const r = int(fd, "reps");
        if (r == null || Number.isNaN(r)) return { error: "Mete las reps que hiciste." };
        row.reps = r;
      }
      break;
    }
    case "amrap": {
      const rounds = int(fd, "rounds");
      const reps = int(fd, "reps") ?? 0;
      if (rounds == null || Number.isNaN(rounds) || Number.isNaN(reps)) return { error: "Mete rondas y reps (números enteros)." };
      row.rounds = rounds;
      row.reps = reps;
      break;
    }
    default: {
      const v = Number(str(fd, "value").replace(",", "."));
      if (!str(fd, "value") || !Number.isFinite(v) || v <= 0) return { error: "Mete un número válido." };
      row.value = v;
    }
  }
  const editId = str(fd, "id");
  // Marca imposible: se pregunta antes de guardarla. Si la confirma, queda para que la revise el equipo.
  const check =
    hasAdminKey() ? await getI18n().then((i18n) => checkPersonalRecord(adminDb(), user.id, b, row, editId, i18n.t, i18n.locale)).catch(() => null) : null;
  if (check && str(fd, "confirm") !== "1") return { confirm: check.reason };
  if (editId) {
    const { data: upd, error } = await supabase.from("personal_records").update(row).eq("id", editId).eq("user_id", user.id).select("id");
    if (error || !upd?.length) return { error: "No se pudo guardar el cambio." };
    flagRecordLater(editId, check, user.id, b, row, box);
    revalidatePath("/marcas", "layout");
    revalidatePath("/historial");
    checkMedalsLater(supabase, user.id, box);
    return { ok: "¡Marca corregida!" };
  }
  const { data: ins, error } = await supabase.from("personal_records").insert(row).select("id").single<{ id: string }>();
  if (error || !ins) return { error: "No se pudo guardar. ¿Tu cuenta está activa?" };
  flagRecordLater(ins.id, check, user.id, b, row, box);
  revalidatePath("/marcas", "layout");
  revalidatePath("/historial");
  checkMedalsLater(supabase, user.id, box);
  return { ok: "¡Marca guardada!" };
}

/** Marca personal imposible confirmada: queda marcada para el equipo y avisa a los admins. Si ya es razonable, se quita la marca. */
function flagRecordLater(
  recordId: string,
  check: { reasonEs: string; hard: boolean } | null,
  userId: string,
  b: { name: string; score_type: string },
  row: Record<string, unknown>, box: { id: string; slug: string },
) {
  if (!hasAdminKey()) return;
  after(async () => {
    const db = adminDb();
    await db.from("personal_records").update({ flag: check?.hard ? `El atleta confirma: ${check.reasonEs}` : null, flag_reviewed: false }).eq("id", recordId);
    if (!check?.hard) return;
    const who = (await db.from("profiles").select("full_name").eq("id", userId).maybeSingle<{ full_name: string }>()).data?.full_name || "Un atleta";
    const score = formatScore({ score_type: b.score_type as ScoreType, score_label: null }, row as unknown as Result);
    await sendPush(await adminIds(box.id), "messages", {
      title: `⚠️ ${who} ha confirmado una marca imposible`,
      body: `${b.name}: ${score}. Revísala en Coach.`,
      url: "/coach",
      tag: `flag-pr-${recordId}`, box: box.slug,
    });
  });
}

/** El coach da por buena una marca personal que el detector había marcado. */
export async function markRecordOk(fd: FormData) {
  const { box } = await requireCoach();
  const id = str(fd, "id");
  if (!(await recordInBox(id, box.id))) return;
  await adminDb().from("personal_records").update({ flag_reviewed: true }).eq("id", id);
  revalidatePath("/coach");
}

/** El coach borra una marca personal imposible. */
export async function deleteFlaggedRecord(fd: FormData) {
  const { box } = await requireCoach();
  const id = str(fd, "id");
  if (!(await recordInBox(id, box.id))) return;
  await adminDb().from("personal_records").delete().eq("id", id).not("flag", "is", null);
  revalidatePath("/coach");
}

/** La marca es de alguien de este box (las marcas personales son de la persona, no del box). */
async function recordInBox(recordId: string, boxId: string) {
  const db = adminDb();
  const { data: pr } = await db.from("personal_records").select("user_id").eq("id", recordId).maybeSingle<{ user_id: string }>();
  if (!pr) return false;
  const { data: m } = await db.from("box_members").select("user_id").eq("box_id", boxId).eq("user_id", pr.user_id).maybeSingle();
  return !!m;
}

export async function deletePersonalRecord(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("personal_records").delete().eq("id", str(fd, "id"));
  revalidatePath("/marcas", "layout");
}

/** Coaches: añadir o corregir un benchmark del catálogo. */
export async function saveBenchmark(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireCoach();
  const id = str(fd, "id");
  const category = str(fd, "category");
  const score_type = str(fd, "score_type");
  const name = str(fd, "name").slice(0, 80);
  if (!name) return { error: "Ponle nombre." };
  if (!["girls", "heroes", "classics", "lifts", "olympic", "gymnastics", "endurance"].includes(category)) return { error: "Elige una categoría." };
  if (!(score_type in SCORE_TYPES)) return { error: "Elige el tipo de resultado." };
  const data = { category, score_type, name, description: str(fd, "description").slice(0, 1000) };
  const { error } = id
    ? await supabase.from("benchmarks").update(data).eq("id", id)
    : await supabase.from("benchmarks").insert({ ...data, sort: 999 });
  if (error) return { error: error.code === "23505" ? "Ya hay uno con ese nombre en esa categoría." : "No se pudo guardar." };
  revalidatePath("/marcas", "layout");
  return { ok: id ? "Cambios guardados" : "Benchmark añadido" };
}

export async function deleteBenchmark(fd: FormData) {
  const { supabase } = await requireCoach();
  await supabase.from("benchmarks").delete().eq("id", str(fd, "id"));
  revalidatePath("/marcas", "layout");
  redirect("/marcas");
}


// ---------------- NOTIFICACIONES PUSH ----------------

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  const { supabase, user } = await requireUser();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Suscripción no válida." };
  // Si ese dispositivo estaba asociado a otra cuenta, lo pasa a esta
  if (hasAdminKey()) await adminDb().from("push_subscriptions").delete().eq("endpoint", sub.endpoint).neq("user_id", user.id);
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent?.slice(0, 200) ?? null }, { onConflict: "endpoint" });
  if (error) return { error: "No se pudieron activar los avisos." };
  return { ok: "ok" };
}

export async function deletePushSubscription(endpoint: string) {
  const { supabase } = await requireUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendTestPush() {
  const { user } = await requireUser();
  const n = await sendPush([user.id], "messages", { title: "🔔 Avisos activados", body: `Así te llegarán los avisos de ${BRAND.short}.`, url: "/perfil", tag: "test" });
  return n > 0 ? { ok: "ok" } : { error: "No se ha podido enviar. Revisa que tengas activados los mensajes del equipo." };
}

export async function updateNotifyPrefs(fd: FormData) {
  const { supabase, user } = await requireUser();
  const k = str(fd, "key");
  if (!["notify_social", "notify_medals", "notify_messages", "notify_reminders", "notify_weekly"].includes(k)) return;
  await supabase.from("profiles").update({ [k]: str(fd, "on") === "1" }).eq("id", user.id);
  revalidatePath("/perfil");
}

// ---------------- MENSAJES CON EL EQUIPO ----------------

/** Un atleta escribe al equipo, o alguien del equipo escribe a un atleta (thread = id del atleta). */
export async function sendMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, profile, box } = await requireUser();
  const body = str(fd, "body").slice(0, 2000);
  const staff = isCoachProfile(profile);
  const thread = staff ? str(fd, "thread") : user.id;
  if (!body) return { error: "Escribe algo." };
  if (!thread) return { error: "Elige a quién escribir." };
  const now = new Date().toISOString();
  const { error } = await supabase.from("messages").insert({ thread_user_id: thread, sender_id: user.id, body, staff_read_at: staff ? now : null });
  if (error) return { error: "No se ha podido enviar el mensaje." };
  if (staff) await supabase.from("messages").update({ staff_read_at: now }).eq("thread_user_id", thread).is("staff_read_at", null);
  revalidatePath("/mensajes", "layout");
  const who = profile?.full_name || "Alguien";
  const text = body.length > 140 ? body.slice(0, 137) + "…" : body;
  after(async () => {
    if (staff) await sendPush([thread], "messages", { title: `✉️ ${who} · ${box.name}`, body: text, url: "/mensajes", tag: "msg", box: box.slug });
    else await sendPush((await staffIds(box.id)).filter((id) => id !== user.id), "messages", { title: `✉️ ${who}`, body: text, url: `/mensajes/${user.id}`, tag: `msg-${user.id}`, box: box.slug });
  });
  return { ok: "sent" };
}

/** Anuncio para toda la comunidad (solo coaches y admins). */
export async function sendAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, user, profile, box } = await requireCoach();
  const body = str(fd, "body").slice(0, 2000);
  if (!body) return { error: "Escribe el anuncio." };
  const { error } = await supabase.from("messages").insert({ thread_user_id: null, sender_id: user.id, body, staff_read_at: new Date().toISOString() });
  if (error) return { error: "No se ha podido publicar el anuncio." };
  revalidatePath("/mensajes", "layout");
  const text = body.length > 140 ? body.slice(0, 137) + "…" : body;
  after(async () => {
    await sendPush((await allActiveIds(box.id)).filter((id) => id !== user.id), "messages", { title: `📣 ${box.name} · ${profile?.full_name ?? ""}`.trim(), body: text, url: "/mensajes", tag: "announce", box: box.slug });
  });
  return { ok: "Anuncio enviado a toda la comunidad." };
}

export async function deleteMessage(fd: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("messages").delete().eq("id", str(fd, "id"));
  revalidatePath("/mensajes", "layout");
}


// ---------------- FOTO → WODs (coaches) ----------------

/** Lee la pizarra o la plani de una o varias fotos y devuelve las partes para revisar (no crea nada). */
export async function readWodPhotos(fd: FormData) {
  await requireCoach();
  const date = str(fd, "date");
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 4);
  if (!files.length) return { error: "Elige al menos una foto." };
  if (!isISODate(date)) return { error: "Fecha no válida." };
  const images = [];
  for (const f of files) {
    if (f.size > 4 * 1024 * 1024) return { error: "Alguna foto es demasiado grande." };
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return { error: "Formato no válido (JPG, PNG o WebP)." };
    images.push({ data: Buffer.from(await f.arrayBuffer()).toString("base64"), type: f.type });
  }
  return wodsFromPhotos(images, date);
}
