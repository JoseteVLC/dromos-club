import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/server";
import { adminDb, boxPeople, emailsOf, hasAdminKey } from "@/lib/supabase/admin";
import { boxUrl } from "@/lib/box-shared";
import { BoxSettingsForm } from "@/components/box-settings-form";
import { siteUrl } from "@/lib/site";
import { deleteInvitation, setRewardDelivered, setUserFlag } from "@/app/actions";
import { MEDAL_BY_CODE, REWARD_CODES } from "@/lib/medals";
import { MedalBadge } from "@/components/medal-badge";
import { InviteForm, ShareInvite } from "@/components/admin-invite";
import { ConfirmDelete } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";
import { daysAgoISO } from "@/lib/dates";
import { AdminJoin, type JoinRequest } from "@/components/admin-join";
import { AdminInactive } from "@/components/admin-inactive";
import { joinUrl, qrSvg } from "@/lib/qr";

type Person = {
  id: string;
  full_name: string;
  role: "athlete" | "coach";
  is_admin: boolean;
  active: boolean;
  gender: "M" | "F" | null;
  created_at: string;
};
type Invitation = { id: string; token: string; email: string; first_name: string; last_name: string; role: string; created_at: string };

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { user, box } = await requireAdmin();
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const filter = sp.f === "inactivos" ? "inactivos" : sp.f === "todos" ? "todos" : "activos";
  const q = String(sp.q ?? "").trim().toLowerCase();

  if (!hasAdminKey())
    return (
      <div className="space-y-4">
        <h1 className="h-title text-5xl">Admin</h1>
        <p className="card p-4 text-sm">
          {t("Falta la variable SUPABASE_SECRET_KEY en Vercel. Añádela (Supabase → Project Settings → API Keys → Secret key) y haz Redeploy.")}
        </p>
      </div>
    );

  const db = adminDb();
  const [{ people: peopleList, error: peopleErr }, { data: invites, error: invErr }, { data: lastRes }] = await Promise.all([
    boxPeople<Person>(box.id, "id, full_name, gender"),
    db.from("invitations").select("id, token, email, first_name, last_name, role, created_at").eq("box_id", box.id).is("accepted_at", null).order("created_at", { ascending: false }).returns<Invitation[]>(),
    db.from("results").select("user_id, updated_at").eq("box_id", box.id).order("updated_at", { ascending: false }).limit(2000).returns<{ user_id: string; updated_at: string }[]>(),
  ]);
  const people = [...peopleList].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  const emails = await emailsOf(people.map((p) => p.id));
  // Diagnóstico visible en vez de una pantalla vacía
  const problems: string[] = [];
  if (peopleErr) problems.push(`Personas: ${peopleErr.message}`);
  if (invErr) problems.push(`Invitaciones: ${invErr.message}`);
  if (emails.size === 0) problems.push(t("No he podido leer los emails de las cuentas: revisa que SUPABASE_SECRET_KEY sea la Secret key de ESTE proyecto de Supabase."));
  // Premios de medallas pendientes y entregados, con los datos de envío
  type Award = { user_id: string; code: string; unlocked_on: string; created_at: string; delivered_at: string | null };
  type Ship = { id: string; full_name: string; phone: string | null; address_line: string | null; postal_code: string | null; city: string | null; country: string | null; shirt_size: string | null };
  const { data: awardsData } = await db
    .from("user_achievements")
    .select("user_id, code, unlocked_on, created_at, delivered_at")
    .eq("box_id", box.id)
    .in("code", REWARD_CODES)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Award[]>();
  const awards = awardsData ?? [];
  const { data: shipData } = awards.length
    ? await db
        .from("profiles")
        .select("id, full_name, phone, address_line, postal_code, city, country, shirt_size")
        .in("id", [...new Set(awards.map((a) => a.user_id))])
        .returns<Ship[]>()
    : { data: [] as Ship[] };
  const ship = new Map((shipData ?? []).map((p) => [p.id, p]));
  const pendingAwards = awards.filter((a) => !a.delivered_at);
  const lastActivity = new Map<string, string>();
  for (const r of lastRes ?? []) if (!lastActivity.has(r.user_id)) lastActivity.set(r.user_id, r.updated_at);
  const base = await siteUrl();

  // Alta con QR: solicitudes pendientes y el QR del box
  const { data: reqRows } = await db
    .from("box_members")
    .select("user_id, joined_at, profiles!inner(full_name, avatar_url)")
    .eq("box_id", box.id)
    .eq("pending", true)
    .order("joined_at")
    .returns<{ user_id: string; joined_at: string; profiles: { full_name: string; avatar_url: string | null } }[]>();
  const reqEmails = await emailsOf((reqRows ?? []).map((r) => r.user_id));
  const requests: JoinRequest[] = (reqRows ?? []).map((r) => ({ id: r.user_id, full_name: r.profiles.full_name, avatar_url: r.profiles.avatar_url, email: reqEmails.get(r.user_id) ?? "", at: r.joined_at }));
  const qrUrl = joinUrl(base, box.join_code);
  const svg = await qrSvg(qrUrl);

  // Atletas activos que llevan 60 días sin meter nada (y que no acaban de llegar)
  const cutoff = daysAgoISO(60);
  const { data: recent } = await db.from("results").select("user_id").eq("box_id", box.id).gte("updated_at", cutoff).limit(20000).returns<{ user_id: string }[]>();
  const recentIds = new Set((recent ?? []).map((r) => r.user_id));
  const dormant = people.filter((p) => p.active && p.role === "athlete" && !p.is_admin && p.created_at < cutoff && !recentIds.has(p.id));

  const all = people ?? [];
  const list = all
    .filter((p) => (filter === "todos" ? true : filter === "activos" ? p.active : !p.active))
    .filter((p) => !q || p.full_name.toLowerCase().includes(q) || (emails.get(p.id) ?? "").toLowerCase().includes(q));
  const counts = { activos: all.filter((p) => p.active).length, inactivos: all.filter((p) => !p.active).length, todos: all.length };

  return (
    <div className="space-y-8">
      <h1 className="h-title text-5xl">Admin</h1>

      {problems.length > 0 && (
        <div className="space-y-1 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p className="text-xs text-red-300/80">{t("Si dice que falta una columna o tabla, ejecuta el SQL 004 en Supabase.")}</p>
        </div>
      )}

      {sp.nuevo && (
        <div className="card space-y-2 border-accent/60 p-4">
          <p className="font-semibold">{t("¡Tu box está listo!")}</p>
          <p className="text-sm text-muted">{t("Su dirección es {url}. Invita a tus coaches y atletas aquí abajo y crea el primer WOD en Coach.", { url: boxUrl(box.slug, base) })}</p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="h-display text-xl">{t("Tu box")}</h2>
        <BoxSettingsForm name={box.name} rewards={box.rewards_enabled} url={boxUrl(box.slug, base)} />
      </section>

      <AdminJoin svg={svg} url={qrUrl} mode={box.join_mode} requests={requests} t={t} locale={locale} />

      <section className="space-y-3">
        <h2 className="h-display text-xl">{t("Invitar a alguien")}</h2>
        <InviteForm />
      </section>

      {(invites ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="h-display text-xl">{t("Invitaciones pendientes")} · {invites!.length}</h2>
          <ul className="card divide-y divide-line">
            {invites!.map((i) => (
              <li key={i.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {i.first_name} {i.last_name}
                      {i.role === "coach" && <span className="ml-2 rounded bg-line px-1.5 text-xs uppercase">{t("Coach")}</span>}
                    </div>
                    <div className="truncate text-xs text-muted">{i.email} · {new Date(i.created_at).toLocaleDateString(locale)}</div>
                  </div>
                  <form action={deleteInvitation}>
                    <input type="hidden" name="id" value={i.id} />
                    <ConfirmDelete />
                  </form>
                </div>
                <ShareInvite name={i.first_name} email={i.email} link={`${base}/invitacion/${i.token}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {box.rewards_enabled && (
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="h-display text-xl">🎁 {t("Premios de medallas")} · {pendingAwards.length}</h2>
          <a href="/admin/atletas.csv" className="text-xs text-muted underline">{t("Descargar datos de atletas (CSV)")}</a>
        </div>
        {awards.length === 0 ? (
          <p className="card p-4 text-sm text-muted">{t("Nadie ha desbloqueado todavía una medalla con premio.")}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {awards.map((a) => {
              const m = MEDAL_BY_CODE.get(a.code);
              const p = ship.get(a.user_id);
              const addr = [p?.address_line, [p?.postal_code, p?.city].filter(Boolean).join(" "), p?.country].filter(Boolean).join(", ");
              return (
                <li key={`${a.user_id}-${a.code}`} className={`flex items-start gap-3 p-3 ${a.delivered_at ? "opacity-60" : ""}`}>
                  {m && <MedalBadge medal={m} unlocked size={40} />}
                  <div className="min-w-0 flex-1 text-sm">
                    <div>
                      <b>{p?.full_name || t("Sin nombre")}</b> · {m ? t(m.name) : a.code}
                      <span className="ml-1 text-xs text-muted">{a.unlocked_on}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {addr || t("Sin dirección")}
                      {p?.shirt_size && ` · ${t("Talla")} ${p.shirt_size}`}
                      {p?.phone && ` · ${p.phone}`}
                    </div>
                  </div>
                  <form action={setRewardDelivered}>
                    <input type="hidden" name="user_id" value={a.user_id} />
                    <input type="hidden" name="code" value={a.code} />
                    <input type="hidden" name="delivered" value={a.delivered_at ? "0" : "1"} />
                    <button className={`chip ${a.delivered_at ? "chip-on" : ""}`}>{a.delivered_at ? `✓ ${t("Entregado")}` : t("Marcar entregado")}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      <section className="space-y-3">
        <h2 className="h-display text-xl">{t("Personas")}</h2>
        <AdminInactive people={dormant} t={t} />
        <form className="flex gap-2">
          <input type="hidden" name="f" value={filter} />
          <input name="q" defaultValue={q} placeholder={t("Buscar por nombre o email")} className="input" />
          <button className="btn-ghost shrink-0">{t("Buscar")}</button>
        </form>
        <div className="flex gap-2">
          {(["activos", "inactivos", "todos"] as const).map((f) => (
            <Link key={f} href={`/admin?f=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`} replace className={`chip capitalize ${filter === f ? "chip-on" : ""}`}>
              {t(f)} · {counts[f]}
            </Link>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">{t("Nadie por aquí.")}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {list.map((p) => {
              const me = p.id === user.id;
              const last = lastActivity.get(p.id);
              return (
                <li key={p.id} className={`space-y-2 p-4 ${p.active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {p.full_name || t("Sin nombre")} {me && <span className="text-xs text-accent">{t("(tú)")}</span>}
                      </div>
                      <div className="truncate text-xs text-muted">{emails.get(p.id) ?? "—"}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold uppercase">
                        <span className={`rounded px-1.5 ${p.active ? "bg-emerald-500/20 text-emerald-300" : "bg-line text-muted"}`}>
                          {p.active ? t("Activo") : t("Inactivo")}
                        </span>
                        {p.role === "coach" && <span className="rounded bg-accent/20 px-1.5 text-accent">{t("Coach")}</span>}
                        {p.is_admin && <span className="rounded bg-fg/15 px-1.5">Admin</span>}
                        <span className="px-1 font-normal normal-case text-muted">
                          {last ? t("último resultado {d}", { d: new Date(last).toLocaleDateString(locale) }) : t("sin resultados")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!me && <Flag id={p.id} flag="active" on={!p.active} label={p.active ? t("Desactivar") : t("Activar")} strong={!p.active} />}
                    <Flag id={p.id} flag="coach" on={p.role !== "coach"} label={p.role === "coach" ? t("Quitar coach") : t("Hacer coach")} />
                    {!me && <Flag id={p.id} flag="is_admin" on={!p.is_admin} label={p.is_admin ? t("Quitar admin") : t("Hacer admin")} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-muted">
          {t("Desactivar no borra nada: la persona no puede entrar, pero sus resultados se guardan. Si vuelve, la activas y lo tiene todo como lo dejó.")}
        </p>
      </section>
    </div>
  );
}

function Flag({ id, flag, on, label, strong }: { id: string; flag: string; on: boolean; label: string; strong?: boolean }) {
  return (
    <form action={setUserFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="on" value={on ? "1" : "0"} />
      <button className={strong ? "btn px-3 py-1.5 text-sm" : "btn-ghost"}>{label}</button>
    </form>
  );
}
