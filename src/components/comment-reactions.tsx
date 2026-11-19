"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { setCommentReaction } from "@/app/actions";
import { COMMENT_EMOJIS, type CommentReaction } from "@/lib/comment-reactions";
import { useI18n } from "@/lib/i18n/client";

/**
 * Burbuja de comentario con reacciones al estilo WhatsApp:
 * mantén pulsado (o toca ☺) para elegir un emoji; una reacción por persona; tocar la tuya la quita.
 */
export function ReactableBubble({
  commentId,
  me,
  myName,
  own,
  initial,
  className,
  children,
  react = setCommentReaction,
}: {
  /** Acción que guarda la reacción (por defecto, la de los comentarios de resultados) */
  react?: (commentId: string, emoji: string | null) => Promise<void>;
  commentId: string;
  me: string;
  myName: string;
  own: boolean;
  initial: CommentReaction[];
  className: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open && !who) return;
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        setWho(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, who]);

  const mine = list.find((r) => r.user_id === me)?.emoji ?? null;

  const pick = (emoji: string) => {
    const before = list;
    const next = emoji === mine ? null : emoji;
    const rest = list.filter((r) => r.user_id !== me);
    setList(next ? [...rest, { user_id: me, emoji: next, name: myName }] : rest);
    setOpen(false);
    react(commentId, next).catch(() => setList(before));
  };

  const startPress = () => {
    timer.current = setTimeout(() => {
      setOpen(true);
      navigator.vibrate?.(15);
    }, 450);
  };
  const endPress = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // Agrupado por emoji, el más usado primero
  const groups = COMMENT_EMOJIS.map((e) => ({ e, people: list.filter((r) => r.emoji === e) }))
    .filter((g) => g.people.length)
    .sort((a, b) => b.people.length - a.people.length);

  return (
    <div ref={box} className={`relative flex max-w-[85%] flex-col ${own ? "items-end" : "items-start"}`}>
      {open && (
        <div
          role="group"
          aria-label={t("Reaccionar al comentario")}
          className={`absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border border-line bg-card p-1 shadow-lg ${own ? "right-0" : "left-0"}`}
        >
          {COMMENT_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => pick(e)}
              aria-label={`${t("Reaccionar")} ${e}`}
              aria-pressed={mine === e}
              className={`grid h-11 w-11 place-items-center rounded-full text-2xl transition active:scale-90 ${mine === e ? "bg-accent/25" : "hover:bg-line"}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className={`flex items-center gap-1 ${own ? "flex-row-reverse" : ""}`}>
        <div
          className={`${className} select-none`}
          style={{ WebkitTouchCallout: "none" }}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          {children}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t("Reaccionar al comentario")}
          aria-expanded={open}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted opacity-70 transition hover:bg-line hover:opacity-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8" />
            <circle cx="9" cy="10" r="0.6" fill="currentColor" />
            <circle cx="15" cy="10" r="0.6" fill="currentColor" />
          </svg>
        </button>
      </div>

      {groups.length > 0 && (
        <button
          type="button"
          onClick={() => setWho((w) => !w)}
          aria-expanded={who}
          aria-label={t("Ver quién ha reaccionado")}
          className={`-mt-2 flex items-center gap-0.5 rounded-full border border-line bg-card px-1.5 py-0.5 text-sm shadow-sm ${own ? "mr-10" : "ml-3"} ${mine ? "ring-1 ring-accent" : ""}`}
        >
          {groups.map((g) => (
            <span key={g.e}>{g.e}</span>
          ))}
          {list.length > 1 && <span className="ml-0.5 text-xs tabular-nums text-muted">{list.length}</span>}
        </button>
      )}

      {who && groups.length > 0 && (
        <ul className="mt-1 space-y-0.5 rounded-xl border border-line bg-card px-3 py-2 text-sm shadow-sm">
          {groups.flatMap((g) =>
            g.people.map((p) => (
              <li key={p.user_id} className="flex items-center gap-2">
                <span>{g.e}</span>
                <span className="flex-1">{p.user_id === me ? t("Tú") : p.name || t("Sin nombre")}</span>
                {p.user_id === me && (
                  <button type="button" onClick={() => pick(g.e)} className="text-xs text-muted underline">
                    {t("Quitar")}
                  </button>
                )}
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}
