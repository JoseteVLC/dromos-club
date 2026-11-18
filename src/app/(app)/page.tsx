import { redirect } from "next/navigation";
import { dayHref, todayISO } from "@/lib/dates";

export default function Home() {
  redirect(dayHref(todayISO()));
}
