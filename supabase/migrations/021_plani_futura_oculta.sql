-- Los atletas ven la plani hasta el domingo de esta semana; desde el domingo, también la semana siguiente.
-- Los coaches pueden dejar cargadas semanas futuras sin que se vean antes de tiempo.
create or replace function public.plan_horizon()
returns date language sql stable set search_path = '' as $$
  select (date_trunc('week', now() at time zone 'Europe/Madrid'))::date + 6
       + case when extract(isodow from now() at time zone 'Europe/Madrid') = 7 then 7 else 0 end;
$$;
grant execute on function public.plan_horizon() to authenticated;
drop policy if exists "wods_select" on public.wods;
create policy "wods_select" on public.wods for select to authenticated
  using (box_id = (select public.current_box()) and (select public.is_active())
         and ((published and wod_date <= (select public.plan_horizon())) or (select public.is_coach())));
