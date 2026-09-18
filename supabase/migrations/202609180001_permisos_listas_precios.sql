-- HU36: permisos minimos para administrar listas desde la aplicacion.
-- El proyecto actualmente opera con la clave publica (rol anon).

begin;

grant select, insert, update
  on table public.lista_precio
  to anon, authenticated;

grant select, insert, update, delete
  on table public.detalle_lista_precio
  to anon, authenticated;

grant usage, select
  on sequence public.lista_precio_id_lista_seq
  to anon, authenticated;

grant usage, select
  on sequence public.detalle_lista_precio_id_detalle_lista_seq
  to anon, authenticated;

grant execute
  on function public.obtener_precio_vigente(integer, date)
  to anon, authenticated;

commit;
