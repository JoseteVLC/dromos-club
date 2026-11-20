-- Modo competición: el box es de atletas que compiten. Sin gamificación (constancia, medallas, puntos, ranking, recordatorios de racha).
alter table public.boxes add column if not exists competition boolean not null default false;
