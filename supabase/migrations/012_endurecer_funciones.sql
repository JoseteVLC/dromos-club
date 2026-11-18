-- =====================================================================
-- 012 · Endurecer permisos de funciones (avisos de seguridad de Supabase)
-- Las funciones internas no deben poder llamarse desde la API pública.
-- Los triggers siguen funcionando: Postgres no comprueba EXECUTE al dispararlos.
-- =====================================================================

-- Solo las usan los triggers por dentro
revoke execute on function public.refresh_message_threads(uuid[]) from public, anon, authenticated;
revoke execute on function public.trg_messages_threads_ins() from public, anon, authenticated;
revoke execute on function public.trg_messages_threads_upd() from public, anon, authenticated;
revoke execute on function public.trg_messages_threads_del() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Las usan las reglas de seguridad y la app, pero solo con sesión iniciada
revoke execute on function public.is_active() from public, anon;
revoke execute on function public.is_coach() from public, anon;
revoke execute on function public.my_unread_messages() from public, anon;
revoke execute on function public.staff_inbox(boolean) from public, anon;
revoke execute on function public.unread_comments() from public, anon;
grant execute on function public.is_active() to authenticated;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.my_unread_messages() to authenticated;
grant execute on function public.staff_inbox(boolean) to authenticated;
grant execute on function public.unread_comments() to authenticated;
