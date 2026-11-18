import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { currentBoxSlug } from "@/lib/supabase/server";
import { publicBox } from "@/lib/box-public";

/** La app instalada lleva el nombre del box y se abre en él. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const box = await publicBox(await currentBoxSlug()).catch(() => null);
  return {
    name: box ? `${box.name} · ${BRAND.short}` : BRAND.name,
    short_name: box ? box.name.slice(0, 12) : BRAND.short,
    description: "El leaderboard de tu box: resultados, rankings, PRs y medallas",
    id: box ? `/${box.slug}` : "/",
    start_url: box ? `/${box.slug}` : "/",
    display: "standalone",
    background_color: BRAND.colors.bg,
    theme_color: BRAND.colors.bg,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
