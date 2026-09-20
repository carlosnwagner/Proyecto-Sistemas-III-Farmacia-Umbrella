-- Clasificacion impositiva del articulo para precios al publico con IVA incluido.
-- Regla simplificada adoptada por el proyecto:
-- MED se inicializa en 10.5 % y los demas rubros en 21 %.
-- La condicion puede corregirse manualmente a exento en reventa cuando corresponda.

begin;

alter table public.articulo
  add column if not exists alicuota_iva numeric(4, 1);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'articulo_alicuota_iva_check'
      and conrelid = 'public.articulo'::regclass
  ) then
    alter table public.articulo
      add constraint articulo_alicuota_iva_check
      check (alicuota_iva is null or alicuota_iva in (0, 10.5, 21));
  end if;
end;
$$;

-- La clasificacion inicial se deriva del prefijo del codigo interno.
update public.articulo
set alicuota_iva = case
  when upper(codigo) like 'MED-%' then 10.5
  else 21
end
where alicuota_iva is null
  and codigo is not null;

comment on column public.articulo.alicuota_iva is
  'Alicuota contenida en el precio al publico: 21, 10.5 o 0 para exento en reventa. Null requiere revision.';

create or replace function public.validar_iva_productos_lista_activa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado is true and exists (
    select 1
    from public.detalle_lista_precio dlp
    join public.articulo a on a.id_articulo = dlp.id_articulo
    where dlp.id_lista = new.id_lista
      and a.alicuota_iva is null
  ) then
    raise exception 'No se puede activar la lista: existen productos sin tratamiento de IVA definido';
  end if;

  return new;
end;
$$;

drop trigger if exists lista_precio_validar_iva_productos
  on public.lista_precio;
create trigger lista_precio_validar_iva_productos
before insert or update of estado
on public.lista_precio
for each row execute function public.validar_iva_productos_lista_activa();

commit;
