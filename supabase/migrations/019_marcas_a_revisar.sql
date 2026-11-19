-- Marcas personales imposibles que el atleta confirma: quedan para que el equipo las revise
alter table public.personal_records add column if not exists flag text;
alter table public.personal_records add column if not exists flag_reviewed boolean not null default false;
create index if not exists pr_flag_idx on public.personal_records (created_at desc) where flag is not null and not flag_reviewed;
-- El atleta puede editar su marca, pero no quitarse el aviso
revoke update on public.personal_records from authenticated;
grant update (user_id, benchmark_id, performed_on, division, rm, finished, time_seconds, rounds, reps, value, notes) on public.personal_records to authenticated;
