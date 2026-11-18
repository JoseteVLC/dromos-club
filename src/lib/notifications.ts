import type { SupabaseClient } from "@supabase/supabase-js";

export type Notice =
  | { kind: "comment"; id: string; at: string; who: string; resultId: string; onMine: boolean; body: string; wod: string | null }
  | { kind: "reaction"; id: string; at: string; who: string; resultId: string; emoji: string; wod: string | null }
  | { kind: "creaction"; id: string; at: string; who: string; resultId: string; emoji: string; body: string; wod: string | null }
  | { kind: "medal"; id: string; at: string; who: string; code: string };

type WodRef = { part: string; title: string } | null;

/**
 * Avisos de un usuario: comentarios en sus resultados o en conversaciones donde ha comentado,
 * y reacciones a sus resultados. `unread` = los posteriores a la última vez que abrió Avisos.
 */
type Row = {
  n_kind: "comment" | "reaction" | "creaction" | "medal"; n_id: string; n_at: string; n_who: string | null; n_result: string | null;
  n_on_mine: boolean; n_body: string | null; n_emoji: string | null; n_wod_title: string | null; n_wod_part: string | null; n_seen: string;
};

/** Una sola consulta a la base de datos (función my_notices). Si la migración 007 aún no está, usa el método antiguo. */
export async function getNotices(supabase: SupabaseClient, userId: string, limit = 50, unreadOnly = false) {
  const { data, error } = await supabase.rpc("my_notices", { p_limit: limit, p_unread_only: unreadOnly });
  if (!error && data) {
    const rows = data as Row[];
    const items: Notice[] = rows.map((r) => {
      const wod = r.n_wod_title ? `${r.n_wod_part ?? ""} · ${r.n_wod_title}` : null;
      if (r.n_kind === "medal") return { kind: "medal", id: r.n_id, at: r.n_at, who: "", code: r.n_body ?? "" };
      if (r.n_kind === "creaction")
        return { kind: "creaction", id: r.n_id, at: r.n_at, who: r.n_who ?? "", resultId: r.n_result ?? "", emoji: r.n_emoji ?? "", body: r.n_body ?? "", wod };
      return r.n_kind === "comment"
        ? { kind: "comment", id: r.n_id, at: r.n_at, who: r.n_who ?? "", resultId: r.n_result ?? "", onMine: r.n_on_mine, body: r.n_body ?? "", wod }
        : { kind: "reaction", id: r.n_id, at: r.n_at, who: r.n_who ?? "", resultId: r.n_result ?? "", emoji: r.n_emoji ?? "", wod };
    });
    let seen = rows[0]?.n_seen;
    if (!seen && !unreadOnly) {
      const { data: me } = await supabase.from("profiles").select("notifications_seen_at").eq("id", userId).single();
      seen = me?.notifications_seen_at ?? new Date(0).toISOString();
    }
    seen ??= new Date(0).toISOString();
    return { items, unread: unreadOnly ? items : items.filter((n) => n.at > seen), seen };
  }
  return getNoticesLegacy(supabase, userId, limit);
}

async function getNoticesLegacy(supabase: SupabaseClient, userId: string, limit = 50) {
  const { data: me } = await supabase.from("profiles").select("notifications_seen_at").eq("id", userId).single();
  const seen: string = me?.notifications_seen_at ?? new Date(0).toISOString();

  const [{ data: myResults }, { data: myComments }] = await Promise.all([
    supabase.from("results").select("id").eq("user_id", userId).order("updated_at", { ascending: false }).limit(500),
    supabase.from("result_comments").select("result_id").eq("user_id", userId).limit(500),
  ]);
  const mineIds = (myResults ?? []).map((r) => r.id as string);
  const threadIds = [...new Set([...mineIds, ...(myComments ?? []).map((c) => c.result_id as string)])].slice(0, 500);
  const wodName = (w: WodRef) => (w ? `${w.part} · ${w.title}` : null);

  const [{ data: comments }, { data: reactions }] = await Promise.all([
    threadIds.length
      ? supabase
          .from("result_comments")
          .select("id, body, created_at, user_id, result_id, profiles!result_comments_user_id_fkey(full_name), results(user_id, wods(title, part))")
          .in("result_id", threadIds)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
    mineIds.length
      ? supabase
          .from("reactions")
          .select("result_id, user_id, emoji, created_at, profiles(full_name), results(wods(title, part))")
          .in("result_id", mineIds)
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
  ]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const items: Notice[] = [
    ...((comments ?? []) as any[]).map((c) => ({
      kind: "comment" as const,
      id: `c-${c.id}`,
      at: c.created_at,
      who: c.profiles?.full_name || "",
      resultId: c.result_id,
      onMine: c.results?.user_id === userId,
      body: c.body,
      wod: wodName(c.results?.wods ?? null),
    })),
    ...((reactions ?? []) as any[]).map((r) => ({
      kind: "reaction" as const,
      id: `r-${r.result_id}-${r.user_id}-${r.emoji}`,
      at: r.created_at,
      who: r.profiles?.full_name || "",
      resultId: r.result_id,
      emoji: r.emoji,
      wod: wodName(r.results?.wods ?? null),
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const unread = items.filter((n) => n.at > seen);
  return { items, unread, seen };
}
