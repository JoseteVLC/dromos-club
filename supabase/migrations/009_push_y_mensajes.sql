-- =====================================================================
-- 009 · Notificaciones push, preferencias de avisos y mensajes con el equipo
-- Ejecutar ANTES de subir el código. Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------- 1. Dispositivos suscritos a push ----------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ---------- 2. Qué avisos quiere recibir cada uno ----------
alter table public.profiles add column if not exists notify_social    boolean not null default true;  -- comentarios y reacciones
alter table public.profiles add column if not exists notify_medals    boolean not null default true;
alter table public.profiles add column if not exists notify_messages  boolean not null default true;  -- mensajes y anuncios del equipo
alter table public.profiles add column if not exists notify_reminders boolean not null default true;  -- recordatorios de entreno
alter table public.profiles add column if not exists last_reminder_at timestamptz;
alter table public.profiles add column if not exists messages_seen_at timestamptz;

grant select (notify_social, notify_medals, notify_messages, notify_reminders, last_reminder_at, messages_seen_at) on public.profiles to authenticated;
grant update (notify_social, notify_medals, notify_messages, notify_reminders, messages_seen_at) on public.profiles to authenticated;

-- ---------- 3. Mensajes con el equipo (coaches + admins) y anuncios ----------
-- thread_user_id = el atleta de la conversación; NULL = anuncio para todos.
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  thread_user_id  uuid references public.profiles(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (length(body) between 1 and 2000),
  created_at      timestamptz not null default now(),
  staff_read_at   timestamptz            -- cuándo lo leyó alguien del equipo (mensajes de atletas)
);
create index if not exists messages_thread_idx on public.messages (thread_user_id, created_at desc);
create index if not exists messages_recent_idx on public.messages (created_at desc);
alter table public.messages enable row level security;

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select to authenticated
  using ((select public.is_coach()) or thread_user_id = (select auth.uid()) or thread_user_id is null);

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select public.is_active())
    and (thread_user_id = (select auth.uid()) or (select public.is_coach()))
  );

drop policy if exists "messages_update_staff" on public.messages;
create policy "messages_update_staff" on public.messages for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()) or (select public.is_coach()));

grant select, insert, update, delete on public.messages to authenticated;

-- Mensajes nuevos para un atleta (de coaches o anuncios) desde la última vez que abrió el chat
create or replace function public.my_unread_messages()
returns int
language sql stable
security invoker set search_path = public
as $$
  select count(*)::int
    from public.messages m
   where (m.thread_user_id = (select auth.uid()) or m.thread_user_id is null)
     and m.sender_id <> (select auth.uid())
     and m.created_at > coalesce((select messages_seen_at from public.profiles where id = (select auth.uid())), 'epoch'::timestamptz);
$$;
grant execute on function public.my_unread_messages() to authenticated;

-- Bandeja del equipo: una fila por atleta con su último mensaje y cuántos sin leer
create or replace function public.staff_inbox()
returns table (thread_user_id uuid, full_name text, avatar_url text, last_body text, last_at timestamptz, last_from_athlete boolean, unread int)
language sql stable
security invoker set search_path = public
as $$
  select t.thread_user_id, p.full_name, p.avatar_url,
         (select body from public.messages x where x.thread_user_id = t.thread_user_id order by created_at desc limit 1),
         t.last_at,
         (select sender_id = t.thread_user_id from public.messages x where x.thread_user_id = t.thread_user_id order by created_at desc limit 1),
         t.unread
    from (
      select m.thread_user_id, max(m.created_at) as last_at,
             count(*) filter (where m.sender_id = m.thread_user_id and m.staff_read_at is null)::int as unread
        from public.messages m
       where m.thread_user_id is not null and (select public.is_coach())
       group by m.thread_user_id
    ) t
    join public.profiles p on p.id = t.thread_user_id
   order by t.last_at desc
   limit 300;
$$;
grant execute on function public.staff_inbox() to authenticated;
