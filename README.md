# Dromos Club

Leaderboard multibox para boxes de CrossFit / cross-training: WODs del día, resultados, rankings, PRs, medallas, mensajes con el equipo del box y notificaciones push. Nació del leaderboard de TrainCult y ahora es una plataforma para cualquier box.

## Pila
Next.js (App Router) · Supabase (Postgres + Auth + Storage, RLS) · Vercel · Web Push (PWA)

## Marca
Todo lo que identifica la marca está en `src/lib/brand.ts` (nombre, dominio, colores) y `public/brand/`. Los textos usan `{app}` / `{appLong}`, que se rellenan con la marca. Paleta en `src/app/globals.css`.

## Manuales
Fuente en `docs/manuales/*.md`. Tras cambiarlos: `node scripts/build-manuals.mjs`.

## Multibox (en curso)
Cada box tiene un *slug* (`cfvalencia`). Mientras no haya dominio propio, el box va en la ruta (`/cfvalencia`); con dominio, en el subdominio (`cfvalencia.dromosclub.com`). La resolución del box está centralizada para que el cambio sea de un solo punto.

## Variables de entorno
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SITE_URL`.
