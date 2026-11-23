-- Marcas que salen solas de un WOD de fuerza (1RM back squat, 3RM deadlift…): enlazadas al WOD y a su score (1 o 2)
alter table public.personal_records add column if not exists wod_id uuid references public.wods(id) on delete cascade;
alter table public.personal_records add column if not exists score_slot smallint;
create unique index if not exists personal_records_wod_slot_idx on public.personal_records (user_id, wod_id, score_slot);

-- El upsert de las marcas que salen del WOD también actualiza estas dos columnas (solo en filas propias, por RLS)
grant update (wod_id, score_slot) on public.personal_records to authenticated;
