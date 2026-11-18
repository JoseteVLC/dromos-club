-- slug_reserved con search_path fijo (aviso del linter de Supabase)
alter function public.slug_reserved(text) set search_path = '';
