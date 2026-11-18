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
