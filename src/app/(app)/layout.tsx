import Link from "next/link";
import { isCoachProfile, requireUser } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { AppScroller } from "@/components/app-scroller";
import { getI18n } from "@/lib/i18n/server";
import { getNotices } from "@/lib/notifications";
import { NoticeBanner } from "@/components/notice-banner";
import { UnreadBadge } from "@/components/unread-badge";
import { PushPrompt } from "@/components/push-prompt";
import { BRAND } from "@/lib/brand";
import { Icon } from "@/components/icon";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { supabase, user, profile, box } = await requireUser();
  const noticesP = getNotices(supabase, user.id, 30, true);
  const isCoach = isCoachProfile(profile);
  const { t } = await getI18n();
  // Mensajes sin leer: para el equipo, los de atletas sin contestar; para el atleta, los del equipo y anuncios nuevos
  const msgsP = isCoach
    ? supabase.from("messages").select("created_at").is("staff_read_at", null).not("thread_user_id", "is", null).order("created_at", { ascending: false }).limit(50)
    : supabase
        .from("messages")
        .select("created_at")
        .or(`thread_user_id.eq.${user.id},thread_user_id.is.null`)
        .neq("sender_id", user.id)
        .gt("created_at", profile?.messages_seen_at ?? "1970-01-01")
        .order("created_at", { ascending: false })
        .limit(50);
  const [{ unread: fresh }, { data: unreadMsgs }] = await Promise.all([noticesP, msgsP]);
  const unread = fresh.length;
  const latest = fresh.reduce<string | null>((m, n) => (m && m > n.at ? m : n.at), null);
  const names = [...new Set(fresh.map((n) => n.who).filter(Boolean))];
  const msgCount = unreadMsgs?.length ?? 0;
  const msgLatest = (unreadMsgs?.[0]?.created_at as string | undefined) ?? null;

  return (
    // Pantalla fija: solo se mueve el contenido de arriba y el menú va debajo, fuera del scroll.
    // Así en iPhone el menú no se queda a media pantalla al hacer scroll (pasaba con el menú «fixed»).
    <div className={`fixed inset-x-0 bottom-0 flex flex-col ${process.env.VERCEL_ENV === "preview" ? "top-5" : "top-0"}`}>
      <AppScroller>
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${box.name} · ${BRAND.name}`}>
          {box.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={box.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={BRAND.mark} alt="" className="h-6 w-auto shrink-0" />
          )}
          <span className="truncate font-display text-base font-bold uppercase tracking-wide">{box.name}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {profile?.is_admin && (
            <Link href="/admin" className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Admin
            </Link>
          )}
          <Link href="/mensajes" className="relative flex h-11 w-11 items-center justify-center rounded-full text-fg active:bg-line" aria-label={t("Mensajes")}>
            <Icon name="mail" size={26} />
            <UnreadBadge count={msgCount} latest={msgLatest} prefix="/mensajes" />
          </Link>
          <Link href="/avisos" className="relative flex h-11 w-11 items-center justify-center rounded-full text-fg active:bg-line" aria-label={t("Avisos")}>
            <Icon name="bell" size={26} />
            <UnreadBadge count={unread} latest={latest} />
          </Link>
        </div>
      </header>
      {!profile?.gender && (
        <Link href="/perfil" className="mx-4 mt-3 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm">
          {t("Completa tu perfil (nombre y categoría) para salir bien en el leaderboard →")}
        </Link>
      )}
      <PushPrompt />
      <NoticeBanner
        count={unread}
        latest={latest}
        names={names}
        hasComments={fresh.some((n) => n.kind === "comment")}
        medals={fresh.filter((n) => n.kind === "medal").length}
      />
      <main className="flex-1 px-4 pb-6 pt-4">{children}</main>
    </div>
      </AppScroller>
      <BottomNav isCoach={isCoach} competition={box.competition} />
    </div>
  );
}
