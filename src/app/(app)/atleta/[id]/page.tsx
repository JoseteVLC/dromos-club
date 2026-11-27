import Link from "next/link";
import { notFound } from "next/navigation";
import { isCoachProfile, requireUser } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { myTrainingDays } from "@/lib/streak-data";
import { computeStreak } from "@/lib/streaks";
import { MEDALS } from "@/lib/medals";
import { RM_CATEGORIES, bestPR, formatPR, type Benchmark, type PersonalRecord } from "@/lib/marcas";
import { Avatar } from "@/components/avatar";
import { MedalBadge } from "@/components/medal-badge";
import { Icon } from "@/components/icon";
import { getKudos, getLegends } from "@/lib/feed";
import { toggleFollow } from "@/app/actions";

type Pub = { id: string; full_name: string; avatar_url: string | null; bio: string | null; instagram: string | null; gender: string | null; division: string | null; box: string | null; age: number | null };

/** Ficha pública de un atleta: foto, lo que haya querido enseñar, medallas y mejores marcas. */
export default async function AtletaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user, profile, box } = await requireUser();
  const { t, locale } = await getI18n();

  const [{ data: pub }, { data: medals }, { data: prs }, { data: benches }, training] = await Promise.all([
    supabase.rpc("public_profile", { p_id: id }).maybeSingle<Pub>(),
    supabase.from("user_achievements").select("code, unlocked_on").eq("user_id", id),
    supabase.from("personal_records").select("*").eq("user_id", id).eq("division", "rx").returns<PersonalRecord[]>(),
    supabase.from("benchmarks").select("*").returns<Benchmark[]>(),
    myTrainingDays(supabase, id, box.id),
  ]);
  if (!pub) notFound();
  // Reconocimiento y Leyendas (no en modo competición, que va sin gamificación)
  const [kudos, legends, { data: follow }] = await Promise.all([
    box.competition ? Promise.resolve({} as Record<string, number>) : getKudos(supabase, id),
    box.competition ? Promise.resolve([]) : getLegends(supabase),
    supabase.from("follows").select("followee_id").eq("follower_id", user.id).eq("followee_id", id).maybeSingle(),
  ]);
  const myLegends = legends.filter((l) => l.user_id === id);

  const stats = computeStreak(training.days, training.done, training.today);
  const owned = new Map((medals ?? []).map((m) => [m.code as string, m.unlocked_on as string]));
  const benchById = new Map((benches ?? []).map((b) => [b.id, b]));
  const groups = new Map<string, PersonalRecord[]>();
  for (const r of prs ?? []) {
    const b = benchById.get(r.benchmark_id);
    if (!b) continue;
    const key = RM_CATEGORIES.includes(b.category) ? `${b.id}|${r.rm ?? 1}` : b.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const bests = [...groups.values()]
    .map((list) => {
      const b = benchById.get(list[0].benchmark_id)!;
      return { b, r: bestPR(b, list)! };
    })
    .filter((x) => x.r)
    .sort((a, b) => b.r.performed_on.localeCompare(a.r.performed_on))
    .slice(0, 8);
  const me = id === user.id;

  return (
    <div className="space-y-6">
      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        <Avatar name={pub.full_name} url={pub.avatar_url} size={112} />
        <div>
          <h1 className="h-title text-4xl">{pub.full_name || t("Sin nombre")}</h1>
          <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-muted">
            {pub.division && pub.division !== "scaled" && <span className="rounded bg-line px-1.5 py-0.5 text-xs font-semibold uppercase">{pub.division}</span>}
            {pub.box && <span className="inline-flex items-center gap-1"><Icon name="mappin" size={13} /> {pub.box}</span>}
            {pub.age != null && <span>{t("{n} años", { n: pub.age })}</span>}
            {pub.instagram && (
              <a href={`https://instagram.com/${pub.instagram}`} target="_blank" rel="noopener noreferrer" className="text-accent">
                @{pub.instagram}
              </a>
            )}
          </div>
        </div>
        {pub.bio && <p className="max-w-sm text-[15px]">{pub.bio}</p>}
        {myLegends.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {myLegends.map((l) => (
              <span key={l.kind + l.label} className="rounded-full border border-accent/60 bg-accent/10 px-3 py-1 text-sm font-semibold">
                👑 {l.kind === "box" ? t("Leyenda del box") : t("Leyenda de {w}", { w: l.label })}
              </span>
            ))}
          </div>
        )}
        {!box.competition && (
          <div className="flex gap-3 text-sm" aria-label={t("Reacciones recibidas")}>
            {["👊", "🔥"].map((e) => (
              <span key={e} className="rounded-full border border-line px-3 py-1 tabular-nums">
                {e} {kudos[e] ?? 0}
              </span>
            ))}
          </div>
        )}
        {!me && (
          <form action={toggleFollow}>
            <input type="hidden" name="user_id" value={id} />
            <input type="hidden" name="on" value={follow ? "0" : "1"} />
            <button className={follow ? "chip" : "btn px-5 py-2"}>{follow ? t("Siguiendo ✓") : t("Seguir")}</button>
          </form>
        )}
        {me && (
          <Link href="/perfil" className="text-xs text-muted underline">
            {t("Editar mi perfil")}
          </Link>
        )}
        {!me && isCoachProfile(profile) && (
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/coach/atleta/${id}`} className="chip chip-on">
              <Icon name="chart" size={16} /> {t("Ficha completa")}
            </Link>
            <Link href={`/mensajes/${id}`} className="chip">
              <Icon name="mail" size={16} /> {t("Enviar mensaje")}
            </Link>
          </div>
        )}
      </div>

      {!box.competition && <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: stats.total, l: t("entrenos") },
          { v: stats.days, l: t("días seguidos") },
          { v: stats.current, l: t("semanas de 5 días") },
        ].map((x) => (
          <div key={x.l} className="card p-3">
            <div className="h-display text-3xl text-accent">{x.v}</div>
            <div className="text-xs text-muted">{x.l}</div>
          </div>
        ))}
      </div>}

      {!box.competition && <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="h-display text-2xl">{t("Medallas")}</h2>
          <span className="text-sm text-muted">
            {owned.size}/{MEDALS.length}
          </span>
        </div>
        <ul className="card grid grid-cols-4 gap-3 p-4 sm:grid-cols-5">
          {MEDALS.map((m) => (
            <li key={m.code} className="text-center" title={t(m.name)}>
              <MedalBadge medal={m} unlocked={owned.has(m.code)} size={58} />
              <div className={`mt-1 truncate text-[10px] ${owned.has(m.code) ? "" : "text-muted"}`}>{t(m.name)}</div>
            </li>
          ))}
        </ul>
      </section>}

      {bests.length > 0 && (
        <section className="space-y-2">
          <h2 className="h-display text-2xl">{t("Mejores marcas")}</h2>
          <ul className="card divide-y divide-line">
            {bests.map(({ b, r }) => (
              <li key={r.id}>
                <Link href={`/marcas/${b.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {b.name}
                      {RM_CATEGORIES.includes(b.category) && <span className="ml-1 text-xs text-muted">{r.rm ?? 1}RM</span>}
                    </div>
                    <div className="text-xs text-muted">
                      {new Date(r.performed_on + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                    </div>
                  </div>
                  <div className="h-display text-xl tabular-nums">{formatPR(b, r)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
