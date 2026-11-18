import Link from "next/link";
import { isCoachProfile, requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { MessageList, type Msg } from "@/components/message-list";
import { MessageForm } from "@/components/message-form";
import { Avatar } from "@/components/avatar";
import { AthletePicker } from "@/components/athlete-picker";

const SEL = "id, thread_user_id, sender_id, body, created_at, sender:profiles!messages_sender_id_fkey(full_name, avatar_url, role, is_admin)";

const PAGE = 30;

export default async function MensajesPage({ searchParams }: { searchParams: Promise<{ n?: string; arch?: string }> }) {
  const sp = await searchParams;
  const n = Math.min(500, Math.max(PAGE, Number(sp.n) || PAGE));
  const archived = sp.arch === "1";
  const { supabase, user, profile } = await requireUser();
  const { t, locale } = await getI18n();

  // ---------- Atleta: su conversación con el equipo + anuncios ----------
  if (!isCoachProfile(profile)) {
    const { data } = await supabase
      .from("messages")
      .select(SEL)
      .or(`thread_user_id.eq.${user.id},thread_user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(n + 1)
      .returns<Msg[]>();
    await supabase.from("profiles").update({ messages_seen_at: new Date().toISOString() }).eq("id", user.id);
    const more = (data ?? []).length > n;
    const items = (data ?? []).slice(0, n).reverse();
    return (
      <div className="space-y-4">
        <div>
          <h1 className="h-title text-5xl">{t("Mensajes")}</h1>
          <p className="mt-1 text-sm text-muted">{t("Habla con el equipo de tu box: dudas sobre la plani, tus resultados o lo que necesites. Te contesta cualquier coach.")}</p>
        </div>
        {more && (
          <Link href={`/mensajes?n=${n + PAGE}`} scroll={false} className="block text-center text-sm text-muted underline">
            {t("Ver mensajes anteriores")}
          </Link>
        )}
        {items.length === 0 ? (
          <p className="card p-5 text-sm text-muted">{t("Aún no hay mensajes. Escríbenos lo que quieras y te contestamos por aquí.")}</p>
        ) : (
          <MessageList items={items} me={user.id} locale={locale} t={t} staffView={false} />
        )}
        <div className="sticky bottom-24 rounded-xl border border-line bg-bg/95 p-2 backdrop-blur">
          <MessageForm />
        </div>
      </div>
    );
  }

  // ---------- Equipo: bandeja de conversaciones + anuncios ----------
  type Row = { thread_user_id: string; full_name: string; avatar_url: string | null; last_body: string; last_at: string; last_from_athlete: boolean; unread: number };
  const [{ data: inbox }, { data: ann }, { data: people }] = await Promise.all([
    supabase.rpc("staff_inbox", { p_archived: archived }),
    supabase.from("messages").select(SEL).is("thread_user_id", null).order("created_at", { ascending: false }).limit(5).returns<Msg[]>(),
    supabase.from("profiles").select("id, full_name").eq("active", true).neq("id", user.id).order("full_name"),
  ]);
  const threads = (inbox ?? []) as Row[];
  const fmt = (d: string) => new Date(d).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-title text-5xl">{t("Mensajes")}</h1>
        <p className="mt-1 text-sm text-muted">{t("Bandeja común de coaches y admins: cualquiera puede contestar y el atleta ve quién le escribe.")}</p>
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer list-none font-semibold">📣 {t("Enviar un anuncio a toda la comunidad")}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">{t("Le llega a todos los atletas en Mensajes y como notificación a quien tenga los avisos activados.")}</p>
          <MessageForm announce placeholder={t("Ej.: Este sábado no hay plani por el evento. ¡Nos vemos el lunes!")} />
          {(ann ?? []).length > 0 && (
            <div className="space-y-2 border-t border-line pt-3">
              <div className="text-xs uppercase tracking-wider text-muted">{t("Últimos anuncios")}</div>
              <MessageList items={[...(ann ?? [])].reverse()} me={user.id} locale={locale} t={t} staffView />
            </div>
          )}
        </div>
      </details>

      <section className="space-y-2">
        <h2 className="h-display text-xl">✉️ {t("Escribir a un atleta")}</h2>
        <AthletePicker people={(people ?? []).map((p) => ({ id: p.id as string, name: (p.full_name as string) || t("Sin nombre") }))} />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="h-display text-xl">{t("Conversaciones")}</h2>
          <div className="flex gap-2">
            <Link href="/mensajes" className={`chip ${archived ? "" : "chip-on"}`}>{t("Activas")}</Link>
            <Link href="/mensajes?arch=1" className={`chip ${archived ? "chip-on" : ""}`}>{t("Archivadas")}</Link>
          </div>
        </div>
        {archived && <p className="text-xs text-muted">{t("Conversaciones sin actividad en 60 días. Vuelven solas a Activas si el atleta escribe.")}</p>}
        {threads.length === 0 ? (
          <p className="card p-5 text-sm text-muted">{archived ? t("No hay conversaciones archivadas.") : t("Todavía no hay conversaciones.")}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {threads.map((c) => (
              <li key={c.thread_user_id}>
                <Link href={`/mensajes/${c.thread_user_id}`} className={`flex items-center gap-3 p-3 ${c.unread ? "bg-accent/10" : ""}`}>
                  <Avatar name={c.full_name} url={c.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{c.full_name || t("Sin nombre")}</span>
                      <span className="shrink-0 text-[11px] text-muted">{fmt(c.last_at)}</span>
                    </div>
                    <div className="truncate text-sm text-muted">
                      {!c.last_from_athlete && <span>{t("Equipo")}: </span>}
                      {c.last_body}
                    </div>
                  </div>
                  {c.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">{c.unread}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
