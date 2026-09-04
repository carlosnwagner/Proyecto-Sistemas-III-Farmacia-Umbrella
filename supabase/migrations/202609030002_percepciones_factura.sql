-- HU30: percepciones que pueden formar parte del total de una factura.
-- Si la base ya tiene el concepto de no gravado de migraciones previas, se elimina para simplificar la regla.
alter table public.factura_proveedor
  drop constraint if exists factura_proveedor_no_gravados_check;

alter table public.factura_proveedor
  drop column if exists conceptos_no_gravados;

alter table public.factura_proveedor
  add column if not exists percepcion_iva numeric(14, 2) not null default 0,
  add column if not exists percepcion_iibb numeric(14, 2) not null default 0;

alter table public.detalle_factura_proveedor
  add column if not exists tasa_iva numeric(5, 2) not null default 0;

alter table public.detalle_factura_proveedor
  drop constraint if exists detalle_factura_proveedor_tasa_iva_check;

alter table public.detalle_factura_proveedor
  add constraint detalle_factura_proveedor_tasa_iva_check
    check (tasa_iva in (0, 10.5, 21));

alter table public.factura_proveedor
  drop constraint if exists factura_proveedor_importes_consistentes_check;

alter table public.factura_proveedor
  add constraint factura_proveedor_percepciones_check
    check (percepcion_iva >= 0 and percepcion_iibb >= 0),
  add constraint factura_proveedor_importes_consistentes_check
    check (abs(importe_total - (subtotal + iva + conceptos_exentos + percepcion_iva + percepcion_iibb)) <= 0.01);