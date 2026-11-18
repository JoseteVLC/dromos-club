-- =====================================================================
-- 006 · Marcas personales: benchmarks de CrossFit (Girls, Heroes, clásicos),
-- RM de básicos y halterofilia, gimnásticos y cardio. Cada atleta apunta
-- sus marcas con fecha; la mejor es su PR y hay ranking por benchmark.
-- =====================================================================
create table if not exists public.benchmarks (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('girls','heroes','classics','lifts','olympic','gymnastics','endurance')),
  name        text not null,
  description text not null default '',
  score_type  text not null check (score_type in ('for_time','amrap','load','reps','calories','distance','emom')),
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (category, name)
);

create table if not exists public.personal_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  benchmark_id uuid not null references public.benchmarks(id) on delete cascade,
  performed_on date not null,
  division     text not null default 'rx' check (division in ('rx','scaled')),
  rm           int  check (rm between 1 and 20),           -- en levantamientos: 1RM, 3RM, 5RM…
  finished     boolean not null default true,
  time_seconds int,
  rounds       int,
  reps         int,
  value        numeric,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists pr_user_idx on public.personal_records (user_id, benchmark_id);
create index if not exists pr_bench_idx on public.personal_records (benchmark_id);

alter table public.benchmarks enable row level security;
alter table public.personal_records enable row level security;

drop policy if exists "benchmarks_select" on public.benchmarks;
create policy "benchmarks_select" on public.benchmarks for select to authenticated using (true);
drop policy if exists "benchmarks_coach_write" on public.benchmarks;
create policy "benchmarks_coach_write" on public.benchmarks for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

drop policy if exists "pr_select" on public.personal_records;
create policy "pr_select" on public.personal_records for select to authenticated using (true);
drop policy if exists "pr_insert_own" on public.personal_records;
create policy "pr_insert_own" on public.personal_records for insert to authenticated
  with check (user_id = auth.uid() and public.is_active());
drop policy if exists "pr_update_own" on public.personal_records;
create policy "pr_update_own" on public.personal_records for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "pr_delete" on public.personal_records;
create policy "pr_delete" on public.personal_records for delete to authenticated
  using (user_id = auth.uid() or public.is_coach());

-- Catálogo inicial (los coaches pueden añadir y corregir desde la app)
insert into public.benchmarks (category, name, score_type, description, sort) values
  ('girls','Angie','for_time','100 pull-ups · 100 push-ups · 100 sit-ups · 100 air squats',0),
  ('girls','Barbara','for_time','5 rondas: 20 pull-ups · 30 push-ups · 40 sit-ups · 50 air squats. 3 min de descanso entre rondas',1),
  ('girls','Chelsea','emom','EMOM 30 min: 5 pull-ups · 10 push-ups · 15 air squats. Score: rondas completadas',2),
  ('girls','Cindy','amrap','AMRAP 20 min: 5 pull-ups · 10 push-ups · 15 air squats',3),
  ('girls','Diane','for_time','21-15-9: deadlift 102/70 kg · handstand push-ups',4),
  ('girls','Elizabeth','for_time','21-15-9: clean 61/43 kg · ring dips',5),
  ('girls','Fran','for_time','21-15-9: thrusters 43/30 kg · pull-ups',6),
  ('girls','Grace','for_time','30 clean & jerks 61/43 kg',7),
  ('girls','Helen','for_time','3 rondas: 400 m run · 21 kettlebell swings 24/16 kg · 12 pull-ups',8),
  ('girls','Isabel','for_time','30 snatches 61/43 kg',9),
  ('girls','Jackie','for_time','1000 m row · 50 thrusters 20/15 kg · 30 pull-ups',10),
  ('girls','Karen','for_time','150 wall-ball shots 9/6 kg',11),
  ('girls','Linda','for_time','10-9-8-7-6-5-4-3-2-1: deadlift 1,5× peso corporal · bench press 1× peso corporal · clean 0,75× peso corporal',12),
  ('girls','Mary','amrap','AMRAP 20 min: 5 handstand push-ups · 10 pistols (alternas) · 15 pull-ups',13),
  ('girls','Nancy','for_time','5 rondas: 400 m run · 15 overhead squats 43/30 kg',14),
  ('girls','Annie','for_time','50-40-30-20-10: double-unders · sit-ups',15),
  ('girls','Eva','for_time','5 rondas: 800 m run · 30 kettlebell swings 32/24 kg · 30 pull-ups',16),
  ('girls','Kelly','for_time','5 rondas: 400 m run · 30 box jumps 24/20" · 30 wall-ball shots 9/6 kg',17),
  ('girls','Lynne','reps','5 rondas, máximas reps: bench press al peso corporal · pull-ups. Score: reps totales',18),
  ('girls','Nicole','reps','AMRAP 20 min: 400 m run · máx. pull-ups. Score: pull-ups totales',19),
  ('girls','Amanda','for_time','9-7-5: muscle-ups · squat snatches 61/43 kg',20),
  ('girls','Gwen','load','15-12-9 clean & jerks touch and go, mismo peso en todas las series. Score: kilos',21),
  ('girls','Candy','for_time','5 rondas: 20 pull-ups · 40 push-ups · 60 air squats',22),
  ('girls','Maggie','for_time','5 rondas: 20 handstand push-ups · 40 pull-ups · 60 pistols (alternas)',23),
  ('girls','Hope','reps','3 rondas de 1 min por ejercicio: burpees · power snatch 34/25 kg · box jumps 24/20" · thrusters 34/25 kg · chest-to-bar. Score: reps totales',24),
  ('girls','Grettel','for_time','10 rondas: 3 clean & jerks 61/43 kg · 3 burpees por encima de la barra',25),
  ('girls','Ingrid','for_time','10 rondas: 3 snatches 61/43 kg · 3 burpees por encima de la barra',26),
  ('heroes','Murph','for_time','1 milla run · 100 pull-ups · 200 push-ups · 300 air squats · 1 milla run. Con chaleco 9/6 kg (se pueden partir las reps)',0),
  ('heroes','DT','for_time','5 rondas: 12 deadlifts · 9 hang power cleans · 6 push jerks, 70/47,5 kg',1),
  ('heroes','JT','for_time','21-15-9: handstand push-ups · ring dips · push-ups',2),
  ('heroes','Michael','for_time','3 rondas: 800 m run · 50 back extensions · 50 sit-ups',3),
  ('heroes','Badger','for_time','3 rondas: 30 squat cleans 43/30 kg · 30 pull-ups · 800 m run',4),
  ('heroes','Danny','amrap','AMRAP 20 min: 30 box jumps 24/20" · 20 push presses 52/34 kg · 30 pull-ups',5),
  ('heroes','Randy','for_time','75 power snatches 34/25 kg',6),
  ('heroes','Nate','amrap','AMRAP 20 min: 2 muscle-ups · 4 handstand push-ups · 8 kettlebell swings 32/24 kg',7),
  ('heroes','Josh','for_time','21 overhead squats 43/30 kg · 42 pull-ups · 15 OHS · 30 pull-ups · 9 OHS · 18 pull-ups',8),
  ('heroes','Ryan','for_time','5 rondas: 7 muscle-ups · 21 burpees',9),
  ('heroes','Daniel','for_time','50 pull-ups · 400 m run · 21 thrusters 43/30 kg · 800 m run · 21 thrusters · 400 m run · 50 pull-ups',10),
  ('heroes','Griff','for_time','800 m run · 400 m run hacia atrás · 800 m run · 400 m run hacia atrás',11),
  ('heroes','Erin','for_time','5 rondas: 15 dumbbell split cleans 18 kg · 21 pull-ups',12),
  ('heroes','Jason','for_time','100 air squats · 5 muscle-ups · 75 squats · 10 MU · 50 squats · 15 MU · 25 squats · 20 MU',13),
  ('heroes','Kalsu','for_time','100 thrusters 61/43 kg. Empieza con 5 burpees y haz 5 burpees al inicio de cada minuto',14),
  ('heroes','Whitten','for_time','5 rondas: 22 kettlebell swings 32/24 kg · 22 box jumps 24/20" · 400 m run · 22 burpees · 22 wall-ball shots 9/6 kg',15),
  ('heroes','The Seven','for_time','7 rondas: 7 HSPU · 7 thrusters 61 kg · 7 knees-to-elbows · 7 deadlifts 111 kg · 7 burpees · 7 kettlebell swings 32 kg · 7 pull-ups',16),
  ('heroes','Chad','for_time','1000 step-ups a cajón de 20" con mochila de 20/14 kg',17),
  ('heroes','Bull','for_time','2 rondas: 200 double-unders · 50 overhead squats 61/43 kg · 50 pull-ups · 1 milla run',18),
  ('heroes','Mr. Joshua','for_time','5 rondas: 400 m run · 30 GHD sit-ups · 15 deadlifts 113 kg',19),
  ('heroes','McGhee','amrap','AMRAP 30 min: 5 deadlifts 125 kg · 13 push-ups · 9 box jumps 24"',20),
  ('heroes','Lumberjack 20','for_time','20 deadlifts 125 kg · 400 m · 20 KB swings 32 kg · 400 m · 20 OHS 52 kg · 400 m · 20 burpees · 400 m · 20 chest-to-bar · 400 m · 20 box jumps 24" · 400 m · 20 dumbbell squat cleans 2×20 kg · 400 m',21),
  ('heroes','Tommy V','for_time','21 thrusters 52 kg · 12 rope climbs · 15 thrusters · 9 rope climbs · 9 thrusters · 6 rope climbs',22),
  ('heroes','Jerry','for_time','1 milla run · 2000 m row · 1 milla run',23),
  ('heroes','Hansen','for_time','5 rondas: 30 kettlebell swings 32 kg · 30 burpees · 30 GHD sit-ups',24),
  ('heroes','Abbate','for_time','1 milla run · 21 clean & jerks 70 kg · 800 m run · 21 clean & jerks · 1 milla run',25),
  ('heroes','Garrett','for_time','3 rondas: 75 air squats · 25 ring handstand push-ups · 25 L-pull-ups',26),
  ('heroes','Small','for_time','3 rondas: 1000 m row · 50 burpees · 50 box jumps 24" · 800 m run',27),
  ('heroes','Jack','amrap','AMRAP 20 min: 10 push presses 52/34 kg · 10 kettlebell swings 24/16 kg · 10 box jumps 24/20"',28),
  ('heroes','Luce','for_time','3 rondas con chaleco 9 kg: 1000 m run · 10 muscle-ups · 100 air squats',29),
  ('heroes','Manion','for_time','7 rondas: 400 m run · 29 back squats 61 kg',30),
  ('heroes','Tyler','for_time','5 rondas: 7 muscle-ups · 21 sumo deadlift high pulls 43 kg',31),
  ('heroes','Moore','amrap','AMRAP 20 min: 1 rope climb · 400 m run · máx. handstand push-ups',32),
  ('heroes','Wilmot','for_time','6 rondas: 50 air squats · 25 ring dips',33),
  ('heroes','RJ','for_time','5 rondas: 800 m run · 5 rope climbs · 50 push-ups',34),
  ('heroes','Roy','for_time','5 rondas: 15 deadlifts 102 kg · 20 box jumps 24" · 25 pull-ups',35),
  ('heroes','Severin','for_time','Con chaleco 9 kg: 50 strict pull-ups · 100 push-ups (hand-release) · 5 km run',36),
  ('heroes','Rankel','amrap','AMRAP 20 min: 6 deadlifts 102 kg · 7 burpee pull-ups · 10 kettlebell swings 32 kg · 200 m run',37),
  ('heroes','War Frank','for_time','3 rondas: 25 muscle-ups · 100 air squats · 35 GHD sit-ups',38),
  ('heroes','Clovis','for_time','10 millas run · 150 burpee pull-ups (se pueden partir)',39),
  ('classics','Filthy Fifty','for_time','50 box jumps 24" · 50 jumping pull-ups · 50 KB swings 16 kg · 50 walking lunges · 50 knees-to-elbows · 50 push presses 20 kg · 50 back extensions · 50 wall balls 9 kg · 50 burpees · 50 double-unders',0),
  ('classics','Fight Gone Bad','reps','3 rondas de 1 min por estación: wall balls 9/6 kg · sumo deadlift high pull 34/25 kg · box jumps 20" · push press 34/25 kg · remo (calorías). 1 min de descanso. Score: reps totales',1),
  ('classics','Nasty Girls','for_time','3 rondas: 50 air squats · 7 muscle-ups · 10 hang power cleans 61/43 kg',2),
  ('classics','CrossFit Total','load','Mejor back squat + strict press + deadlift (1RM de cada uno). Score: suma en kilos',3),
  ('lifts','Back squat','load','',0),
  ('lifts','Front squat','load','',1),
  ('lifts','Overhead squat','load','',2),
  ('lifts','Deadlift','load','',3),
  ('lifts','Sumo deadlift','load','',4),
  ('lifts','Bench press','load','',5),
  ('lifts','Strict press','load','',6),
  ('lifts','Push press','load','',7),
  ('lifts','Thruster','load','',8),
  ('olympic','Snatch','load','',0),
  ('olympic','Power snatch','load','',1),
  ('olympic','Hang snatch','load','',2),
  ('olympic','Squat snatch','load','',3),
  ('olympic','Clean','load','',4),
  ('olympic','Power clean','load','',5),
  ('olympic','Hang clean','load','',6),
  ('olympic','Squat clean','load','',7),
  ('olympic','Clean & jerk','load','',8),
  ('olympic','Push jerk','load','',9),
  ('olympic','Split jerk','load','',10),
  ('olympic','Snatch balance','load','',11),
  ('gymnastics','Pull-ups (máx. unbroken)','reps','',0),
  ('gymnastics','Strict pull-ups (máx.)','reps','',1),
  ('gymnastics','Chest-to-bar (máx.)','reps','',2),
  ('gymnastics','Bar muscle-ups (máx.)','reps','',3),
  ('gymnastics','Ring muscle-ups (máx.)','reps','',4),
  ('gymnastics','Strict HSPU (máx.)','reps','',5),
  ('gymnastics','Kipping HSPU (máx.)','reps','',6),
  ('gymnastics','Toes-to-bar (máx.)','reps','',7),
  ('gymnastics','Double-unders (máx. unbroken)','reps','',8),
  ('gymnastics','Handstand walk (máx.)','distance','',9),
  ('endurance','Remo 500 m','for_time','',0),
  ('endurance','Remo 2000 m','for_time','',1),
  ('endurance','Run 1 km','for_time','',2),
  ('endurance','Run 5 km','for_time','',3),
  ('endurance','Run 1 milla','for_time','',4),
  ('endurance','SkiErg 1000 m','for_time','',5),
  ('endurance','Assault Bike 50 cal','for_time','',6)
on conflict (category, name) do nothing;
