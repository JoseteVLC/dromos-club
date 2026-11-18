import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { BRAND } from "@/lib/brand";
import type { Box } from "@/lib/types";

export const metadata = { title: `Tus boxes · ${BRAND.name}` };

type Row = { role: string; active: boolean; boxes: Box };

/** Elegir box: si solo estás en uno, entras directo; si estás en varios, eliges. */
export default async function BoxesPage({ searchParams }: PageProps<"/boxes">) {
  const sp = await searchParams;
  const { supabase, user } = await requireSession();
  const { t } = await getI18n();
  const { data } = await supabase
    .from("box_members")
    .select("role, active, boxes!inner(id, slug, name, logo_url, accent, rewards_enabled, status)")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("joined_at")
    .returns<Row[]>();
  const boxes = data ?? [];
  const outside = typeof sp.fuera === "string" ? sp.fuera : null;
  if (boxes.length === 1 && !outside && !sp.cambiar) redirect(`/${boxes[0].boxes.slug}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND.logo} alt={BRAND.name} className="mx-auto h-8 w-auto" />
      {outside && (
        <p className="rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-sm">
          {t("No perteneces al box «{slug}». Pide una invitación a su coach o elige uno de los tuyos.", { slug: outside })}
        </p>
      )}
      {boxes.length === 0 ? (
        <div className="card space-y-3 p-5 text-center">
          <h1 className="h-title text-2xl">{t("Aún no estás en ningún box")}</h1>
          <p className="text-sm text-muted">{t("Entra con el enlace de invitación que te mande tu box o, si eres el dueño, crea el tuyo.")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h1 className="h-title text-center text-2xl">{t("Elige tu box")}</h1>
          <ul className="card divide-y divide-line overflow-hidden">
            {boxes.map((m) => (
              <li key={m.boxes.id}>
                <a href={`/${m.boxes.slug}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-line/40">
                  {m.boxes.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.boxes.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-line font-display font-bold">{m.boxes.name.slice(0, 1)}</span>
                  )}
                  <span className="flex-1 font-semibold">{m.boxes.name}</span>
                  <span className="text-xs uppercase text-muted">{t(m.role === "admin" ? "Admin" : m.role === "coach" ? "Coach" : "Atleta")}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/nuevo-box" className="btn-ghost text-center">
        {t("Crear un box nuevo")}
      </Link>
    </main>
  );
}
