import Link from "next/link";
import { isCoachProfile, requireUser } from "@/lib/supabase/server";
import { ManualView } from "@/components/manual-view";
import md from "@/content/manual-atletas";

export const metadata = { robots: { index: false, follow: false } };

export default async function AyudaPage() {
  const { profile } = await requireUser();
  return (
    <div id="top" className="space-y-4">
      <Link href="/perfil" className="text-sm text-muted">‹ Perfil</Link>
      {isCoachProfile(profile) && (
        <Link href="/ayuda/coaches" className="card flex items-center justify-between p-3 text-sm font-semibold">
          🧑‍🏫 Manual para coaches y admins <span className="text-accent">→</span>
        </Link>
      )}
      <ManualView md={md} title="Cómo funciona la app" intro="Todo lo que necesitas para meter tus resultados, seguir tus marcas, ganar medallas y hablar con el equipo." />
    </div>
  );
}
