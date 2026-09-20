-- HU36: completar una lista existente con todos los articulos activos faltantes.

begin;

create or replace function public.agregar_productos_activos_lista(
  p_id_lista integer
)
returns table (
  productos_agregados bigint,
  productos_omitidos bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_productos_activos bigint;
  v_productos_agregados bigint;
begin
  if not exists (
    select 1
    from public.lista_precio
    where id_lista = p_id_lista
  ) then
    raise exception 'La lista de precios no existe';
  end if;

  select count(*)
    into v_productos_activos
  from public.articulo
  where estado is true;

  insert into public.detalle_lista_precio (
    id_lista,
    id_articulo,
    precio,
    porcentaje_descuento,
    porcentaje_recargo
  )
  select
    p_id_lista,
    a.id_articulo,
    a.precio_venta,
    0,
    0
  from public.articulo a
  where a.estado is true
    and a.precio_venta is not null
    and a.precio_venta > 0
  on conflict (id_lista, id_articulo) do nothing;

  get diagnostics v_productos_agregados = row_count;

  return query
  select
    v_productos_agregados,
    v_productos_activos - v_productos_agregados;
end;
$$;

grant execute
  on function public.agregar_productos_activos_lista(integer)
  to anon, authenticated;

commit;
