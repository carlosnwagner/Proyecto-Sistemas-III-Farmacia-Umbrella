-- Cada sucursal posee un punto de venta único para numerar sus comprobantes.

begin;

alter table public.sucursal
  add column if not exists punto_venta integer;

-- Se usa el identificador estable de la sucursal como valor inicial. Las ventas
-- históricas conservan el punto de venta con el que fueron emitidas.
update public.sucursal
set punto_venta = id_sucursal
where punto_venta is null;

alter table public.sucursal
  alter column punto_venta set not null;

alter table public.sucursal
  drop constraint if exists sucursal_punto_venta_rango_check;

alter table public.sucursal
  add constraint sucursal_punto_venta_rango_check
    check (punto_venta between 1 and 9999);

create unique index if not exists sucursal_punto_venta_unique
  on public.sucursal (punto_venta);

comment on column public.sucursal.punto_venta is
  'Punto de venta único utilizado para numerar los comprobantes emitidos por la sucursal.';

create or replace function public.asignar_punto_y_numero_venta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select s.punto_venta
    into new.punto_venta
  from public.sucursal s
  where s.id_sucursal = new.id_sucursal
    and s.estado is true;

  if not found then
    raise exception 'La sucursal no existe o se encuentra inactiva';
  end if;

  -- Un bloqueo distinto por punto de venta permite numerar sucursales en
  -- paralelo sin generar comprobantes duplicados dentro de una misma serie.
  perform pg_advisory_xact_lock(1000000 + new.punto_venta);

  select coalesce(max(v.numero_comprobante), 0) + 1
    into new.numero_comprobante
  from public.venta v
  where v.punto_venta = new.punto_venta;

  return new;
end;
$$;

drop trigger if exists venta_asignar_punto_y_numero on public.venta;
create trigger venta_asignar_punto_y_numero
before insert on public.venta
for each row execute function public.asignar_punto_y_numero_venta();

commit;
