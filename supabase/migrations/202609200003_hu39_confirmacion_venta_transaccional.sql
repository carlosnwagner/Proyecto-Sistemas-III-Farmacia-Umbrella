-- HU39: confirmación atómica de venta, pago y egresos de stock.

begin;

alter table public.venta
  add column if not exists idempotency_key uuid;

create unique index if not exists venta_idempotency_key_unique
  on public.venta (idempotency_key)
  where idempotency_key is not null;

-- Los datos históricos contienen comprobantes duplicados creados por el
-- mecanismo anterior. La garantía se aplica a las ventas nuevas, identificadas
-- por su clave de idempotencia, sin renumerar documentación ya emitida.
create unique index if not exists venta_comprobante_nuevo_unique
  on public.venta (punto_venta, numero_comprobante)
  where idempotency_key is not null;

create or replace function public.confirmar_venta_transaccional(
  p_idempotency_key uuid,
  p_id_sucursal integer,
  p_id_deposito integer,
  p_id_cliente integer,
  p_tipo_comprobante text,
  p_id_lista integer,
  p_items jsonb,
  p_id_medio_pago integer,
  p_importe_pagado numeric,
  p_referencia_pago text default null,
  p_percepcion_iva numeric default 0,
  p_percepcion_iibb numeric default 0
)
returns setof public.venta
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existente public.venta%rowtype;
  v_venta public.venta%rowtype;
  v_item jsonb;
  v_inventario public.articulo_deposito%rowtype;
  v_precio numeric(14, 2);
  v_alicuota numeric(4, 1);
  v_cantidad integer;
  v_subtotal numeric(14, 2);
  v_neto_21 numeric(14, 2) := 0;
  v_iva_21 numeric(14, 2) := 0;
  v_neto_105 numeric(14, 2) := 0;
  v_iva_105 numeric(14, 2) := 0;
  v_exento numeric(14, 2) := 0;
  v_total_productos numeric(14, 2) := 0;
  v_total numeric(14, 2);
  v_punto_venta integer := 1;
  v_numero integer;
  v_medio_nombre text;
  v_medio_codigo text;
begin
  if p_idempotency_key is null then
    raise exception 'La clave de idempotencia es obligatoria';
  end if;

  select * into v_existente
  from public.venta
  where idempotency_key = p_idempotency_key;

  if found then
    return next v_existente;
    return;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener al menos un producto';
  end if;

  if upper(coalesce(p_tipo_comprobante, '')) not in ('A', 'B') then
    raise exception 'El tipo de comprobante debe ser A o B';
  end if;

  if not exists (
    select 1 from public.deposito d
    where d.id_deposito = p_id_deposito
      and d.id_sucursal = p_id_sucursal
      and d.estado is true
  ) then
    raise exception 'El depósito no pertenece a la sucursal o se encuentra inactivo';
  end if;

  if jsonb_array_length(p_items) <> (
    select count(distinct (item->>'id_articulo_deposito'))
    from jsonb_array_elements(p_items) item
  ) then
    raise exception 'Un producto no puede repetirse en el detalle de la venta';
  end if;

  if coalesce(p_percepcion_iva, 0) < 0 or coalesce(p_percepcion_iibb, 0) < 0 then
    raise exception 'Las percepciones no pueden ser negativas';
  end if;

  if not exists (
    select 1 from public.lista_precio lp
    where lp.id_lista = p_id_lista
      and lp.estado is true
      and lp.fecha_inicio <= current_date
      and (lp.fecha_fin is null or lp.fecha_fin >= current_date)
  ) then
    raise exception 'La lista de precios ya no se encuentra vigente';
  end if;

  select mp.nombre, mp.codigo
    into v_medio_nombre, v_medio_codigo
  from public.medio_pago mp
  where mp.id_medio_pago = p_id_medio_pago
    and mp.estado is true;

  if not found then
    raise exception 'El medio de pago no existe o está inactivo';
  end if;

  if v_medio_codigo <> 'EFECTIVO' and nullif(trim(coalesce(p_referencia_pago, '')), '') is null then
    raise exception 'La referencia del pago es obligatoria';
  end if;

  -- Bloquea y valida todo el inventario antes de efectuar la primera escritura.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    if v_cantidad <= 0 then
      raise exception 'La cantidad vendida debe ser mayor que cero';
    end if;

    select * into v_inventario
    from public.articulo_deposito ad
    where ad.id_articulo_deposito = (v_item->>'id_articulo_deposito')::integer
      and ad.id_articulo = (v_item->>'id_articulo')::integer
      and ad.id_deposito = p_id_deposito
      and ad.estado is true
    for update;

    if not found then
      raise exception 'El producto no está habilitado en el depósito seleccionado';
    end if;
    if v_inventario.stock_actual < v_cantidad then
      raise exception 'Stock insuficiente para el artículo %: disponible %, solicitado %',
        v_inventario.id_articulo, v_inventario.stock_actual, v_cantidad;
    end if;

    select dlp.precio_final, a.alicuota_iva
      into v_precio, v_alicuota
    from public.detalle_lista_precio dlp
    join public.articulo a on a.id_articulo = dlp.id_articulo
    where dlp.id_lista = p_id_lista
      and dlp.id_articulo = v_inventario.id_articulo;

    if not found or v_precio is null or v_precio <= 0 or v_alicuota is null then
      raise exception 'El artículo % no posee precio o IVA válido en la lista vigente', v_inventario.id_articulo;
    end if;

    v_subtotal := round(v_precio * v_cantidad, 2);
    v_total_productos := v_total_productos + v_subtotal;

    if v_alicuota = 0 then
      v_exento := v_exento + v_subtotal;
    elsif v_alicuota = 10.5 then
      v_neto_105 := v_neto_105 + round(v_subtotal / 1.105, 2);
      v_iva_105 := v_iva_105 + (v_subtotal - round(v_subtotal / 1.105, 2));
    elsif v_alicuota = 21 then
      v_neto_21 := v_neto_21 + round(v_subtotal / 1.21, 2);
      v_iva_21 := v_iva_21 + (v_subtotal - round(v_subtotal / 1.21, 2));
    else
      raise exception 'Alícuota de IVA no admitida para el artículo %', v_inventario.id_articulo;
    end if;
  end loop;

  v_total := round(v_total_productos + coalesce(p_percepcion_iva, 0) + coalesce(p_percepcion_iibb, 0), 2);
  if p_importe_pagado is null or p_importe_pagado < v_total then
    raise exception 'El importe pagado no cubre el total de la venta';
  end if;

  -- Serializa la numeración del punto de venta para impedir comprobantes duplicados.
  perform pg_advisory_xact_lock(v_punto_venta);
  select coalesce(max(numero_comprobante), 0) + 1 into v_numero
  from public.venta
  where punto_venta = v_punto_venta;

  insert into public.venta (
    id_sucursal, id_deposito, id_cliente, tipo_comprobante,
    punto_venta, numero_comprobante, fecha, medio_pago,
    neto_21, iva_21, neto_105, iva_105, exento,
    percepcion_iva, percepcion_iibb, percepciones,
    importe_total, estado, id_lista, idempotency_key
  ) values (
    p_id_sucursal, p_id_deposito, p_id_cliente, p_tipo_comprobante,
    v_punto_venta, v_numero, now(), v_medio_nombre,
    round(v_neto_21, 2), round(v_iva_21, 2), round(v_neto_105, 2), round(v_iva_105, 2), round(v_exento, 2),
    round(coalesce(p_percepcion_iva, 0), 2), round(coalesce(p_percepcion_iibb, 0), 2),
    round(coalesce(p_percepcion_iva, 0) + coalesce(p_percepcion_iibb, 0), 2),
    v_total, 'Confirmada', p_id_lista, p_idempotency_key
  ) returning * into v_venta;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;

    select * into v_inventario
    from public.articulo_deposito ad
    where ad.id_articulo_deposito = (v_item->>'id_articulo_deposito')::integer;

    select dlp.precio_final, a.alicuota_iva
      into v_precio, v_alicuota
    from public.detalle_lista_precio dlp
    join public.articulo a on a.id_articulo = dlp.id_articulo
    where dlp.id_lista = p_id_lista
      and dlp.id_articulo = v_inventario.id_articulo;

    v_subtotal := round(v_precio * v_cantidad, 2);

    insert into public.detalle_venta (
      id_venta, id_articulo, cantidad, precio_unitario, subtotal, alicuota_iva
    ) values (
      v_venta.id_venta, v_inventario.id_articulo, v_cantidad, v_precio, v_subtotal, v_alicuota
    );

    update public.articulo_deposito
    set stock_actual = stock_actual - v_cantidad
    where id_articulo_deposito = v_inventario.id_articulo_deposito
      and stock_actual >= v_cantidad;

    if not found then
      raise exception 'No fue posible descontar el stock del artículo %', v_inventario.id_articulo;
    end if;

    insert into public.movimiento_stock (
      id_articulo_deposito, id_deposito, tipo_movimiento, cantidad
    ) values (
      v_inventario.id_articulo_deposito, p_id_deposito, 'EGRESO', v_cantidad
    );
  end loop;

  insert into public.pago_venta (
    id_venta, id_medio_pago, importe, referencia
  ) values (
    v_venta.id_venta, p_id_medio_pago, round(p_importe_pagado, 2), nullif(trim(coalesce(p_referencia_pago, '')), '')
  );

  return next v_venta;
end;
$$;

revoke all on function public.confirmar_venta_transaccional(uuid, integer, integer, integer, text, integer, jsonb, integer, numeric, text, numeric, numeric) from public;
grant execute on function public.confirmar_venta_transaccional(uuid, integer, integer, integer, text, integer, jsonb, integer, numeric, text, numeric, numeric) to anon, authenticated;

create or replace function public.bloquear_edicion_venta_confirmada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.estado = 'Confirmada' then
    raise exception 'Una venta confirmada no puede modificarse ni eliminarse directamente';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists venta_confirmada_inmutable on public.venta;
create trigger venta_confirmada_inmutable
before update or delete on public.venta
for each row execute function public.bloquear_edicion_venta_confirmada();

commit;
