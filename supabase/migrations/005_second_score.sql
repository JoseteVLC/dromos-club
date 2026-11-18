-- =====================================================================
-- 005 · Segundo score por WOD (p. ej. «kg del back squat» + «reps de sandbag clean»)
-- Cada score tiene su propio ranking.
-- =====================================================================
alter table public.wods add column if not exists score_name   text;  -- nombre del score 1 (opcional)
alter table public.wods add column if not exists score2_type  text check (score2_type in ('load','reps','calories','distance'));
alter table public.wods add column if not exists score2_name  text;  -- p. ej. «Sandbag clean»
alter table public.wods add column if not exists score2_label text;  -- unidad (opcional)

alter table public.results add column if not exists value2 numeric;  -- valor del segundo score
