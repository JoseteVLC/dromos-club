import { deactivateInactive } from "@/app/actions";
import { ConfirmDelete } from "./ui";
import type { T } from "@/lib/i18n/core";

/** Atletas activos sin resultados en 60 días, para darlos de baja de golpe. */
export function AdminInactive({ people, t }: { people: { id: string; full_name: string }[]; t: T }) {
  if (!people.length) return null;
  return (
    <div className="card space-y-2 p-4 text-sm">
      <p className="font-semibold">💤 {t("Sin entrenar en 60 días")} · {people.length}</p>
      <p className="text-muted">{people.slice(0, 12).map((p) => p.full_name).join(", ")}{people.length > 12 ? "…" : ""}</p>
      <p className="text-xs text-muted">{t("Si ya no vienen al box, dales de baja: no podrán entrar, pero sus resultados y medallas se guardan por si vuelven.")}</p>
      <form action={deactivateInactive}>
        <input type="hidden" name="ids" value={people.map((p) => p.id).join(",")} />
        <ConfirmDelete label={t("Dar de baja a todos")} confirmLabel={t("¿Seguro? Dar de baja a {n}", { n: people.length })} className="btn-ghost px-3 py-2 text-sm" />
      </form>
    </div>
  );
}
