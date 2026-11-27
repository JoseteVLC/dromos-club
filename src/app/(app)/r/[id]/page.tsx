import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { notFound } from "next/navigation";
import { isCoachProfile, memberSince, requireUser } from "@/lib/supabase/server";
import { formatScore } from "@/lib/scoring";
import { dayHref, longDate } from "@/lib/dates";
import { deleteComment, deleteResult } from "@/app/actions";
import { ConfirmDelete } from "@/components/ui";
import { CommentForm } from "@/components/comments";
import { getI18n } from "@/lib/i18n/server";
import { Reactions, type ReactionSummary } from "@/components/reactions";
import { ReactableBubble } from "@/components/comment-reactions";
import type { CommentReaction } from "@/lib/comment-reactions";
import type { Result, Wod } from "@/lib/types";
import { signResultPhotos } from "@/lib/feed";

type Comment = { id: string; user_id: string; body: string; created_at: string; profiles: { full_name: string; avatar_url: string | null } | null };

export default async function ResultPage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const { supabase, user, profile } = await requireUser();
  const { t, locale } = await getI18n();
  const [{ data: result }, { data: comments }] = await Promise.all([
    supabase
      .from("results")
      .select("*, profiles!results_user_id_fkey(full_name, gender, avatar_url), wods(*), reactions(user_id, emoji)")
      .eq("id", id)
      .maybeSingle<Result & { wods: Wod; reactions: { user_id: string; emoji: string }[] }>(),
    supabase
      .from("result_comments")
      .select("id, user_id, body, created_at, profiles!result_comments_user_id_fkey(full_name, avatar_url)")
      .eq("result_id", id)
      .order("created_at")
      .returns<Comment[]>(),
  ]);
  if (!result) notFound();
  // Reacciones a los comentarios (si la migración 011 aún no está, simplemente no hay)
  const byComment = new Map<string, CommentReaction[]>();
  const commentIds = (comments ?? []).map((c) => c.id);
  if (commentIds.length) {
    const { data: cr } = await supabase
      .from("comment_reactions")
      .select("comment_id, user_id, emoji, profiles!comment_reactions_user_id_fkey(full_name)")
      .in("comment_id", commentIds)
      .order("created_at")
      .returns<{ comment_id: string; user_id: string; emoji: string; profiles: { full_name: string } | null }[]>();
    for (const x of cr ?? []) {
      byComment.set(x.comment_id, [...(byComment.get(x.comment_id) ?? []), { user_id: x.user_id, emoji: x.emoji, name: x.profiles?.full_name ?? "" }]);
    }
  }
  const wod = result.wods;
  const mine = result.user_id === user.id;
  const since = memberSince(profile);
  if (!mine && since && wod.wod_date < since) notFound();
  const reactions: ReactionSummary = {};
  for (const x of result.reactions ?? []) {
    const e = (reactions[x.emoji] ??= { count: 0, mine: false });
    e.count++;
    if (x.user_id === user.id) e.mine = true;
  }
  const canModerate = isCoachProfile(profile);
  const photo = (await signResultPhotos([result])).get(result.id);
  const name = result.profiles?.full_name || t("Sin nombre");

  return (
    <div className="space-y-5">
      <Link href={dayHref(wod.wod_date, { w: wod.id }) + "#leaderboard"} className="text-sm text-muted">
        ‹ {wod.part} · {wod.title}
      </Link>

      <div className="card space-y-3 p-5">
        <div className="text-xs uppercase tracking-wider text-muted">{longDate(wod.wod_date, locale)}</div>
        <div className="flex items-end justify-between gap-3">
          <Link href={`/atleta/${result.user_id}`} className="flex min-w-0 items-center gap-3">
            <Avatar name={name} url={result.profiles?.avatar_url} size={52} />
            <div className="min-w-0">
            <div className="h-title truncate text-3xl">{name}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              {wod.score_type !== "load" && <span className="rounded bg-line px-1.5 py-0.5 font-semibold uppercase">{result.division}</span>}
              {result.profiles?.gender && <span>{result.profiles.gender === "M" ? "♂" : "♀"}</span>}
            </div>
            </div>
          </Link>
          <div className="h-display text-4xl tabular-nums text-accent">{formatScore(wod, result)}</div>
        </div>
        {result.effort != null && <p className="text-xs text-muted">{t("Esfuerzo {n}/10", { n: result.effort })}</p>}
        {result.notes && <p className="text-sm text-muted">{result.notes}</p>}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t("Foto de {name}", { name })} className="max-h-[75vh] w-full rounded-xl object-cover" />
        )}
        <div className="flex items-center justify-between">
          <Reactions resultId={result.id} initial={reactions} own={mine} />
          {(mine || canModerate) && (
            <form action={deleteResult} className="text-xs">
              <input type="hidden" name="id" value={result.id} />
              <input type="hidden" name="back" value={dayHref(wod.wod_date, { w: wod.id })} />
              <ConfirmDelete label={t("Borrar resultado")} confirmLabel={t("¿Borrar resultado?")} className="text-xs" />
            </form>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="h-display text-xl">{t("Comentarios")} {comments?.length ? `· ${comments.length}` : ""}</h2>
        {(comments ?? []).length === 0 && (
          <p className="text-sm text-muted">{mine ? t("Aún nadie ha comentado tu resultado.") : t("Sé el primero en decirle algo a {name}.", { name: name.split(" ")[0] })}</p>
        )}
        <ul className="space-y-2">
          {(comments ?? []).map((c) => {
            const own = c.user_id === user.id;
            return (
              <li key={c.id} className={`flex items-end gap-2 ${own ? "justify-end" : ""}`}>
                {!own && (
                  <Link href={`/atleta/${c.user_id}`}>
                    <Avatar name={c.profiles?.full_name} url={c.profiles?.avatar_url} size={28} />
                  </Link>
                )}
                <ReactableBubble
                  commentId={c.id}
                  me={user.id}
                  myName={profile?.full_name ?? ""}
                  own={own}
                  initial={byComment.get(c.id) ?? []}
                  className={`rounded-2xl px-3 py-2 ${own ? "bg-accent/15" : "bg-card border border-line"}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-semibold">{own ? t("Tú") : c.profiles?.full_name || t("Sin nombre")}</span>
                    <span className="text-muted">
                      {new Date(c.created_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[15px]">{c.body}</p>
                  {(own || canModerate) && (
                    <form action={deleteComment} className="text-right">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="result_id" value={result.id} />
                      <ConfirmDelete label={t("Borrar")} className="text-[11px] underline" />
                    </form>
                  )}
                </ReactableBubble>
              </li>
            );
          })}
        </ul>
        <CommentForm resultId={result.id} placeholder={mine ? t("Responde…") : t("Escríbele a {name}…", { name: name.split(" ")[0] })} />
      </section>
    </div>
  );
}
