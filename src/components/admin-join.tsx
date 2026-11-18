import { resolveJoinRequest, rotateJoinCode, setJoinMode } from "@/app/actions";
import { Avatar } from "./avatar";
import { CopyLink } from "./copy-link";
import type { T } from "@/lib/i18n/core";

export type JoinRequest = { id: string; full_name: string; avatar_url: string | null; email: string; at: string };

/** Admin → Unirse con QR: el QR, el cartel y las solicitudes pendientes. */
export function AdminJoin({ svg, url, mode, requests, t, locale }: { svg: string; url: string; mode: "approval" | "open"; requests: JoinRequest[]; t: T; locale: string }) {
  return (
    <section className="space-y-3">
      <h2 className="h-display text-xl">{t("Unirse con QR")}</h2>

      {requests.length > 0 && (
        <div className="card divide-y divide-line border-accent/60">
          <p className="p-4 text-sm font-semibold">{t("Quieren unirse")} · {requests.length}</p>
          {requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4">
              <Avatar name={r.full_name} url={r.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.full_name || r.email}</div>
                <div className="truncate text-xs text-muted">{r.email} · {new Date(r.at).toLocaleDateString(locale)}</div>
              </div>
              <form action={resolveJoinRequest}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="ok" value="0" />
                <button className="btn-ghost px-3 py-2 text-sm text-muted">{t("Rechazar")}</button>
              </form>
              <form action={resolveJoinRequest}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="ok" value="1" />
                <button className="btn px-3 py-2 text-sm">{t("Aceptar")}</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-4 p-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="w-40 shrink-0 overflow-hidden rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="min-w-0 space-y-2 text-sm">
            <p className="text-muted">{t("Cuélgalo en la pizarra o en recepción: quien lo escanee se crea la cuenta y entra en tu box.")}</p>
            <CopyLink url={url} />
            <div className="flex flex-wrap gap-2 pt-1">
              <a href="/cartel" target="_blank" className="btn px-3 py-2 text-sm">🖨️ {t("Cartel para imprimir")}</a>
              <form action={rotateJoinCode}>
                <button className="btn-ghost px-3 py-2 text-sm">{t("Cambiar código")}</button>
              </form>
            </div>
          </div>
        </div>
        <form action={setJoinMode} className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
          <span className="text-muted">{t("Quién entra:")}</span>
          <button name="mode" value="approval" className={`chip ${mode === "approval" ? "chip-on" : ""}`}>{t("Con mi aprobación")}</button>
          <button name="mode" value="open" className={`chip ${mode === "open" ? "chip-on" : ""}`}>{t("Directo")}</button>
        </form>
        <p className="text-xs text-muted">{t("«Cambiar código» invalida el QR anterior (por si se ha compartido fuera del box).")}</p>
      </div>
    </section>
  );
}
