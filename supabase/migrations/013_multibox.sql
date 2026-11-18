-- =====================================================================
-- 013 · Multibox
-- Cada box tiene su slug (será su subdominio). Las personas son globales (un perfil),
-- y su rol (atleta, coach, admin) va por box en box_members.
--
-- El box activo de cada petición lo manda la app en la cabecera «x-box» (el slug).
-- current_box() lo lee y las reglas de seguridad solo dejan ver y tocar ese box,
-- y solo si eres miembro activo. Si alguien manda el slug de un box ajeno, no ve nada.
-- =====================================================================

-- ---------- Boxes y miembros ----------
create table if not exists public.boxes (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and slug !~ '--'),
  name            text not null check (length(trim(name)) between 2 and 60),
  logo_url        text,
  accent          text check (accent ~ '^#[0-9a-fA-F]{6}$'),
  rewards_enabled boolean not null default false,
  status          text not null default 'trial' check (status in ('trial', 'active', 'paused')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
alter table public.boxes enable row level security;

create table if not exists public.box_members (
  box_id    uuid not null references public.boxes(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'athlete' check (role in ('athlete', 'coach', 'admin')),
  active    boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (box_id, user_id)
);
create index if not exists box_members_user_idx on public.box_members(user_id);
alter table public.box_members enable row level security;

-- Nombres que no puede usar un box (rutas de la app y subdominios reservados)
create or replace function public.slug_reserved(p_slug text)
returns boolean language sql immutable as $$
  select p_slug = any (array['www','app','api','admin','auth','login','logout','invitacion','inactivo','ayuda','boxes','box',
    'nuevo','nuevo-box','d','r','wod','coach','ranking','historial','marcas','medallas','mensajes','perfil','atleta','avisos',
    'mail','email','static','assets','cdn','status','blog','help','soporte','dromos','dromosclub','demo','test','dev','staging']);
$$;
alter table public.boxes drop constraint if exists boxes_slug_not_reserved;
alter table public.boxes add constraint boxes_slug_not_reserved check (not public.slug_reserved(slug));

-- ---------- Box activo de la petición y permisos ----------
create or replace function public.current_box()
returns uuid language sql stable security definer set search_path = public as $$
  select b.id from public.boxes b
   where b.slug = nullif(lower(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-box'), '');
$$;

-- Miembro activo del box activo
create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.box_members m join public.profiles p on p.id = m.user_id
     where m.box_id = public.current_box() and m.user_id = auth.uid() and m.active and p.active
  );
$$;

-- Coach o admin activo del box activo
create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.box_members m join public.profiles p on p.id = m.user_id
     where m.box_id = public.current_box() and m.user_id = auth.uid() and m.active and p.active
       and m.role in ('coach', 'admin')
  );
$$;

-- ¿Comparte box activo conmigo esta persona? (para ver su perfil y sus marcas)
create or replace function public.in_my_box(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or (
    public.is_active() and exists (select 1 from public.box_members m where m.box_id = public.current_box() and m.user_id = p_user)
  );
$$;

-- Día de alta en el box activo (los atletas no participan en la plani anterior)
create or replace function public.my_box_since()
returns date language sql stable security definer set search_path = public as $$
  select (m.joined_at at time zone 'Europe/Madrid')::date from public.box_members m
   where m.box_id = public.current_box() and m.user_id = auth.uid();
$$;

revoke execute on function public.current_box() from public, anon;
revoke execute on function public.is_active() from public, anon;
revoke execute on function public.is_coach() from public, anon;
revoke execute on function public.in_my_box(uuid) from public, anon;
revoke execute on function public.my_box_since() from public, anon;
grant execute on function public.current_box(), public.is_active(), public.is_coach(), public.in_my_box(uuid), public.my_box_since() to authenticated;

-- ---------- box_id en todo lo que pertenece a un box ----------
alter table public.wods add column if not exists box_id uuid references public.boxes(id) on delete cascade;
alter table public.wods alter column box_id set default public.current_box();
create index if not exists wods_box_date_idx on public.wods(box_id, wod_date);

alter table public.results add column if not exists box_id uuid references public.boxes(id) on delete cascade;
create index if not exists results_box_idx on public.results(box_id, wod_id);
alter table public.result_comments add column if not exists box_id uuid references public.boxes(id) on delete cascade;
alter table public.reactions add column if not exists box_id uuid references public.boxes(id) on delete cascade;
alter table public.comment_reactions add column if not exists box_id uuid references public.boxes(id) on delete cascade;

alter table public.messages add column if not exists box_id uuid references public.boxes(id) on delete cascade;
alter table public.messages alter column box_id set default public.current_box();
create index if not exists messages_box_thread_idx on public.messages(box_id, thread_user_id, created_at desc);

alter table public.user_achievements add column if not exists box_id uuid references public.boxes(id) on delete cascade;
alter table public.invitations add column if not exists box_id uuid references public.boxes(id) on delete cascade;
alter table public.invitations drop constraint if exists invitations_role_check;
alter table public.invitations add constraint invitations_role_check check (role in ('athlete', 'coach', 'admin'));

-- Catálogo de benchmarks: los de siempre son comunes (box_id vacío); los que añade un coach, de su box
alter table public.benchmarks add column if not exists box_id uuid references public.boxes(id) on delete cascade;
alter table public.benchmarks alter column box_id set default public.current_box();

-- El box de resultados, comentarios y reacciones sale de su WOD: no se puede falsear
create or replace function public.set_box_from_parent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'results' then
    new.box_id := (select box_id from public.wods where id = new.wod_id);
  elsif tg_table_name in ('result_comments', 'reactions') then
    new.box_id := (select box_id from public.results where id = new.result_id);
  elsif tg_table_name = 'comment_reactions' then
    new.box_id := (select box_id from public.result_comments where id = new.comment_id);
  end if;
  return new;
end $$;
revoke execute on function public.set_box_from_parent() from public, anon, authenticated;

drop trigger if exists results_box on public.results;
create trigger results_box before insert or update of wod_id on public.results for each row execute function public.set_box_from_parent();
drop trigger if exists comments_box on public.result_comments;
create trigger comments_box before insert on public.result_comments for each row execute function public.set_box_from_parent();
drop trigger if exists reactions_box on public.reactions;
create trigger reactions_box before insert on public.reactions for each row execute function public.set_box_from_parent();
drop trigger if exists creactions_box on public.comment_reactions;
create trigger creactions_box before insert on public.comment_reactions for each row execute function public.set_box_from_parent();

-- Medallas por box (la racha y las victorias son de cada box)
alter table public.user_achievements drop constraint if exists user_achievements_pkey;
delete from public.user_achievements where box_id is null;
alter table public.user_achievements alter column box_id set not null;
alter table public.user_achievements add primary key (box_id, user_id, code);

-- Resumen de conversaciones por box
drop table if exists public.message_threads cascade;
create table public.message_threads (
  box_id            uuid not null references public.boxes(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  last_at           timestamptz not null,
  last_body         text not null,
  last_from_athlete boolean not null,
  unread            int not null default 0,
  primary key (box_id, user_id)
);
create index message_threads_last_idx on public.message_threads (box_id, last_at desc);
alter table public.message_threads enable row level security;
grant select on public.message_threads to authenticated;

drop function if exists public.refresh_message_threads(uuid[]);
create or replace function public.refresh_message_threads(p_box uuid, p_users uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.message_threads t
   where t.box_id = p_box and t.user_id = any(p_users)
     and not exists (select 1 from public.messages m where m.box_id = p_box and m.thread_user_id = t.user_id);

  insert into public.message_threads (box_id, user_id, last_at, last_body, last_from_athlete, unread)
  select p_box, u.uid, l.created_at, left(l.body, 300), l.sender_id = u.uid,
         (select count(*) from public.messages m where m.box_id = p_box and m.thread_user_id = u.uid and m.staff_read_at is null)::int
    from unnest(p_users) as u(uid)
    cross join lateral (
      select m.created_at, m.body, m.sender_id from public.messages m
       where m.box_id = p_box and m.thread_user_id = u.uid order by m.created_at desc limit 1
    ) l
  on conflict (box_id, user_id) do update
    set last_at = excluded.last_at, last_body = excluded.last_body,
        last_from_athlete = excluded.last_from_athlete, unread = excluded.unread;
end $$;
revoke execute on function public.refresh_message_threads(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.trg_messages_threads_ins()
returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  for b in select distinct box_id from new_rows where box_id is not null loop
    perform public.refresh_message_threads(b, array(select distinct thread_user_id from new_rows where box_id = b and thread_user_id is not null));
  end loop;
  return null;
end $$;
create or replace function public.trg_messages_threads_upd()
returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  for b in select distinct box_id from new_rows where box_id is not null loop
    perform public.refresh_message_threads(b, array(select distinct thread_user_id from new_rows where box_id = b and thread_user_id is not null));
  end loop;
  return null;
end $$;
create or replace function public.trg_messages_threads_del()
returns trigger language plpgsql security definer set search_path = public as $$
declare b uuid;
begin
  for b in select distinct box_id from old_rows where box_id is not null loop
    perform public.refresh_message_threads(b, array(select distinct thread_user_id from old_rows where box_id = b and thread_user_id is not null));
  end loop;
  return null;
end $$;
revoke execute on function public.trg_messages_threads_ins(), public.trg_messages_threads_upd(), public.trg_messages_threads_del() from public, anon, authenticated;

-- ---------- Reglas de seguridad ----------
-- boxes y box_members: lo mío y lo de mi box activo (las altas y cambios, solo el servidor)
drop policy if exists "boxes_select" on public.boxes;
create policy "boxes_select" on public.boxes for select to authenticated
  using (exists (select 1 from public.box_members m where m.box_id = boxes.id and m.user_id = (select auth.uid()) and m.active));
drop policy if exists "members_select" on public.box_members;
create policy "members_select" on public.box_members for select to authenticated
  using (user_id = (select auth.uid()) or (box_id = (select public.current_box()) and (select public.is_active())));
grant select on public.boxes, public.box_members to authenticated;

-- profiles: el tuyo y los de tu box activo
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using ((select public.in_my_box(id)));

-- wods
drop policy if exists "wods_select" on public.wods;
create policy "wods_select" on public.wods for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active()) and (published or (select public.is_coach())));
drop policy if exists "wods_coach_write" on public.wods;
create policy "wods_coach_write" on public.wods for all to authenticated
  using (box_id = (select public.current_box()) and (select public.is_coach()))
  with check (box_id = (select public.current_box()) and (select public.is_coach()));

-- results
drop policy if exists "results_select" on public.results;
create policy "results_select" on public.results for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "results_insert_own" on public.results;
create policy "results_insert_own" on public.results for insert to authenticated
  with check (
    user_id = (select auth.uid()) and box_id = (select public.current_box()) and (select public.is_active())
    and ((select public.is_coach()) or exists (
      select 1 from public.wods w where w.id = wod_id and w.wod_date >= (select public.my_box_since())
    ))
  );
drop policy if exists "results_update_own" on public.results;
create policy "results_update_own" on public.results for update to authenticated
  using (user_id = (select auth.uid()) and box_id = (select public.current_box()))
  with check (user_id = (select auth.uid()) and box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "results_delete" on public.results;
create policy "results_delete" on public.results for delete to authenticated
  using (box_id = (select public.current_box()) and (user_id = (select auth.uid()) or (select public.is_coach())));

-- comentarios
drop policy if exists "comments_select" on public.result_comments;
create policy "comments_select" on public.result_comments for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "comments_insert_own" on public.result_comments;
create policy "comments_insert_own" on public.result_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "comments_delete" on public.result_comments;
create policy "comments_delete" on public.result_comments for delete to authenticated
  using (box_id = (select public.current_box()) and (user_id = (select auth.uid()) or (select public.is_coach())));

-- reacciones
drop policy if exists "reactions_select" on public.reactions;
create policy "reactions_select" on public.reactions for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own" on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()) and box_id = (select public.current_box()));

drop policy if exists "creactions_select" on public.comment_reactions;
create policy "creactions_select" on public.comment_reactions for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "creactions_insert_own" on public.comment_reactions;
create policy "creactions_insert_own" on public.comment_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "creactions_update_own" on public.comment_reactions;
create policy "creactions_update_own" on public.comment_reactions for update to authenticated
  using (user_id = (select auth.uid()) and box_id = (select public.current_box()))
  with check (user_id = (select auth.uid()) and box_id = (select public.current_box()));
drop policy if exists "creactions_delete_own" on public.comment_reactions;
create policy "creactions_delete_own" on public.comment_reactions for delete to authenticated
  using (user_id = (select auth.uid()) and box_id = (select public.current_box()));

-- mensajes
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active())
         and ((select public.is_coach()) or thread_user_id = (select auth.uid()) or thread_user_id is null));
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and box_id = (select public.current_box()) and (select public.is_active())
              and (thread_user_id = (select auth.uid()) or (select public.is_coach())));
drop policy if exists "messages_update_staff" on public.messages;
create policy "messages_update_staff" on public.messages for update to authenticated
  using (box_id = (select public.current_box()) and (select public.is_coach()))
  with check (box_id = (select public.current_box()) and (select public.is_coach()));
drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages for delete to authenticated
  using (box_id = (select public.current_box()) and (sender_id = (select auth.uid()) or (select public.is_coach())));

drop policy if exists "threads_staff" on public.message_threads;
create policy "threads_staff" on public.message_threads for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_coach()));

-- medallas
drop policy if exists "ach_select" on public.user_achievements;
create policy "ach_select" on public.user_achievements for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active()));

-- marcas personales: son de la persona; las ve su gente del box activo
drop policy if exists "pr_select" on public.personal_records;
create policy "pr_select" on public.personal_records for select to authenticated using ((select public.in_my_box(user_id)));
drop policy if exists "pr_delete" on public.personal_records;
create policy "pr_delete" on public.personal_records for delete to authenticated
  using (user_id = (select auth.uid()) or ((select public.is_coach()) and (select public.in_my_box(user_id))));
drop policy if exists "pr_insert_own" on public.personal_records;
create policy "pr_insert_own" on public.personal_records for insert to authenticated with check (user_id = (select auth.uid()));

-- catálogo de benchmarks: comunes + los de tu box; un coach solo edita los de su box
drop policy if exists "benchmarks_select" on public.benchmarks;
create policy "benchmarks_select" on public.benchmarks for select to authenticated
  using (box_id is null or box_id = (select public.current_box()));
drop policy if exists "benchmarks_coach_write" on public.benchmarks;
create policy "benchmarks_coach_write" on public.benchmarks for all to authenticated
  using (box_id = (select public.current_box()) and (select public.is_coach()))
  with check (box_id = (select public.current_box()) and (select public.is_coach()));

-- ---------- Funciones que leen datos del box ----------
create or replace function public.staff_inbox(p_archived boolean default false)
returns table (thread_user_id uuid, full_name text, avatar_url text, last_body text, last_at timestamptz, last_from_athlete boolean, unread int)
language sql stable set search_path = public as $$
  select t.user_id, p.full_name, p.avatar_url, t.last_body, t.last_at, t.last_from_athlete, t.unread
    from public.message_threads t
    join public.profiles p on p.id = t.user_id
   where t.box_id = (select public.current_box()) and (select public.is_coach())
     and (case when p_archived then t.last_at < now() - interval '60 days' and t.unread = 0
               else t.last_at >= now() - interval '60 days' or t.unread > 0 end)
   order by t.last_at desc
   limit 300;
$$;

create or replace function public.my_unread_messages()
returns integer language sql stable set search_path = public as $$
  select count(*)::int
    from public.messages m
   where m.box_id = (select public.current_box())
     and (m.thread_user_id = (select auth.uid()) or m.thread_user_id is null)
     and m.sender_id <> (select auth.uid())
     and m.created_at > coalesce((select messages_seen_at from public.profiles where id = (select auth.uid())), 'epoch'::timestamptz);
$$;

-- Ficha pública: solo de gente de tu box activo
create or replace function public.public_profile(p_id uuid)
returns table (id uuid, full_name text, avatar_url text, bio text, instagram text, gender text, division text, box text, age int)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, p.bio, p.instagram, p.gender, p.division,
         case when p.show_box then p.box end,
         case when p.show_age and p.birth_date is not null then extract(year from age(p.birth_date))::int end
    from public.profiles p
   where p.id = p_id and coalesce(p.active, true) and public.in_my_box(p_id);
$$;

revoke execute on function public.staff_inbox(boolean), public.my_unread_messages(), public.public_profile(uuid) from public, anon;
grant execute on function public.staff_inbox(boolean), public.my_unread_messages(), public.public_profile(uuid) to authenticated;

-- Todo lo de un box debe tener box (base nueva, sin datos antiguos)
alter table public.wods alter column box_id set not null;
alter table public.results alter column box_id set not null;
alter table public.result_comments alter column box_id set not null;
alter table public.reactions alter column box_id set not null;
alter table public.comment_reactions alter column box_id set not null;
alter table public.messages alter column box_id set not null;
alter table public.invitations alter column box_id set not null;
