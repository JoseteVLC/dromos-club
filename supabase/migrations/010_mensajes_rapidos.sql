-- =====================================================================
-- 010 · Mensajería preparada para crecer
--  · Índice para el contador de no leídos del equipo
--  · Resumen por conversación (message_threads) que se mantiene solo con triggers
--  · Bandeja del equipo leyendo el resumen (no recorre todos los mensajes) y con archivadas
-- Ejecutar ANTES de subir el código. Se puede ejecutar más de una vez.
-- =====================================================================

-- ---------- 1. Índice: mensajes de atletas sin leer por el equipo ----------
create index if not exists messages_staff_unread_idx
  on public.messages (created_at desc)
  where staff_read_at is null and thread_user_id is not null;

-- ---------- 2. Resumen por conversación ----------
create table if not exists public.message_threads (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  last_at           timestamptz not null,
  last_body         text not null,
  last_from_athlete boolean not null,
  unread            int not null default 0
);
create index if not exists message_threads_last_idx on public.message_threads (last_at desc);
alter table public.message_threads enable row level security;
drop policy if exists "threads_staff" on public.message_threads;
create policy "threads_staff" on public.message_threads for select to authenticated using ((select public.is_coach()));
grant select on public.message_threads to authenticated;
-- Sin políticas de escritura: lo mantienen los triggers.

-- Recalcula el resumen de una lista de conversaciones (rápido: usa el índice por conversación)
create or replace function public.refresh_message_threads(p_users uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.message_threads t
   where t.user_id = any(p_users)
     and not exists (select 1 from public.messages m where m.thread_user_id = t.user_id);

  insert into public.message_threads (user_id, last_at, last_body, last_from_athlete, unread)
  select u.uid, l.created_at, left(l.body, 300), l.sender_id = u.uid,
         (select count(*) from public.messages m where m.thread_user_id = u.uid and m.staff_read_at is null)::int
    from unnest(p_users) as u(uid)
    cross join lateral (
      select m.created_at, m.body, m.sender_id from public.messages m
       where m.thread_user_id = u.uid order by m.created_at desc limit 1
    ) l
  on conflict (user_id) do update
    set last_at = excluded.last_at, last_body = excluded.last_body,
        last_from_athlete = excluded.last_from_athlete, unread = excluded.unread;
end $$;

create or replace function public.trg_messages_threads_ins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_message_threads(array(select distinct thread_user_id from new_rows where thread_user_id is not null));
  return null;
end $$;
create or replace function public.trg_messages_threads_upd()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_message_threads(array(select distinct thread_user_id from new_rows where thread_user_id is not null));
  return null;
end $$;
create or replace function public.trg_messages_threads_del()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_message_threads(array(select distinct thread_user_id from old_rows where thread_user_id is not null));
  return null;
end $$;

drop trigger if exists messages_threads_ins on public.messages;
create trigger messages_threads_ins after insert on public.messages
  referencing new table as new_rows for each statement execute function public.trg_messages_threads_ins();
drop trigger if exists messages_threads_upd on public.messages;
create trigger messages_threads_upd after update on public.messages
  referencing new table as new_rows for each statement execute function public.trg_messages_threads_upd();
drop trigger if exists messages_threads_del on public.messages;
create trigger messages_threads_del after delete on public.messages
  referencing old table as old_rows for each statement execute function public.trg_messages_threads_del();

-- Rellena el resumen con lo que ya existe
select public.refresh_message_threads(array(select distinct thread_user_id from public.messages where thread_user_id is not null));

-- ---------- 3. Bandeja del equipo: activas (últimos 60 días) o archivadas ----------
drop function if exists public.staff_inbox();
drop function if exists public.staff_inbox(boolean);
create function public.staff_inbox(p_archived boolean default false)
returns table (thread_user_id uuid, full_name text, avatar_url text, last_body text, last_at timestamptz, last_from_athlete boolean, unread int)
language sql stable
security invoker set search_path = public
as $$
  select t.user_id, p.full_name, p.avatar_url, t.last_body, t.last_at, t.last_from_athlete, t.unread
    from public.message_threads t
    join public.profiles p on p.id = t.user_id
   where (select public.is_coach())
     and (case when p_archived then t.last_at < now() - interval '60 days' and t.unread = 0
               else t.last_at >= now() - interval '60 days' or t.unread > 0 end)
   order by t.last_at desc
   limit 300;
$$;
grant execute on function public.staff_inbox(boolean) to authenticated;
