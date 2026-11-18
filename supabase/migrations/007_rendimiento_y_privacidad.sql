-- =====================================================================
-- 007 · Fase 1 de la auditoría: índices, RLS más rápida, privacidad de
-- perfiles y avisos calculados en una sola consulta.
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

-- ---------- 1. Índices que faltaban ----------
create index if not exists results_user_idx           on public.results (user_id);
create index if not exists result_comments_user_idx   on public.result_comments (user_id);
create index if not exists reactions_user_idx         on public.reactions (user_id);
create index if not exists wods_published_date_idx    on public.wods (published, wod_date);
create index if not exists pr_user_date_idx           on public.personal_records (user_id, performed_on desc);

-- ---------- 2. RLS: calcular auth.uid() / is_coach() una vez por consulta, no por fila ----------
-- Reescribe las políticas existentes envolviendo esas llamadas en (select …), como recomienda Supabase.
do $$
declare
  p record;
  fix_using text;
  fix_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    fix_using := null;
    fix_check := null;
    if p.qual is not null and p.qual !~* 'select' and p.qual ~ '(auth\.uid\(\)|is_coach\(\)|is_active\(\))' then
      fix_using := regexp_replace(p.qual, '(auth\.uid\(\)|(public\.)?is_coach\(\)|(public\.)?is_active\(\))', '(select \1)', 'g');
    end if;
    if p.with_check is not null and p.with_check !~* 'select' and p.with_check ~ '(auth\.uid\(\)|is_coach\(\)|is_active\(\))' then
      fix_check := regexp_replace(p.with_check, '(auth\.uid\(\)|(public\.)?is_coach\(\)|(public\.)?is_active\(\))', '(select \1)', 'g');
    end if;
    if fix_using is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, fix_using);
    end if;
    if fix_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, fix_check);
    end if;
  end loop;
end $$;

-- ---------- 3. Privacidad: teléfono y nacimiento solo los ve su dueño ----------
-- Los demás atletas pueden leer nombre, género, categoría… pero no esas dos columnas.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name not in ('phone', 'birth_date');
  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;

-- El propio usuario lee sus datos privados con esta función
create or replace function public.my_private_profile()
returns table (phone text, birth_date date)
language sql stable
security definer set search_path = public
as $$
  select p.phone, p.birth_date from public.profiles p where p.id = auth.uid();
$$;
revoke execute on function public.my_private_profile() from public, anon;
grant execute on function public.my_private_profile() to authenticated;

-- ---------- 4. Avisos en una sola consulta ----------
-- Comentarios en tus resultados o en hilos donde has comentado + reacciones a tus resultados.
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
  )
  select f.kind, f.nid, f.at, f.who, f.rid, f.on_mine, f.body, f.emoji, f.wod_title, f.wod_part, me.seen
    from feed f cross join me
   where not p_unread_only or f.at > me.seen
   order by f.at desc
   limit greatest(1, least(p_limit, 200));
$$;
revoke execute on function public.my_notices(int, boolean) from public, anon;
grant execute on function public.my_notices(int, boolean) to authenticated;
