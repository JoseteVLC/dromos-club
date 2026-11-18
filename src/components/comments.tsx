"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment } from "@/app/actions";
import { FormMessage } from "./ui";
import { useI18n } from "@/lib/i18n/client";

export function CommentForm({ resultId, placeholder }: { resultId: string; placeholder: string }) {
  const [state, action, pending] = useActionState(addComment, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="result_id" value={resultId} />
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
