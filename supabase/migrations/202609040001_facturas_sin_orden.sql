-- Permite registrar facturas de servicios o gastos sin orden de compra.
-- Separa el tipo de comprobante de la letra de factura.

alter table public.factura_proveedor
  add column if not exists tipo_factura text;

alter table public.factura_proveedor
  drop constraint if exists factura_proveedor_tipo_comprobante_check;
alter table public.factura_proveedor
  drop constraint if exists factura_proveedor_importe_total_check;
alter table public.factura_proveedor
  drop constraint if exists factura_proveedor_importes_consistentes_check;

alter table public.factura_proveedor
  alter column id_orden_compra drop not null;

update public.factura_proveedor
set tipo_factura = case
  when tipo_comprobante ilike '% A' then 'A'
  when tipo_comprobante ilike '% B' then 'B'
  else 'A'
end,
    tipo_comprobante = 'Factura'
where tipo_factura is null;

alter table public.factura_proveedor
  add constraint factura_proveedor_tipo_comprobante_check
    check (tipo_comprobante = 'Factura');

alter table public.factura_proveedor
  alter column tipo_factura set default 'A',
  alter column tipo_factura set not null;

alter table public.factura_proveedor
  drop constraint if exists factura_proveedor_tipo_factura_check;
alter table public.factura_proveedor
  add constraint factura_proveedor_tipo_factura_check
    check (tipo_factura in ('A', 'B'));

alter table public.factura_proveedor
  add constraint factura_proveedor_importes_consistentes_check
    check (abs(importe_total - (subtotal + iva + percepcion_iva + percepcion_iibb)) <= 0.01);

drop index if exists public.factura_proveedor_comprobante_unique_idx;
alter table public.factura_proveedor
  drop constraint if exists factura_proveedor_comprobante_unique;
alter table public.factura_proveedor
  add constraint factura_proveedor_comprobante_unique
    unique (id_proveedor, tipo_comprobante, tipo_factura, punto_venta, numero_comprobante);

alter table public.detalle_factura_proveedor
  add column if not exists descripcion text;

alter table public.detalle_factura_proveedor
  alter column id_articulo drop not null;

alter table public.detalle_factura_proveedor
  drop constraint if exists detalle_factura_proveedor_articulo_check;

create or replace function public.validar_detalle_factura_proveedor()
returns trigger
language plpgsql
as $$
declare
  factura_orden bigint;
  detalle_orden bigint;
  detalle_articulo integer;
begin
  select id_orden_compra into factura_orden
  from public.factura_proveedor
  where id_factura_proveedor = new.id_factura_proveedor;

  if new.id_detalle_orden_compra is not null then
    select id_orden_compra, id_articulo
      into detalle_orden, detalle_articulo
    from public.detalle_orden_compra
    where id_detalle_orden = new.id_detalle_orden_compra;

    if factura_orden is null or detalle_orden <> factura_orden then
      raise exception 'El detalle de la orden no coincide con la orden de la factura';
    end if;
    if detalle_articulo <> new.id_articulo then
      raise exception 'El articulo del detalle de factura no coincide con la orden';
    end if;
  elsif factura_orden is not null then
    raise exception 'Una factura asociada a una orden debe usar sus detalles';
  end if;

  if new.id_articulo is null and nullif(trim(new.descripcion), '') is null then
    raise exception 'Un detalle manual debe tener una descripcion';
  end if;

  return new;
end;
$$;
