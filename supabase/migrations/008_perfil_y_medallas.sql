-- =====================================================================
-- 008 · Perfil con foto (parte pública y privada) y medallas
-- Ejecutar ANTES de subir el código. Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------- 1. Nuevas columnas de perfil ----------
-- Públicas (las ve cualquier atleta)
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio        text check (length(bio) <= 200);
alter table public.profiles add column if not exists instagram  text check (length(instagram) <= 40);
alter table public.profiles add column if not exists show_box   boolean not null default false;
alter table public.profiles add column if not exists show_age   boolean not null default false;
-- Privadas (solo el propio atleta y el equipo del box)
alter table public.profiles add column if not exists box          text check (length(box) <= 80);
alter table public.profiles add column if not exists address_line text check (length(address_line) <= 200);
alter table public.profiles add column if not exists postal_code  text check (length(postal_code) <= 12);
alter table public.profiles add column if not exists city         text check (length(city) <= 80);
alter table public.profiles add column if not exists country      text check (length(country) <= 60);
alter table public.profiles add column if not exists shirt_size   text check (shirt_size in ('XS','S','M','L','XL','XXL'));

-- Lectura: todas las columnas menos las privadas
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name not in ('phone', 'birth_date', 'box', 'address_line', 'postal_code', 'city', 'country', 'shirt_size');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;

-- Escritura: cada uno edita sus datos (la política RLS limita a su propia fila)
revoke update on public.profiles from authenticated;
grant update (full_name, gender, first_name, last_name, phone, birth_date, division, notifications_seen_at,
              avatar_url, bio, instagram, show_box, show_age,
              box, address_line, postal_code, city, country, shirt_size)
  on public.profiles to authenticated;

-- Datos privados del propio usuario
drop function if exists public.my_private_profile();
create function public.my_private_profile()
returns table (phone text, birth_date date, box text, address_line text, postal_code text, city text, country text, shirt_size text)
language sql stable
security definer set search_path = public
as $$
  select p.phone, p.birth_date, p.box, p.address_line, p.postal_code, p.city, p.country, p.shirt_size
    from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.my_private_profile() from public, anon;
grant execute on function public.my_private_profile() to authenticated;

-- Ficha pública de un atleta: box y edad solo si el atleta lo ha permitido
create or replace function public.public_profile(p_id uuid)
returns table (id uuid, full_name text, avatar_url text, bio text, instagram text, gender text, division text, box text, age int)
language sql stable
security definer set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url, p.bio, p.instagram, p.gender, p.division,
         case when p.show_box then p.box end,
         case when p.show_age and p.birth_date is not null then extract(year from age(p.birth_date))::int end
    from public.profiles p
   where p.id = p_id and coalesce(p.active, true);
$$;
revoke execute on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;

-- ---------- 2. Fotos de perfil (Storage) ----------
-- Lectura pública; solo el servidor (clave secreta) sube y borra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ---------- 3. Medallas ----------
create table if not exists public.user_achievements (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  code         text not null,
  unlocked_on  date not null,
  created_at   timestamptz not null default now(),
  delivered_at timestamptz,          -- premio entregado (lo marca un admin)
  primary key (user_id, code)
);
create index if not exists user_achievements_recent_idx on public.user_achievements (created_at desc);
alter table public.user_achievements enable row level security;
drop policy if exists "ach_select" on public.user_achievements;
create policy "ach_select" on public.user_achievements for select to authenticated using (true);
-- Sin políticas de escritura: solo el servidor (clave secreta) concede medallas.

-- Resultados de todos en los WODs donde he participado (para saber si he hecho podio)
create or replace function public.results_in_my_wods()
returns table (id uuid, wod_id uuid, user_id uuid, division text, finished boolean, time_seconds int,
               rounds int, reps int, value numeric, gender text)
language sql stable
security invoker set search_path = public
as $$
  select r.id, r.wod_id, r.user_id, r.division, r.finished, r.time_seconds, r.rounds, r.reps, r.value, p.gender
    from public.results r
    join public.profiles p on p.id = r.user_id
   where r.wod_id in (select wod_id from public.results where user_id = (select auth.uid()));
$$;
revoke execute on function public.results_in_my_wods() from public, anon;
grant execute on function public.results_in_my_wods() to authenticated;

-- ---------- 4. Avisos: también las medallas nuevas ----------
create or replace function public.my_notices(p_limit int default 50, p_unread_only boolean default false)
returns table (
  n_kind text, n_id text, n_at timestamptz, n_who text, n_result uuid,
  n_on_mine boolean, n_body text, n_emoji text, n_wod_title text, n_wod_part text, n_seen timestamptz
)
language sql stable
security invoker set search_path = public
as $$
  with me as (
    select coalesce((select notifications_seen_at from public.profiles where id = auth.uid()), 'epoch'::timestamptz) as seen
  ),
  threads as (
    select id from public.results where user_id = auth.uid()
    union
    select result_id from public.result_comments where user_id = auth.uid()
  ),
  feed as (
    select 'comment'::text as kind, 'c-' || rc.id as nid, rc.created_at as at, pr.full_name as who,
           rc.result_id as rid, (r.user_id = auth.uid()) as on_mine, rc.body as body, null::text as emoji,
           w.title as wod_title, w.part as wod_part
      from public.result_comments rc
      join public.results r on r.id = rc.result_id
      join public.wods w on w.id = r.wod_id
      left join public.profiles pr on pr.id = rc.user_id
     where rc.result_id in (select id from threads)
       and rc.user_id <> auth.uid()
    union all
    select 'reaction', 'r-' || re.result_id || '-' || re.user_id || '-' || re.emoji, re.created_at, pr.full_name,
           re.result_id, true, null, re.emoji, w.title, w.part
      from public.reactions re
      join public.results r on r.id = re.result_id
      join public.wods w on w.id = r.wod_id
      left join public.profiles pr on pr.id = re.user_id
     where r.user_id = auth.uid()
       and re.user_id <> auth.uid()
    union all
    select 'medal', 'm-' || ua.code, ua.created_at, null, null, true, ua.code, null, null, null
      from public.user_achievements ua
     where ua.user_id = auth.uid()
  )
  select f.kind, f.nid, f.at, f.who, f.rid, f.on_mine, f.body, f.emoji, f.wod_title, f.wod_part, me.seen
    from feed f cross join me
   where not p_unread_only or f.at > me.seen
   order by f.at desc
   limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.my_notices(int, boolean) from public, anon;
grant execute on function public.my_notices(int, boolean) to authenticated;

-- ---------- 5. Atletas nuevos: no pueden meter resultado en WODs anteriores a su alta ----------
-- (los coaches y admins sí; la app además les oculta esos días)
drop policy if exists "results_insert_own" on public.results;
create policy "results_insert_own" on public.results
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_active())
    and (
      (select public.is_coach())
      or exists (
        select 1 from public.wods w
         where w.id = wod_id
           and w.wod_date >= (select (p.created_at at time zone 'Europe/Madrid')::date from public.profiles p where p.id = (select auth.uid()))
      )
    )
  );
