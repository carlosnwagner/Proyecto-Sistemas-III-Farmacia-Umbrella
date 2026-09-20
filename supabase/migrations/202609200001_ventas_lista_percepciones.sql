-- Integración de ventas con la lista global de precios y percepciones manuales.

begin;

alter table public.venta
  add column if not exists id_lista integer references public.lista_precio(id_lista),
  add column if not exists percepcion_iva numeric(14, 2) not null default 0,
  add column if not exists percepcion_iibb numeric(14, 2) not null default 0;

alter table public.venta
  drop constraint if exists venta_percepciones_desglosadas_check;

alter table public.venta
  add constraint venta_percepciones_desglosadas_check
    check (percepcion_iva >= 0 and percepcion_iibb >= 0);

alter table public.detalle_venta
  add column if not exists alicuota_iva numeric(4, 1);

alter table public.detalle_venta
  drop constraint if exists detalle_venta_alicuota_iva_check;

alter table public.detalle_venta
  add constraint detalle_venta_alicuota_iva_check
    check (alicuota_iva in (0, 10.5, 21));

comment on column public.venta.id_lista is
  'Lista de precios global vigente utilizada al confirmar la venta.';
comment on column public.venta.percepcion_iva is
  'Percepción de IVA cargada manualmente y sumada al total.';
comment on column public.venta.percepcion_iibb is
  'Percepción de Ingresos Brutos cargada manualmente y sumada al total.';
comment on column public.detalle_venta.alicuota_iva is
  'Alícuota histórica aplicada al detalle al momento de la venta.';

commit;
