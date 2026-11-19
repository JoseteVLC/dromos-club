-- =====================================================================
-- 017 · Categorías por WOD
-- Cada WOD dice qué categorías tiene (por defecto Élite, RX y Escalado).
-- Si Élite y RX son iguales, el coach quita una y todos compiten en el mismo ranking.
-- =====================================================================
alter table public.wods add column if not exists divisions text[] not null default array['elite', 'rx', 'scaled'];
alter table public.wods drop constraint if exists wods_divisions_check;
alter table public.wods add constraint wods_divisions_check
  check (divisions <@ array['elite', 'rx', 'scaled'] and divisions && array['elite', 'rx']);
