import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { dayHref } from "@/lib/dates";

// Enlaces antiguos /wod/:id → vista del día con esa parte seleccionada
export default async function WodRedirect({ params }: PageProps<"/wod/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("wods").select("wod_date").eq("id", id).maybeSingle();
  if (!data) notFound();
  redirect(dayHref(data.wod_date, { w: id }));
}
