-- Partes por día (A, B, C…) y benchmarks para PRs
alter table public.wods add column if not exists part text not null default 'A';
alter table public.wods add column if not exists is_benchmark boolean not null default false;
create index if not exists wods_date_part_idx on public.wods (wod_date, part);
