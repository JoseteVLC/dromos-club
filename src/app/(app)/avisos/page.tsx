import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { getNotices } from "@/lib/notifications";
import { MEDAL_BY_CODE } from "@/lib/medals";
import { MedalBadge } from "@/components/medal-badge";


export default async function AvisosPage() {
  const { supabase, user } = await requireUser();
  const { t, locale } = await getI18n();
  const { items, seen } = await getNotices(supabase, user.id, 60);

  // Marcar como vistos
  await supabase.from("profiles").update({ notifications_seen_at: new Date().toISOString() }).eq("id", user.id);

  return (
    <div className="space-y-5">
      <h1 className="h-title text-5xl">{t("Avisos")}</h1>
      {items.length === 0 ? (
        <p className="card p-6 text-center text-muted">{t("Cuando alguien comente o reaccione a tus resultados lo verás aquí.")}</p>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((n) => {
            const isNew = n.at > seen;
            if (n.kind === "medal") {
              const m = MEDAL_BY_CODE.get(n.code);
              if (!m) return null;
              return (
                <li key={n.id}>
                  <Link href="/medallas" className={`flex items-center gap-3 p-4 ${isNew ? "bg-accent/10" : ""}`}>
                    <MedalBadge medal={m} unlocked size={44} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-sm">
                        {t("¡Medalla desbloqueada!")} <b>{t(m.name)}</b>
                        {m.reward && <span className="ml-1">🎁</span>}
                      </div>
                      <div className="text-xs text-muted">
                        {t(m.desc)}
                        {isNew && <span className="ml-2 font-semibold text-accent">{t("Nuevo")}</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            }
            const wod = n.wod ?? t("un WOD");
            return (
              <li key={n.id}>
                <Link href={`/r/${n.resultId}`} className={`flex gap-3 p-4 ${isNew ? "bg-accent/10" : ""}`}>
                  <span className="text-xl">{n.kind === "comment" ? "💬" : n.emoji}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-sm">
                      <b>{n.who || t("Alguien")}</b>{" "}
                      <span className="text-muted">
                        {n.kind === "reaction"
                          ? t("ha reaccionado a tu resultado en {wod}", { wod })
                          : n.kind === "creaction"
                            ? t("ha reaccionado a tu comentario en {wod}", { wod })
                            : t(n.onMine ? "ha comentado tu resultado en {wod}" : "ha respondido en {wod}", { wod })}
                      </span>
                    </div>
                    {n.kind === "comment" && <p className="line-clamp-2 text-[15px]">“{n.body}”</p>}
                    {n.kind === "creaction" && <p className="line-clamp-1 text-sm text-muted">“{n.body}”</p>}
                    <div className="text-xs text-muted">
                      {new Date(n.at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
                      {isNew && <span className="ml-2 font-semibold text-accent">{t("Nuevo")}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
