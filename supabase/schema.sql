-- =====================================================================
-- Dromos Club — esquema Supabase
-- Pegar entero en Supabase → SQL Editor → Run
-- =====================================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  gender      text check (gender in ('M','F')),
  role        text not null default 'athlete' check (role in ('athlete','coach')),
  created_at  timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse (usa los metadatos del signup)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'gender', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ¿El usuario actual es coach?
create or replace function public.is_coach()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- ---------- WODS ----------
create table if not exists public.wods (
  id                uuid primary key default gen_random_uuid(),
  wod_date          date not null default current_date,
  title             text not null,
  description       text not null default '',
  score_type        text not null check (score_type in
                      ('for_time','amrap','load','reps','calories','distance','emom')),
  time_cap_seconds  integer,             -- solo for_time (opcional)
  score_label       text,                -- etiqueta libre, p.ej. "reps totales" en un EMOM
  published         boolean not null default true,
  part              text not null default 'A',      -- parte del día: A, B, C…
  is_benchmark      boolean not null default false, -- cuenta para PRs (Fran, Grace, 1RM…)
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists wods_date_idx on public.wods (wod_date desc);
create index if not exists wods_date_part_idx on public.wods (wod_date, part);

-- ---------- RESULTS ----------
create table if not exists public.results (
  id            uuid primary key default gen_random_uuid(),
  wod_id        uuid not null references public.wods(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  division      text not null check (division in ('elite','rx','scaled')),
  finished      boolean not null default true,  -- for_time: ¿acabó dentro del time cap?
  time_seconds  integer,                        -- for_time terminado
  rounds        integer,                        -- amrap
  reps          integer,                        -- amrap (reps extra) / for_time no terminado
  value         numeric,                        -- load (kg), reps, calorías, metros, emom
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (wod_id, user_id)
);
create index if not exists results_wod_idx on public.results (wod_id);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.wods     enable row level security;
alter table public.results  enable row level security;

-- profiles: todos los logueados ven nombres; cada uno edita solo su nombre y género (no el rol)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (full_name, gender) on public.profiles to authenticated;

-- wods: atletas ven los publicados; coaches lo ven y gestionan todo
drop policy if exists "wods_select" on public.wods;
create policy "wods_select" on public.wods
  for select to authenticated using (published or public.is_coach());

drop policy if exists "wods_coach_write" on public.wods;
create policy "wods_coach_write" on public.wods
  for all to authenticated using (public.is_coach()) with check (public.is_coach());

-- results: todos ven el leaderboard; cada uno gestiona su resultado; el coach puede borrar
drop policy if exists "results_select" on public.results;
create policy "results_select" on public.results
  for select to authenticated using (true);

drop policy if exists "results_insert_own" on public.results;
create policy "results_insert_own" on public.results
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "results_update_own" on public.results;
create policy "results_update_own" on public.results
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "results_delete" on public.results;
create policy "results_delete" on public.results
  for delete to authenticated using (user_id = auth.uid() or public.is_coach());

-- =====================================================================
-- Hacer coach a alguien (ejecutar a mano tras registrarse):
--   update public.profiles set role = 'coach'
--   where id = (select id from auth.users where email = 'tu@email.com');
-- =====================================================================
create table if not exists public.reactions (
  result_id  uuid not null references public.results(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('👊','🔥')),
  created_at timestamptz not null default now(),
  primary key (result_id, user_id, emoji)
);
alter table public.reactions enable row level security;

drop policy if exists "reactions_select" on public.reactions;
create policy "reactions_select" on public.reactions
  for select to authenticated using (true);

drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own" on public.reactions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own" on public.reactions
  for delete to authenticated using (user_id = auth.uid());
-- =====================================================================
-- 004 · Administración, invitaciones, datos personales y comentarios
-- =====================================================================

-- ---------- PERFIL: admin, activo y datos personales ----------
alter table public.profiles add column if not exists is_admin   boolean not null default false;
alter table public.profiles add column if not exists active     boolean not null default true;
alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists last_name  text not null default '';
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists division   text check (division in ('elite','rx','scaled'));
alter table public.profiles add column if not exists notifications_seen_at timestamptz not null default now();

-- Nombre y apellidos a partir del nombre que ya había
update public.profiles
   set first_name = split_part(full_name, ' ', 1),
       last_name  = trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1))
 where first_name = '' and full_name <> '';

-- Cada uno solo puede tocar sus datos (no rol, admin ni activo)
revoke update on public.profiles from authenticated;
grant update (full_name, gender, first_name, last_name, phone, birth_date, division, notifications_seen_at)
  on public.profiles to authenticated;

-- El alta copia nombre, apellidos y categoría de la invitación
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, first_name, last_name, gender, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    nullif(new.raw_user_meta_data->>'gender', ''),
    case when new.raw_user_meta_data->>'role' = 'coach' then 'coach' else 'athlete' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Los admins también pueden hacer todo lo del coach
create or replace function public.is_coach()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (role = 'coach' or is_admin) and active);
$$;

create or replace function public.is_active()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;

-- Un usuario desactivado no puede meter ni cambiar resultados
drop policy if exists "results_insert_own" on public.results;
create policy "results_insert_own" on public.results
  for insert to authenticated with check (user_id = auth.uid() and public.is_active());

drop policy if exists "results_update_own" on public.results;
create policy "results_update_own" on public.results
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active());

-- ---------- INVITACIONES (solo el servidor, con la secret key) ----------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  email       text not null,
  first_name  text not null default '',
  last_name   text not null default '',
  role        text not null default 'athlete' check (role in ('athlete','coach')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  user_id     uuid references public.profiles(id) on delete set null
);
alter table public.invitations enable row level security; -- sin políticas: nadie desde el navegador

-- ---------- COMENTARIOS EN RESULTADOS ----------
create table if not exists public.result_comments (
  id         uuid primary key default gen_random_uuid(),
  result_id  uuid not null references public.results(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists result_comments_result_idx on public.result_comments(result_id, created_at);
alter table public.result_comments enable row level security;

drop policy if exists "comments_select" on public.result_comments;
create policy "comments_select" on public.result_comments
  for select to authenticated using (true);

drop policy if exists "comments_insert_own" on public.result_comments;
create policy "comments_insert_own" on public.result_comments
  for insert to authenticated with check (user_id = auth.uid() and public.is_active());

drop policy if exists "comments_delete" on public.result_comments;
create policy "comments_delete" on public.result_comments
  for delete to authenticated using (user_id = auth.uid() or public.is_coach());

-- Comentarios nuevos para mí: en mis resultados o en conversaciones donde he comentado
create or replace function public.unread_comments()
returns integer
language sql stable
set search_path = public
as $$
  select count(*)::int
    from result_comments c
    join results r on r.id = c.result_id
   where c.user_id <> auth.uid()
     and c.created_at > (select notifications_seen_at from profiles where id = auth.uid())
     and (r.user_id = auth.uid()
          or exists (select 1 from result_comments m where m.result_id = c.result_id and m.user_id = auth.uid()));
$$;

-- Buscar cuenta por email (solo el servidor con la secret key)
create or replace function public.user_id_by_email(p_email text)
returns uuid
language sql stable
security definer set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke execute on function public.user_id_by_email(text) from public, anon, authenticated;
