"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { addWodComment } from "@/app/actions";
import { FormMessage } from "./ui";
import { useI18n } from "@/lib/i18n/client";

/** Sección plegable; se abre sola si llegas desde un aviso (…#dudas). */
export function DudasDetails({ count, label, children }: { count: number; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.location.hash === "#dudas" && ref.current) {
      ref.current.open = true;
      setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, []);
  return (
    <details id="dudas" ref={ref} className="card group p-4" data-noswipe>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
        <span>💬 {label}{count ? ` · ${count}` : ""}</span>
        <span className="text-muted transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

export function WodCommentForm({ wodId, placeholder }: { wodId: string; placeholder: string }) {
  const [state, action, pending] = useActionState(addWodComment, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="wod_id" value={wodId} />
      <div className="flex gap-2">
        <textarea name="body" rows={2} maxLength={500} required placeholder={placeholder} className="input resize-none" />
        <button disabled={pending} className="btn shrink-0 self-end px-3" aria-label={t("Enviar")}>
          {pending ? "…" : "↑"}
        </button>
      </div>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
