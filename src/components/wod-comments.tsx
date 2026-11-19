import Link from "next/link";
import { deleteWodComment, pinWodComment, setWodCommentReaction } from "@/app/actions";
import { Avatar } from "./avatar";
import { ConfirmDelete } from "./ui";
import { ReactableBubble } from "./comment-reactions";
import { DudasDetails, WodCommentForm } from "./wod-comment-form";
import type { CommentReaction } from "@/lib/comment-reactions";
import type { T } from "@/lib/i18n/core";

export type WodComment = {
  id: string;
  user_id: string;
  body: string;
  pinned: boolean;
  created_at: string;
  profiles: { full_name: string; avatar_url: string | null } | null;
};

/** «💬 Dudas del WOD»: preguntas y respuestas en el propio WOD; lo del coach destacado y la respuesta buena fijada arriba. */
export function WodComments({
  wodId,
  comments,
  reactions,
  staff,
  me,
  myName,
  isCoach,
  t,
  locale,
}: {
  wodId: string;
  comments: WodComment[];
  reactions: Map<string, CommentReaction[]>;
  staff: Set<string>;
  me: string;
  myName: string;
  isCoach: boolean;
  t: T;
  locale: string;
}) {
  const sorted = [...comments].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.created_at.localeCompare(b.created_at));
  return (
    <DudasDetails count={comments.length} label={t("Dudas del WOD")}>
      {sorted.length === 0 && <p className="text-sm text-muted">{t("¿Alguna duda con el WOD (pesos, escalado, estándares)? Pregunta aquí y te contesta el equipo o el resto del box.")}</p>}
      <ul className="space-y-3">
        {sorted.map((c) => {
          const own = c.user_id === me;
          const coach = staff.has(c.user_id);
          return (
            <li key={c.id} className={`flex items-end gap-2 ${own ? "flex-row-reverse" : ""}`}>
              {!own && (
                <Link href={`/atleta/${c.user_id}`}>
                  <Avatar name={c.profiles?.full_name} url={c.profiles?.avatar_url} size={28} />
                </Link>
              )}
              <ReactableBubble
                react={setWodCommentReaction}
                commentId={c.id}
                me={me}
                myName={myName}
                own={own}
                initial={reactions.get(c.id) ?? []}
                className={`rounded-2xl px-3 py-2 ${c.pinned ? "border-2 border-accent bg-accent/10" : coach ? "border border-accent/50 bg-card" : own ? "bg-accent/15" : "border border-line bg-card"}`}
              >
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {own ? t("Tú") : c.profiles?.full_name || t("Sin nombre")}
                    {coach && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-bg">Coach</span>}
                    {c.pinned && <span className="text-accent">📌 {t("Fijada")}</span>}
                  </span>
                  <span className="text-muted">
                    {new Date(c.created_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-[15px]">{c.body}</p>
                {(own || isCoach) && (
                  <div className="flex items-center justify-end gap-3 text-[11px]">
                    {isCoach && (
                      <form action={pinWodComment}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="underline">{c.pinned ? t("Soltar") : `📌 ${t("Fijar")}`}</button>
                      </form>
                    )}
                    <form action={deleteWodComment}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmDelete label={t("Borrar")} className="text-[11px] underline" />
                    </form>
                  </div>
                )}
              </ReactableBubble>
            </li>
          );
        })}
      </ul>
      <WodCommentForm wodId={wodId} placeholder={sorted.length ? t("Responde o pregunta algo…") : t("Escribe tu duda…")} />
    </DudasDetails>
  );
}
