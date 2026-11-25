-- Medallas que se ganan varias veces (Semana de fuego, Mes perfecto, Podio…): cuántas veces la llevas
alter table public.user_achievements add column if not exists times integer not null default 1;
