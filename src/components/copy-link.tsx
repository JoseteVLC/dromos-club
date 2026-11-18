"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Enlace con botón de copiar. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-bg px-2 py-1.5 text-xs">{url}</code>
      <button
        type="button"
        className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {}
        }}
      >
        {copied ? t("✓ Copiado") : t("Copiar enlace")}
      </button>
    </div>
  );
}
