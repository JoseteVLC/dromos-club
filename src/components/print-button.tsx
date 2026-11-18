"use client";

import { useI18n } from "@/lib/i18n/client";

export function PrintButton() {
  const { t } = useI18n();
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#0C0D10] px-4 py-2 text-sm font-semibold text-white">
      🖨️ {t("Imprimir o guardar PDF")}
    </button>
  );
}
