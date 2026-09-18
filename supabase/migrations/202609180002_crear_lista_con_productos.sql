-- HU36: crear una lista inactiva con todos los articulos activos.
-- La operacion es atomica: si falla la cabecera o algun detalle, no se guarda nada.

begin;

create or replace function public.crear_lista_precio_con_productos(
  p_nombre text,
  p_descripcion text,
  p_fecha_inicio date,
  p_fecha_fin date default null
)
returns table (
  id_lista integer,
  productos_agregados bigint,
  productos_omitidos bigint
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id_lista integer;
  v_productos_activos bigint;
  v_productos_agregados bigint;
begin
  if nullif(trim(p_nombre), '') is null then
    raise exception 'El nombre de la lista es obligatorio';
  end if;

  if p_fecha_inicio is null then
    raise exception 'La fecha de inicio es obligatoria';
  end if;

  if p_fecha_fin is not null and p_fecha_fin < p_fecha_inicio then
    raise exception 'La fecha final no puede ser anterior a la fecha inicial';
  end if;

  select count(*)
    into v_productos_activos
  from public.articulo
  where estado is true;

  insert into public.lista_precio (
    nombre,
    descripcion,
    fecha_inicio,
    fecha_fin,
    estado
  ) values (
    trim(p_nombre),
    nullif(trim(p_descripcion), ''),
    p_fecha_inicio,
    p_fecha_fin,
    false
  )
  returning lista_precio.id_lista into v_id_lista;

  insert into public.detalle_lista_precio (
    id_lista,
    id_articulo,
    precio,
    porcentaje_descuento,
    porcentaje_recargo
  )
  select
    v_id_lista,
    a.id_articulo,
    a.precio_venta,
    0,
    0
  from public.articulo a
  where a.estado is true
    and a.precio_venta is not null
    and a.precio_venta > 0;

  get diagnostics v_productos_agregados = row_count;

  return query
  select
    v_id_lista,
    v_productos_agregados,
    v_productos_activos - v_productos_agregados;
end;
$$;

grant execute
  on function public.crear_lista_precio_con_productos(text, text, date, date)
  to anon, authenticated;

commit;
