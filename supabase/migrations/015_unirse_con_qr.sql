-- =====================================================================
-- 015 · Alta de atletas con QR
--  - Cada box tiene un código de unión (el del QR) que el admin puede cambiar
--  - join_mode: 'approval' (por defecto, el admin acepta cada alta) u 'open'
--  - box_members.pending: solicitud esperando aprobación (con active = false no ve nada)
-- =====================================================================

alter table public.boxes add column if not exists join_code text;
alter table public.boxes add column if not exists join_mode text not null default 'approval';
alter table public.boxes drop constraint if exists boxes_join_mode_check;
alter table public.boxes add constraint boxes_join_mode_check check (join_mode in ('approval', 'open'));
update public.boxes set join_code = substr(md5(random()::text || clock_timestamp()::text), 1, 12) where join_code is null;
alter table public.boxes alter column join_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 12);
alter table public.boxes alter column join_code set not null;
create unique index if not exists boxes_join_code_idx on public.boxes(join_code);

alter table public.box_members add column if not exists pending boolean not null default false;
create index if not exists box_members_pending_idx on public.box_members(box_id) where pending;

-- Rutas nuevas que no pueden ser dirección de un box
create or replace function public.slug_reserved(p_slug text)
returns boolean language sql immutable set search_path = '' as $$
  select p_slug = any (array['www','app','api','admin','auth','login','logout','invitacion','inactivo','ayuda','boxes','box',
    'nuevo','nuevo-box','d','r','wod','coach','ranking','historial','marcas','medallas','mensajes','perfil','atleta','avisos',
    'mail','email','static','assets','cdn','status','blog','help','soporte','dromos','dromosclub','demo','test','dev','staging',
    'unirse','cartel','manual']);
$$;
