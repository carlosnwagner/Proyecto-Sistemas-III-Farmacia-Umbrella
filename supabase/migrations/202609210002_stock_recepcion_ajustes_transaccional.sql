-- Recepción de mercadería y ajustes de stock atómicos.
-- articulo_deposito.stock_actual es el saldo operativo y movimiento_stock su auditoría.

begin;

-- Normaliza saldos creados por la implementación anterior, que registraba
-- algunos ingresos solamente en movimiento_stock. No modifica asociaciones
-- que todavía no poseen movimientos.
update public.articulo_deposito ad
set stock_actual = greatest(0, resumen.saldo)
from (
  select
    id_articulo_deposito,
    sum(
      case
        when upper(coalesce(tipo_movimiento, '')) like '%EGRESO%'
          or upper(coalesce(tipo_movimiento, '')) like '%MERMA%'
          or upper(coalesce(tipo_movimiento, '')) like '%ROTURA%'
          or upper(coalesce(tipo_movimiento, '')) like '%VENCIMIENTO%'
          or upper(coalesce(tipo_movimiento, '')) like '%VENTA%'
        then -abs(cantidad)
        else abs(cantidad)
      end
    )::integer as saldo
  from public.movimiento_stock
  group by id_articulo_deposito
) resumen
where resumen.id_articulo_deposito = ad.id_articulo_deposito;

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
  if not exists (
    select 1 from public.deposito where id_deposito = p_id_deposito and estado is true
  ) then
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

create or replace function public.registrar_ajuste_stock(
  p_id_deposito integer,
  p_tipo_movimiento text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_inventario public.articulo_deposito%rowtype;
  v_cantidad integer;
  v_es_egreso boolean;
begin
  if upper(coalesce(p_tipo_movimiento, '')) not in ('INGRESO', 'INGRESO_INICIAL', 'MERMA_ROTURA', 'VENCIMIENTO') then
    raise exception 'Tipo de ajuste no admitido';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Debe indicar al menos un producto para ajustar';
  end if;
  if jsonb_array_length(p_items) <> (
    select count(distinct item->>'id_articulo_deposito') from jsonb_array_elements(p_items) item
  ) then
    raise exception 'No se puede repetir un producto en el ajuste';
  end if;

  v_es_egreso := upper(p_tipo_movimiento) in ('MERMA_ROTURA', 'VENCIMIENTO');

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Las cantidades deben ser mayores que cero';
    end if;

    select * into v_inventario
    from public.articulo_deposito
    where id_articulo_deposito = (v_item->>'id_articulo_deposito')::integer
      and id_deposito = p_id_deposito
      and estado is true
    for update;

    if not found then
      raise exception 'El producto no está habilitado en el depósito';
    end if;
    if v_es_egreso and coalesce(v_inventario.stock_actual, 0) < v_cantidad then
      raise exception 'Stock insuficiente para realizar el ajuste';
    end if;

    update public.articulo_deposito
    set stock_actual = coalesce(stock_actual, 0) + case when v_es_egreso then -v_cantidad else v_cantidad end
    where id_articulo_deposito = v_inventario.id_articulo_deposito;

    insert into public.movimiento_stock (
      id_articulo_deposito, id_deposito, id_lote, tipo_movimiento, cantidad
    ) values (
      v_inventario.id_articulo_deposito,
      p_id_deposito,
      nullif(v_item->>'id_lote', '')::integer,
      upper(p_tipo_movimiento),
      v_cantidad
    );
  end loop;
end;
$$;

revoke all on function public.registrar_recepcion_orden_compra_deposito(integer, integer, jsonb) from public;
revoke all on function public.registrar_ajuste_stock(integer, text, jsonb) from public;
grant execute on function public.registrar_recepcion_orden_compra_deposito(integer, integer, jsonb) to anon, authenticated;
grant execute on function public.registrar_ajuste_stock(integer, text, jsonb) to anon, authenticated;

comment on function public.registrar_recepcion_orden_compra_deposito(integer, integer, jsonb) is
  'Recibe mercadería en un depósito, incrementa stock y actualiza la orden atómicamente.';

commit;
