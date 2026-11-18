import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fotos de la pizarra (ya reducidas en el móvil) para leer los WODs con IA
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // Todo es dinámico (depende de la sesión), así que usamos el modelo clásico sin Cache Components.
  cacheComponents: false,
  // El manual de coaches se sirve desde /manual/coaches (protegido), no desde /public
  // Cabeceras de seguridad estándar en todas las respuestas
  async headers() {
    return [
      {
        // El service worker de las notificaciones siempre fresco y con alcance a toda la app
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
