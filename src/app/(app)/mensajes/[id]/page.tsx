import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { MessageList, type Msg } from "@/components/message-list";
import { MessageForm } from "@/components/message-form";
import { Avatar } from "@/components/avatar";

/** Conversación del equipo con un atleta (solo coaches y admins). */
export default async function HiloPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> }) {
  const { id } = await params;
  const n = Math.min(500, Math.max(30, Number((await searchParams).n) || 30));
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await requireCoach();
  const { t, locale } = await getI18n();
  const [{ data: who }, { data }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("id", id).maybeSingle(),
    supabase
      .from("messages")
      .select("id, thread_user_id, sender_id, body, created_at, sender:profiles!messages_sender_id_fkey(full_name, avatar_url, role, is_admin)")
      .eq("thread_user_id", id)
      .order("created_at", { ascending: false })
      .limit(n + 1)
      .returns<Msg[]>(),
  ]);
  if (!who) notFound();
  // Al abrirlo, queda leído para todo el equipo
  const more = (data ?? []).length > n;
  const items = (data ?? []).slice(0, n).reverse();
  if (items.some((m) => m.sender_id === id)) await supabase.from("messages").update({ staff_read_at: new Date().toISOString() }).eq("thread_user_id", id).is("staff_read_at", null);


  return (
    <div className="space-y-4">
      <Link href="/mensajes" className="text-sm text-muted">‹ {t("Mensajes")}</Link>
      <Link href={`/atleta/${id}`} className="flex items-center gap-3">
        <Avatar name={who.full_name} url={who.avatar_url} size={48} />
        <h1 className="h-title truncate text-3xl">{who.full_name || t("Sin nombre")}</h1>
      </Link>
      {more && (
        <Link href={`/mensajes/${id}?n=${n + 30}`} scroll={false} className="block text-center text-sm text-muted underline">
          {t("Ver mensajes anteriores")}
        </Link>
      )}
      {items.length === 0 ? (
        <p className="card p-5 text-sm text-muted">{t("Aún no hay mensajes. Escríbele el primero.")}</p>
      ) : (
        <MessageList items={items} me={user.id} locale={locale} t={t} staffView />
      )}
      <div className="sticky bottom-24 rounded-xl border border-line bg-bg/95 p-2 backdrop-blur">
        <MessageForm thread={id} />
      </div>
    </div>
  );
}
