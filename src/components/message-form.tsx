"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendAnnouncement, sendMessage } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage } from "./ui";

export function MessageForm({ thread, announce = false, placeholder }: { thread?: string; announce?: boolean; placeholder?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(announce ? sendAnnouncement : sendMessage, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      {thread && <input type="hidden" name="thread" value={thread} />}
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          rows={announce ? 3 : 2}
          maxLength={2000}
          required
          className="input flex-1"
          placeholder={placeholder ?? t("Escribe un mensaje…")}
        />
        <button className="btn shrink-0 px-4" disabled={pending} aria-label={t("Enviar")}>
          {pending ? "…" : announce ? t("Publicar") : "➤"}
        </button>
      </div>
      {state?.error || (announce && state?.ok) ? <FormMessage state={state} /> : null}
    </form>
  );
}
