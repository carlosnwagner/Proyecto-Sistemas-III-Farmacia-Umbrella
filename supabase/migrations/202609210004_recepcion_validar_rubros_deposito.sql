-- La recepción respeta los rubros/prefijos permitidos por cada depósito.

begin;

create or replace function public.registrar_recepcion_orden_compra_deposito(
  p_id_orden_compra integer,
  p_id_deposito integer,
  p_recepciones jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_item jsonb;
  v_detalle public.detalle_orden_compra%rowtype;
  v_inventario public.articulo_deposito%rowtype;
  v_cantidad numeric;
  v_total integer;
  v_completos integer;
  v_rubros_permitidos text;
  v_codigo_articulo text;
  v_prefijo_articulo text;
begin
  select estado into v_estado
  from public.orden_compra
  where id_orden_compra = p_id_orden_compra
  for update;

  if not found then
    raise exception 'La orden de compra no existe';
  end if;
  if v_estado in ('Borrador', 'Cancelada', 'Cerrada', 'Recibida') then
    raise exception 'La orden no se encuentra disponible para recepción';
  end if;

  select rubros_permitidos into v_rubros_permitidos
  from public.deposito
  where id_deposito = p_id_deposito and estado is true;

  if not found then
    raise exception 'El depósito receptor no existe o se encuentra inactivo';
  end if;
  if p_recepciones is null or jsonb_typeof(p_recepciones) <> 'array'
     or jsonb_array_length(p_recepciones) = 0 then
    raise exception 'Debe indicar al menos un artículo recibido';
  end if;
  if jsonb_array_length(p_recepciones) <> (
    select count(distinct item->>'id_detalle_orden')
    from jsonb_array_elements(p_recepciones) item
  ) then
    raise exception 'No se puede repetir un detalle de la orden';
  end if;

  for v_item in select value from jsonb_array_elements(p_recepciones)
  loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad <= 0 or trunc(v_cantidad) <> v_cantidad then
      raise exception 'La cantidad recibida debe ser un número entero mayor que cero';
    end if;

    select * into v_detalle
    from public.detalle_orden_compra
    where id_detalle_orden = (v_item->>'id_detalle_orden')::integer
      and id_orden_compra = p_id_orden_compra
    for update;

    if not found then
      raise exception 'Uno de los detalles no pertenece a la orden';
    end if;
    if coalesce(v_detalle.cantidad_recibida, 0) + v_cantidad > v_detalle.cantidad_solicitada then
      raise exception 'La recepción del artículo % supera la cantidad pendiente', v_detalle.id_articulo;
    end if;

    select codigo into v_codigo_articulo
    from public.articulo
    where id_articulo = v_detalle.id_articulo and estado is true;

    if not found then
      raise exception 'El artículo % no existe o se encuentra inactivo', v_detalle.id_articulo;
    end if;

    v_prefijo_articulo := upper(split_part(trim(coalesce(v_codigo_articulo, '')), '-', 1));
    if nullif(trim(coalesce(v_rubros_permitidos, '')), '') is not null
       and not (
         v_prefijo_articulo = any(
           string_to_array(replace(upper(v_rubros_permitidos), ' ', ''), ',')
         )
       ) then
      raise exception 'El artículo % (rubro %) no es compatible con el depósito seleccionado',
        v_codigo_articulo, coalesce(nullif(v_prefijo_articulo, ''), 'SIN ETIQUETA');
    end if;

    insert into public.articulo_deposito (
      id_articulo, id_deposito, stock_actual, stock_minimo, estado
    ) values (
      v_detalle.id_articulo, p_id_deposito, 0, 0, true
    )
    on conflict (id_articulo, id_deposito) do update set estado = true
    returning * into v_inventario;

    update public.articulo_deposito
    set stock_actual = coalesce(stock_actual, 0) + v_cantidad::integer
    where id_articulo_deposito = v_inventario.id_articulo_deposito;

    insert into public.movimiento_stock (
      id_articulo_deposito, id_deposito, tipo_movimiento, cantidad
    ) values (
      v_inventario.id_articulo_deposito, p_id_deposito, 'INGRESO', v_cantidad::integer
    );

    update public.detalle_orden_compra
    set cantidad_recibida = coalesce(cantidad_recibida, 0) + v_cantidad::integer
    where id_detalle_orden = v_detalle.id_detalle_orden;
  end loop;

  select count(*), count(*) filter (
    where coalesce(cantidad_recibida, 0) >= cantidad_solicitada
  ) into v_total, v_completos
  from public.detalle_orden_compra
  where id_orden_compra = p_id_orden_compra;

  v_estado := case when v_total > 0 and v_total = v_completos then 'Recibida' else 'Pendiente' end;
  update public.orden_compra set estado = v_estado where id_orden_compra = p_id_orden_compra;

  return v_estado;
end;
$$;

revoke all on function public.registrar_recepcion_orden_compra_deposito(integer, integer, jsonb) from public;
grant execute on function public.registrar_recepcion_orden_compra_deposito(integer, integer, jsonb) to anon, authenticated;

commit;
