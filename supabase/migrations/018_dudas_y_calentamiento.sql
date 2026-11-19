-- =====================================================================
-- 018 · Dudas del WOD y calentamiento sugerido
--  - wod_comments: preguntas y respuestas en el propio WOD (las de coach se pueden fijar arriba)
--  - wod_comment_reactions: reacciones tipo WhatsApp, una por persona
--  - wod_warmups: calentamiento específico preparado una vez por WOD e idioma (lo escribe el servidor)
--  - my_notices: avisos de respuestas en las dudas y reacciones a tus comentarios
-- =====================================================================

create table if not exists public.wod_comments (
  id         uuid primary key default gen_random_uuid(),
  box_id     uuid not null references public.boxes(id) on delete cascade,
  wod_id     uuid not null references public.wods(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 500),
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists wod_comments_wod_idx on public.wod_comments(wod_id, created_at);
create index if not exists wod_comments_user_idx on public.wod_comments(user_id);
alter table public.wod_comments enable row level security;

create table if not exists public.wod_comment_reactions (
  comment_id uuid not null references public.wod_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  box_id     uuid not null references public.boxes(id) on delete cascade,
  emoji      text not null check (emoji in ('👍','❤️','😂','😮','🔥','💪')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists wod_comment_reactions_user_idx on public.wod_comment_reactions(user_id, created_at);
alter table public.wod_comment_reactions enable row level security;

create table if not exists public.wod_warmups (
  wod_id     uuid not null references public.wods(id) on delete cascade,
  locale     text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  primary key (wod_id, locale)
);
alter table public.wod_warmups enable row level security; -- sin políticas: solo el servidor

-- El box se hereda del WOD (o del comentario)
create or replace function public.set_box_from_parent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name in ('results', 'wod_comments') then
    new.box_id := (select box_id from public.wods where id = new.wod_id);
  elsif tg_table_name in ('result_comments', 'reactions') then
    new.box_id := (select box_id from public.results where id = new.result_id);
  elsif tg_table_name = 'comment_reactions' then
    new.box_id := (select box_id from public.result_comments where id = new.comment_id);
  elsif tg_table_name = 'wod_comment_reactions' then
    new.box_id := (select box_id from public.wod_comments where id = new.comment_id);
  end if;
  return new;
end $$;
revoke execute on function public.set_box_from_parent() from public, anon, authenticated;
drop trigger if exists wod_comments_box on public.wod_comments;
create trigger wod_comments_box before insert on public.wod_comments for each row execute function public.set_box_from_parent();
drop trigger if exists wod_creactions_box on public.wod_comment_reactions;
create trigger wod_creactions_box before insert on public.wod_comment_reactions for each row execute function public.set_box_from_parent();

drop policy if exists "wcomments_select" on public.wod_comments;
create policy "wcomments_select" on public.wod_comments for select to authenticated using (box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "wcomments_insert_own" on public.wod_comments;
create policy "wcomments_insert_own" on public.wod_comments for insert to authenticated
  with check (box_id = (select public.current_box()) and user_id = (select auth.uid()) and (select public.is_active()) and not pinned);
drop policy if exists "wcomments_delete" on public.wod_comments;
create policy "wcomments_delete" on public.wod_comments for delete to authenticated
  using (box_id = (select public.current_box()) and (user_id = (select auth.uid()) or (select public.is_coach())));
grant select, insert, delete on public.wod_comments to authenticated;

drop policy if exists "wcreactions_select" on public.wod_comment_reactions;
create policy "wcreactions_select" on public.wod_comment_reactions for select to authenticated using (box_id = (select public.current_box()) and (select public.is_active()));
drop policy if exists "wcreactions_insert_own" on public.wod_comment_reactions;
create policy "wcreactions_insert_own" on public.wod_comment_reactions for insert to authenticated
  with check (box_id = (select public.current_box()) and user_id = (select auth.uid()) and (select public.is_active()));
drop policy if exists "wcreactions_update_own" on public.wod_comment_reactions;
create policy "wcreactions_update_own" on public.wod_comment_reactions for update to authenticated
  using (box_id = (select public.current_box()) and user_id = (select auth.uid())) with check (box_id = (select public.current_box()) and user_id = (select auth.uid()));
drop policy if exists "wcreactions_delete_own" on public.wod_comment_reactions;
create policy "wcreactions_delete_own" on public.wod_comment_reactions for delete to authenticated
  using (box_id = (select public.current_box()) and user_id = (select auth.uid()));
grant select, insert, update, delete on public.wod_comment_reactions to authenticated;

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
    select 'creaction', 'cr-' || cr.comment_id || '-' || cr.user_id, cr.created_at, pr.full_name,
           rc.result_id, (r.user_id = auth.uid()), rc.body, cr.emoji, w.title, w.part
      from public.comment_reactions cr
      join public.result_comments rc on rc.id = cr.comment_id
      join public.results r on r.id = rc.result_id
      join public.wods w on w.id = r.wod_id
      left join public.profiles pr on pr.id = cr.user_id
     where rc.user_id = auth.uid()
       and cr.user_id <> auth.uid()
    union all
    -- Dudas del WOD: lo que se escribe después de que tú hayas preguntado o respondido
    select 'wcomment', 'wc-' || wc.id, wc.created_at, pr.full_name,
           wc.wod_id, false, wc.body, null, w.title, w.part
      from public.wod_comments wc
      join public.wods w on w.id = wc.wod_id
      left join public.profiles pr on pr.id = wc.user_id
     where wc.user_id <> auth.uid()
       and exists (select 1 from public.wod_comments m where m.wod_id = wc.wod_id and m.user_id = auth.uid() and m.created_at < wc.created_at)
    union all
    select 'wcreaction', 'wcr-' || x.comment_id || '-' || x.user_id, x.created_at, pr.full_name,
           wc.wod_id, true, wc.body, x.emoji, w.title, w.part
      from public.wod_comment_reactions x
      join public.wod_comments wc on wc.id = x.comment_id
      join public.wods w on w.id = wc.wod_id
      left join public.profiles pr on pr.id = x.user_id
     where wc.user_id = auth.uid()
       and x.user_id <> auth.uid()
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
