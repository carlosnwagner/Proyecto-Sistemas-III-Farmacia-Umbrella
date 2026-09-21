-- Registro atómico de facturas de proveedor y sus detalles.
-- Evita cabeceras huérfanas cuando falla algún renglón.

begin;

-- Restricción heredada que ignoraba tipo, letra y punto de venta.
alter table public.factura_proveedor
  drop constraint if exists uq_factura_proveedor_comprobante;

create or replace function public.registrar_factura_proveedor_transaccional(
  p_id_proveedor bigint,
  p_id_orden_compra bigint,
  p_tipo_comprobante text,
  p_tipo_factura text,
  p_punto_venta integer,
  p_numero_comprobante text,
  p_fecha date,
  p_subtotal numeric,
  p_iva numeric,
  p_conceptos_exentos numeric,
  p_percepcion_iva numeric,
  p_percepcion_iibb numeric,
  p_importe_total numeric,
  p_detalle jsonb
)
returns setof public.factura_proveedor
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factura public.factura_proveedor%rowtype;
  v_item jsonb;
  v_numero text := lpad(trim(coalesce(p_numero_comprobante, '')), 8, '0');
begin
  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La factura debe contener al menos un detalle';
  end if;

  -- Si un intento anterior dejó una cabecera sin detalles, pagos ni notas,
  -- se reutiliza y completa dentro de esta misma transacción.
  select * into v_factura
  from public.factura_proveedor
  where id_proveedor = p_id_proveedor
    and tipo_comprobante = p_tipo_comprobante
    and tipo_factura = p_tipo_factura
    and punto_venta = p_punto_venta
    and numero_comprobante = v_numero
  for update;

  if found then
    if exists (
      select 1 from public.detalle_factura_proveedor
      where id_factura_proveedor = v_factura.id_factura_proveedor
    ) or exists (
      select 1 from public.detalle_pago
      where id_factura_proveedor = v_factura.id_factura_proveedor
    ) or exists (
      select 1 from public.nota_credito_debito_proveedor
      where id_factura_proveedor = v_factura.id_factura_proveedor
    ) then
      raise exception using
        errcode = '23505',
        message = 'El comprobante ya está registrado para el proveedor seleccionado';
    end if;

    update public.factura_proveedor
    set id_orden_compra = p_id_orden_compra,
        fecha = p_fecha,
        subtotal = p_subtotal,
        iva = p_iva,
        conceptos_exentos = coalesce(p_conceptos_exentos, 0),
        percepcion_iva = coalesce(p_percepcion_iva, 0),
        percepcion_iibb = coalesce(p_percepcion_iibb, 0),
        importe_total = p_importe_total,
        estado = 'Pendiente'
    where id_factura_proveedor = v_factura.id_factura_proveedor
    returning * into v_factura;
  else
    insert into public.factura_proveedor (
      id_proveedor, id_orden_compra, tipo_comprobante, tipo_factura,
      punto_venta, numero_comprobante, fecha, subtotal, iva,
      conceptos_exentos, percepcion_iva, percepcion_iibb, importe_total
    ) values (
      p_id_proveedor, p_id_orden_compra, p_tipo_comprobante, p_tipo_factura,
      p_punto_venta, v_numero, p_fecha, p_subtotal, p_iva,
      coalesce(p_conceptos_exentos, 0), coalesce(p_percepcion_iva, 0),
      coalesce(p_percepcion_iibb, 0), p_importe_total
    ) returning * into v_factura;
  end if;

  for v_item in select value from jsonb_array_elements(p_detalle)
  loop
    insert into public.detalle_factura_proveedor (
      id_factura_proveedor, id_detalle_orden_compra, id_articulo,
      descripcion, cantidad, precio_unitario, tasa_iva
    ) values (
      v_factura.id_factura_proveedor,
      nullif(v_item->>'id_detalle_orden_compra', '')::integer,
      nullif(v_item->>'id_articulo', '')::integer,
      nullif(trim(coalesce(v_item->>'descripcion', '')), ''),
      (v_item->>'cantidad')::numeric,
      (v_item->>'precio_unitario')::numeric,
      coalesce((v_item->>'tasa_iva')::numeric, 0)
    );
  end loop;

  return next v_factura;
end;
$$;

revoke all on function public.registrar_factura_proveedor_transaccional(bigint, bigint, text, text, integer, text, date, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) from public;
grant execute on function public.registrar_factura_proveedor_transaccional(bigint, bigint, text, text, integer, text, date, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) to anon, authenticated;

comment on function public.registrar_factura_proveedor_transaccional(bigint, bigint, text, text, integer, text, date, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) is
  'Registra cabecera y detalle de una factura de proveedor en una sola transacción.';

commit;
