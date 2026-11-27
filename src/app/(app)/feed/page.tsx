import Link from "next/link";
import { memberSince, requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { formatScore } from "@/lib/scoring";
import { dayHref } from "@/lib/dates";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icon";
import { Reactions, type ReactionSummary } from "@/components/reactions";
import { getLegends, legendsByUser, signResultPhotos } from "@/lib/feed";
import type { Result, Wod } from "@/lib/types";

type Row = Result & {
  updated_at: string;
  wods: Pick<Wod, "id" | "title" | "part" | "wod_date" | "score_type" | "score_label" | "score2_type" | "score2_label" | "score2_name" | "score_name">;
  reactions: { user_id: string; emoji: string }[];
  result_comments: { count: number }[];
};

const PAGE = 20;

/**
 * Feed del box: los resultados del box, del más nuevo al más antiguo,
 * con su foto si la hay, esfuerzo, reacciones (que suman en el perfil) y comentarios.
 * «Siguiendo»: solo los compañeros que sigues.
 */
export default async function FeedPage({ searchParams }: { searchParams: Promise<{ ver?: string; antes?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile, box } = await requireUser();
  const { t, locale } = await getI18n();
  const following = sp.ver === "siguiendo";
  const before = sp.antes && !Number.isNaN(Date.parse(sp.antes)) ? sp.antes : null;

  const { data: follows } = await supabase.from("follows").select("followee_id").eq("follower_id", user.id);
  const followIds = (follows ?? []).map((f) => f.followee_id as string);

  let rows: Row[] = [];
  if (!following || followIds.length) {
    let q = supabase
      .from("results")
      .select(
        "id, wod_id, user_id, division, finished, time_seconds, rounds, reps, value, value2, notes, created_at, updated_at, photo_path, effort, " +
          "profiles!results_user_id_fkey(full_name, gender, avatar_url), " +
          "wods!inner(id, title, part, wod_date, score_type, score_label, score2_type, score2_label, score2_name, score_name), " +
          "reactions(user_id, emoji), result_comments(count)",
      )
      .eq("box_id", box.id)
      .neq("wods.score_type", "check")
      .order("created_at", { ascending: false })
      .limit(PAGE + 1);
    const since = memberSince(profile);
    if (since) q = q.gte("wods.wod_date", since);
    if (before) q = q.lt("created_at", before);
    if (following) q = q.in("user_id", followIds);
    const { data } = await q.returns<Row[]>();
    rows = data ?? [];
  }
  const more = rows.length > PAGE;
  rows = rows.slice(0, PAGE);

  // En modo competición no hay gamificación: sin Leyendas
  const [photos, legends] = await Promise.all([signResultPhotos(rows), box.competition ? Promise.resolve([]) : getLegends(supabase)]);
  const crowns = legendsByUser(legends);
  const boxLegend = legends.find((l) => l.kind === "box");
  const boxLegendName = boxLegend ? (await supabase.from("profiles").select("full_name").eq("id", boxLegend.user_id).maybeSingle<{ full_name: string }>()).data?.full_name : null;

  const tab = (on: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold ${on ? "bg-accent text-accent-fg" : "border border-line text-muted"}`;
  const when = (iso: string) => timeAgo(iso, t, locale);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="h-display text-3xl">{t("Feed")}</h1>
        <div className="flex gap-2">
          <Link href="/feed" className={tab(!following)}>{t("Todos")}</Link>
          <Link href="/feed?ver=siguiendo" className={tab(following)}>{t("Siguiendo")}</Link>
        </div>
      </div>

      {boxLegend && boxLegendName && !before && (
        <Link href={`/atleta/${boxLegend.user_id}`} className="card flex items-center gap-3 border-accent/40 p-3 text-sm">
          <span className="text-2xl" aria-hidden>👑</span>
          <span>
            <b>{t("Leyenda del box")}:</b> {boxLegendName} · <span className="text-muted">{t("{n} días entrenados en los últimos 30", { n: boxLegend.n })}</span>
          </span>
        </Link>
      )}

      {rows.length === 0 && (
        <p className="card p-6 text-center text-sm text-muted">
          {following
            ? followIds.length
              ? t("Las personas que sigues aún no han metido resultados.")
              : t("Aún no sigues a nadie. Entra en la ficha de un compañero y dale a «Seguir».")
            : t("Aún no hay resultados en el feed.")}
        </p>
      )}

      <ul className="space-y-4">
        {rows.map((r) => {
          const w = r.wods;
          const mine = r.user_id === user.id;
          const name = r.profiles?.full_name || t("Sin nombre");
          const summary: ReactionSummary = {};
          for (const x of r.reactions ?? []) {
            const e = (summary[x.emoji] ??= { count: 0, mine: false });
            e.count++;
            if (x.user_id === user.id) e.mine = true;
          }
          const nComments = r.result_comments?.[0]?.count ?? 0;
          const crown = crowns.get(r.user_id);
          const photo = photos.get(r.id);
          return (
            <li key={r.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-3 pb-2">
                <Link href={`/atleta/${r.user_id}`}>
                  <Avatar name={name} url={r.profiles?.avatar_url} size={40} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/atleta/${r.user_id}`} className="flex items-center gap-1 truncate font-semibold">
                    <span className="truncate">{mine ? t("Tú") : name}</span>
                    {crown && <span title={crown.map((l) => (l.kind === "box" ? t("Leyenda del box") : t("Leyenda de {w}", { w: l.label }))).join(" · ")}>👑</span>}
                  </Link>
                  <Link href={dayHref(w.wod_date, { w: w.id })} className="block truncate text-xs text-muted">
                    {w.part} · {w.title} · {when(r.created_at ?? r.updated_at)}
                  </Link>
                </div>
              </div>

              {photo && (
                <Link href={`/r/${r.id}`} className="block bg-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={t("Foto de {name}", { name })} loading="lazy" className="max-h-[70vh] w-full object-cover" />
                </Link>
              )}

              <div className="space-y-2 p-3 pt-2">
                <Link href={`/r/${r.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {r.division === "scaled" ? (
                    // Escalado: sin marcar como «peor», solo que lo ha hecho a su medida
                    <>
                      <span className="h-display text-3xl">✓ {t("Hecho")}</span>
                      <span className="rounded border border-line px-1.5 py-0.5 text-xs text-muted">{t("Adaptado")}</span>
                    </>
                  ) : (
                    <>
                      <span className="h-display text-3xl tabular-nums text-accent">{formatScore(w, r)}</span>
                      {w.score_type !== "load" && <span className="rounded bg-line px-1.5 py-0.5 text-xs font-semibold uppercase">{r.division}</span>}
                    </>
                  )}
                  {r.effort != null && <span className="text-xs text-muted">{t("Esfuerzo {n}/10", { n: r.effort })}</span>}
                </Link>
                {r.notes && <p className="text-sm text-muted">{r.notes}</p>}
                <div className="flex items-center gap-1.5">
                  <Reactions resultId={r.id} initial={summary} own={mine} />
                  <Link
                    href={`/r/${r.id}`}
                    className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-3 text-base ${nComments ? "border-accent/60 text-fg" : "border-line text-muted"}`}
                    aria-label={t("Comentarios")}
                  >
                    <Icon name="comment" size={15} />
                    {nComments ? <span className="tabular-nums">{nComments}</span> : null}
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {more && rows.length > 0 && (
        <Link
          href={`/feed?${new URLSearchParams({ ...(following ? { ver: "siguiendo" } : {}), antes: rows[rows.length - 1].created_at ?? "" })}`}
          className="btn-ghost block w-full py-2.5 text-center"
        >
          {t("Ver más")}
        </Link>
      )}
    </div>
  );
}

/** «hace 5 min», «hace 3 h» o la fecha */
function timeAgo(iso: string, t: (k: string, v?: Record<string, string | number>) => string, locale: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return t("ahora");
  if (m < 60) return t("hace {n} min", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t("hace {n} h", { n: h });
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
}
