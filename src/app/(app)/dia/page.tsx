import { redirect } from "next/navigation";
import { fullDayHref, todayISO } from "@/lib/dates";

export default function FullDayToday() {
  redirect(fullDayHref(todayISO()));
}
