import Link from "next/link";
import { requireCoach } from "@/lib/supabase/server";
import { ManualView } from "@/components/manual-view";
import md from "@/content/manual-coaches";

export const metadata = { robots: { index: false, follow: false } };

/** Solo coaches y admins. */
export default async function AyudaCoachesPage() {
  await requireCoach();
  return (
    <div id="top" className="space-y-4">
      <Link href="/ayuda" className="text-sm text-muted">‹ Manual de atletas</Link>
      <ManualView md={md} title="Manual para coaches y admins" intro="Plani y WODs, mensajes y anuncios, personas, datos de atletas y premios de medallas. Uso interno." />
    </div>
  );
}
