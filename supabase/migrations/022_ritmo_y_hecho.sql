-- Dos tipos de score nuevos: ritmo medio (pace, en segundos por km, menos es mejor) y «hecho» (check, sin marca)
alter table public.wods drop constraint if exists wods_score_type_check;
alter table public.wods add constraint wods_score_type_check
  check (score_type in ('for_time','amrap','load','reps','calories','distance','emom','pace','check'));
