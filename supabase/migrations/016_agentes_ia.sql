-- =====================================================================
-- 016 · Agentes de IA (primer bloque)
--  - Detector de resultados imposibles: results.flag (motivo) y flag_reviewed (el coach dice que está bien).
--    Solo el servidor (clave secreta) puede tocar esas columnas: si las cambia un atleta, se ignoran.
--  - Consejo de peso y escalado: ai_tips, uno por WOD y atleta (caché para no pagar dos veces).
--  - Resumen semanal: profiles.notify_weekly.
-- =====================================================================

alter table public.results add column if not exists flag text;
alter table public.results add column if not exists flag_reviewed boolean not null default false;
create index if not exists results_flag_idx on public.results(box_id, created_at desc) where flag is not null and not flag_reviewed;

create or replace function public.protect_result_flag()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'authenticated' then
    if tg_op = 'INSERT' then
      new.flag := null;
      new.flag_reviewed := false;
    else
      new.flag := old.flag;
      new.flag_reviewed := old.flag_reviewed;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.protect_result_flag() from public, anon, authenticated;
drop trigger if exists results_protect_flag on public.results;
create trigger results_protect_flag before insert or update on public.results
  for each row execute function public.protect_result_flag();

create table if not exists public.ai_tips (
  box_id     uuid not null references public.boxes(id) on delete cascade,
  wod_id     uuid not null references public.wods(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  primary key (wod_id, user_id)
);
create index if not exists ai_tips_user_day_idx on public.ai_tips(user_id, created_at desc);
alter table public.ai_tips enable row level security;
drop policy if exists "tips_own" on public.ai_tips;
create policy "tips_own" on public.ai_tips for select to authenticated using (user_id = (select auth.uid()));
grant select on public.ai_tips to authenticated;

alter table public.profiles add column if not exists notify_weekly boolean not null default true;
grant select (notify_weekly) on public.profiles to authenticated;
grant update (notify_weekly) on public.profiles to authenticated;
