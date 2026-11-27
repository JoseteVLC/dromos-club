-- FEED DEL BOX: foto y esfuerzo en cada resultado, seguir a compañeros,
-- reacciones recibidas en el perfil y Leyendas. Todo aditivo: no toca datos existentes.

-- ---------- 1. Foto y esfuerzo percibido en el resultado ----------
alter table public.results add column if not exists photo_path text;
alter table public.results add column if not exists effort smallint check (effort between 1 and 10);

-- Fotos de los resultados: bucket privado. Solo el servidor (clave secreta) sube, borra y firma enlaces,
-- y solo firma las fotos de resultados que quien mira ya puede ver.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('result-photos', 'result-photos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 4194304, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ---------- 2. Seguir a compañeros ----------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;
-- Cada uno ve, crea y borra solo a quién sigue él (y solo puede seguir a gente de su box)
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select to authenticated using (follower_id = (select auth.uid()));
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and (select public.is_active()) and public.in_my_box(followee_id));
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using (follower_id = (select auth.uid()));
grant select, insert, delete on public.follows to authenticated;

-- ---------- 3. Reacciones recibidas en el box (👊 y 🔥 que suman en el perfil) ----------
create or replace function public.kudos_received(p_user uuid)
returns table (emoji text, n int)
language sql stable
security definer set search_path = public
as $$
  select re.emoji, count(*)::int
    from public.reactions re
    join public.results r on r.id = re.result_id
   where public.in_my_box(p_user)
     and r.user_id = p_user and re.user_id <> p_user
     and r.box_id = public.current_box()
   group by re.emoji;
$$;
revoke execute on function public.kudos_received(uuid) from public, anon;
grant execute on function public.kudos_received(uuid) to authenticated;

-- ---------- 4. Leyendas del box (título vivo: se gana y se pierde) ----------
-- box: quien más días ha entrenado en los últimos 30 días (mínimo 3).
-- benchmark: quien más veces ha registrado cada benchmark en los últimos 365 días (mínimo 2).
-- Empate: quien llegó antes a esa cifra. Solo del box activo y para sus miembros.
create or replace function public.legends()
returns table (kind text, label text, user_id uuid, n int)
language sql stable
security definer set search_path = public
as $$
  with b as (select public.current_box() as id where public.is_active()),
  box as (
    select r.user_id, count(distinct w.wod_date)::int as n, max(r.created_at) as last_at
      from public.results r
      join public.wods w on w.id = r.wod_id
      join public.box_members m on m.box_id = r.box_id and m.user_id = r.user_id and m.active
     where r.box_id = (select id from b)
       and w.wod_date > (now() at time zone 'Europe/Madrid')::date - 30
       and w.wod_date <= (now() at time zone 'Europe/Madrid')::date
     group by r.user_id
  ),
  bench as (
    select lower(btrim(w.title)) as k, min(btrim(w.title)) as label, r.user_id, count(*)::int as n, max(r.created_at) as last_at
      from public.results r
      join public.wods w on w.id = r.wod_id and w.is_benchmark and w.score_type <> 'check'
      join public.box_members m on m.box_id = r.box_id and m.user_id = r.user_id and m.active
     where r.box_id = (select id from b)
       and r.division <> 'scaled'
       and w.wod_date > (now() at time zone 'Europe/Madrid')::date - 365
     group by lower(btrim(w.title)), r.user_id
  )
  (select 'box'::text, ''::text, x.user_id, x.n from box x where x.n >= 3 order by x.n desc, x.last_at asc limit 1)
  union all
  (select distinct on (x.k) 'benchmark'::text, x.label, x.user_id, x.n from bench x where x.n >= 2 order by x.k, x.n desc, x.last_at asc);
$$;
revoke execute on function public.legends() from public, anon;
grant execute on function public.legends() to authenticated;
