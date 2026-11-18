-- =====================================================================
-- 011 · Reacciones a los comentarios (como en WhatsApp: una por persona)
-- =====================================================================

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.result_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('👍','❤️','😂','😮','🔥','💪')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_reactions_user_idx on public.comment_reactions(user_id, created_at);
alter table public.comment_reactions enable row level security;

drop policy if exists "creactions_select" on public.comment_reactions;
create policy "creactions_select" on public.comment_reactions
  for select to authenticated using (true);

drop policy if exists "creactions_insert_own" on public.comment_reactions;
create policy "creactions_insert_own" on public.comment_reactions
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_active()));

drop policy if exists "creactions_update_own" on public.comment_reactions;
create policy "creactions_update_own" on public.comment_reactions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "creactions_delete_own" on public.comment_reactions;
create policy "creactions_delete_own" on public.comment_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Avisos: también cuando reaccionan a un comentario tuyo ----------
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
