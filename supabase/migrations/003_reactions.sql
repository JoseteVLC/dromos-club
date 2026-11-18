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
