-- «dia» es la pantalla Día completo: no puede ser el slug de un box
create or replace function public.slug_reserved(p_slug text)
 returns boolean language sql immutable set search_path to ''
as $function$
  select p_slug = any (array['www','app','api','admin','auth','login','logout','invitacion','inactivo','ayuda','boxes','box',
    'nuevo','nuevo-box','d','r','wod','coach','ranking','historial','marcas','medallas','mensajes','perfil','atleta','avisos',
    'mail','email','static','assets','cdn','status','blog','help','soporte','dromos','dromosclub','demo','test','dev','staging',
    'unirse','cartel','manual','dia']);
$function$;
