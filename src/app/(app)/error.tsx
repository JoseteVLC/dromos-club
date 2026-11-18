"use client";

import { useI18n } from "@/lib/i18n/client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card space-y-3 p-6 text-center">
      <p className="h-title text-2xl">{t("Algo ha fallado")}</p>
      <p className="text-sm text-muted">{t("Vuelve a intentarlo. Si sigue pasando, mándanos este código:")}</p>
      <p className="font-mono text-xs text-muted">{error.digest ?? error.message}</p>
      <button type="button" onClick={reset} className="btn w-full">{t("Reintentar")}</button>
    </div>
  );
}
