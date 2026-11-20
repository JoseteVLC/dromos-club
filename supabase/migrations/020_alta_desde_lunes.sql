-- El atleta ve y participa en la plani del box desde el lunes de la semana en que entra
create or replace function public.my_box_since()
returns date language sql stable security definer set search_path = public as $$
  select date_trunc('week', (m.joined_at at time zone 'Europe/Madrid'))::date from public.box_members m
   where m.box_id = public.current_box() and m.user_id = auth.uid();
$$;
