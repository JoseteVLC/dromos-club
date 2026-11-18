"use client";

import { useState } from "react";
import { setReaction } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

export const EMOJIS = ["👊", "🔥"] as const;
export type ReactionSummary = Record<string, { count: number; mine: boolean }>;

export function Reactions({ resultId, initial, own }: { resultId: string; initial: ReactionSummary; own: boolean }) {
  const [state, setState] = useState(initial);
  const { t } = useI18n();

  const toggle = (emoji: string) => {
    const cur = state[emoji] ?? { count: 0, mine: false };
    const on = !cur.mine;
    setState((s) => ({ ...s, [emoji]: { count: Math.max(0, cur.count + (on ? 1 : -1)), mine: on } }));
    setReaction(resultId, emoji, on).catch(() => {
      // Si falla, deshacemos el cambio
      setState((s) => ({ ...s, [emoji]: cur }));
    });
  };

  return (
    <div className="flex gap-1.5" data-noswipe>
      {EMOJIS.map((e) => {
        const r = state[e] ?? { count: 0, mine: false };
        if (own && r.count === 0) return null; // en tu propio resultado solo ves lo que te han dado
        return (
          <button
            key={e}
            type="button"
            disabled={own}
            onClick={() => toggle(e)}
            className={`flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border px-3 text-base transition ${
              r.mine ? "border-accent bg-accent/15 text-fg" : "border-line text-muted"
            } ${own ? "cursor-default" : "hover:border-muted active:scale-95"}`}
            aria-label={`${t("Reaccionar")} ${e}`}
            aria-pressed={r.mine}
          >
            <span className={r.count ? "" : "opacity-50 grayscale"}>{e}</span>
            {r.count > 0 && <span className="tabular-nums">{r.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
