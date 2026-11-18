import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { BRAND } from "@/lib/brand";

const inter = localFont({
  src: [
    { path: "./fonts/Inter-400.woff2", weight: "400" },
    { path: "./fonts/Inter-500.woff2", weight: "500" },
    { path: "./fonts/Inter-600.woff2", weight: "600" },
    { path: "./fonts/Inter-700.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const grotesk = localFont({
  src: [
    { path: "./fonts/SpaceGrotesk-500.woff2", weight: "500" },
    { path: "./fonts/SpaceGrotesk-600.woff2", weight: "600" },
    { path: "./fonts/SpaceGrotesk-700.woff2", weight: "700" },
  ],
  variable: "--font-grotesk",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: BRAND.name,
    description: t("El leaderboard de tu box: resultados, rankings, PRs y medallas"),
    applicationName: BRAND.short,
    appleWebApp: { capable: true, title: BRAND.short, statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = { themeColor: BRAND.colors.bg };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { lang } = await getI18n();
  return (
    <html lang={lang} className={`h-full antialiased ${inter.variable} ${grotesk.variable}`}>
      <body className="min-h-full font-sans">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
