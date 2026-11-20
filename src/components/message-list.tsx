import { Avatar } from "./avatar";
import { deleteMessage } from "@/app/actions";
import { Icon } from "@/components/icon";

export type Msg = {
  id: string;
  thread_user_id: string | null;
  sender_id: string;
  body: string;
  created_at: string;
  sender: { full_name: string; avatar_url: string | null } | null;
};

/** Conversación tipo chat. Los mensajes del equipo llevan el nombre de quien escribe; los anuncios, 📣. */
export function MessageList({ items, me, locale, t, staffView }: { items: Msg[]; me: string; locale: string; t: (k: string) => string; staffView: boolean }) {
  if (!items.length) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  return (
    <ul className="space-y-3">
      {items.map((m) => {
        const own = m.sender_id === me;
        const announce = m.thread_user_id === null;
        // En una conversación, todo lo que no escribe el propio atleta lo escribe el equipo del box
        const fromStaff = m.sender_id !== m.thread_user_id;
        // En la vista del equipo, "nuestro lado" son todos los mensajes del equipo
        const right = staffView ? fromStaff : own;
        if (announce)
          return (
            <li key={m.id} className="rounded-xl border border-accent/40 bg-accent/10 p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-accent"><Icon name="megaphone" size={15} /> {t("Anuncio")} · {m.sender?.full_name}</span>
                <span className="text-muted">{fmt(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
            </li>
          );
        return (
          <li key={m.id} className={`flex items-end gap-2 ${right ? "justify-end" : ""}`}>
            {!right && <Avatar name={m.sender?.full_name} url={m.sender?.avatar_url} size={28} />}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${right ? "rounded-br-sm bg-accent text-accent-fg" : "rounded-bl-sm border border-line bg-card"}`}>
              {!own && (
                <div className={`mb-0.5 text-xs font-semibold ${right ? "text-accent-fg/70" : "text-accent"}`}>
                  {m.sender?.full_name}
                  {fromStaff && !staffView && <span className="font-normal opacity-80"> · {t("Equipo del box")}</span>}
                </div>
              )}
              <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
              <div className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${right ? "text-accent-fg/60" : "text-muted"}`}>
                {fmt(m.created_at)}
                {own && (
                  <form action={deleteMessage}>
                    <input type="hidden" name="id" value={m.id} />
                    <button aria-label={t("Borrar")}>🗑</button>
                  </form>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
