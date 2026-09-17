-- HU36: adaptar las tablas de listas de precios que ya existen en Supabase.
-- Este script conserva los nombres y datos actuales:
--   lista_precio(id_lista, fecha_inicio, fecha_fin, estado)
--   detalle_lista_precio(id_detalle_lista, id_lista, id_articulo, precio,
--                        porcentaje_descuento)

begin;

-- La fecha final es opcional: null significa vigente hasta nuevo aviso.
alter table public.lista_precio
  alter column fecha_fin drop not null;

alter table public.lista_precio
  alter column estado set default false;

alter table public.lista_precio
  add column if not exists updated_at timestamptz not null default now();

-- Se reutiliza porcentaje_descuento y se agrega solamente el recargo.
update public.detalle_lista_precio
set porcentaje_descuento = 0
where porcentaje_descuento is null;

alter table public.detalle_lista_precio
  alter column porcentaje_descuento set default 0,
  alter column porcentaje_descuento set not null;

alter table public.detalle_lista_precio
  add column if not exists porcentaje_recargo numeric(7, 2) not null default 0;

alter table public.detalle_lista_precio
  add column if not exists updated_at timestamptz not null default now();

-- El tipo se deriva para evitar que contradiga los porcentajes guardados.
alter table public.detalle_lista_precio
  add column if not exists tipo_ajuste text
  generated always as (
    case
      when porcentaje_descuento > 0 then 'Descuento'
      when porcentaje_recargo > 0 then 'Recargo'
      else 'Sin ajuste'
    end
  ) stored;

-- El precio final se deriva siempre del precio base y del ajuste.
alter table public.detalle_lista_precio
  add column if not exists precio_final numeric(14, 2)
  generated always as (
    round(
      case
        when porcentaje_descuento > 0 then precio * (1 - porcentaje_descuento / 100)
        when porcentaje_recargo > 0 then precio * (1 + porcentaje_recargo / 100)
        else precio
      end,
      2
    )
  ) stored;

-- Restricciones agregadas de forma idempotente para permitir reintentos.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lista_precio_nombre_check'
      and conrelid = 'public.lista_precio'::regclass
  ) then
    alter table public.lista_precio
      add constraint lista_precio_nombre_check
      check (length(trim(nombre)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lista_precio_fechas_check'
      and conrelid = 'public.lista_precio'::regclass
  ) then
    alter table public.lista_precio
      add constraint lista_precio_fechas_check
      check (fecha_fin is null or fecha_fin >= fecha_inicio);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'detalle_lista_precio_positivo_check'
      and conrelid = 'public.detalle_lista_precio'::regclass
  ) then
    alter table public.detalle_lista_precio
      add constraint detalle_lista_precio_positivo_check
      check (precio > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'detalle_lista_porcentaje_ajuste_check'
      and conrelid = 'public.detalle_lista_precio'::regclass
  ) then
    alter table public.detalle_lista_precio
      add constraint detalle_lista_porcentaje_ajuste_check
      check (
        porcentaje_descuento >= 0
        and porcentaje_descuento < 100
        and porcentaje_recargo >= 0
        and not (porcentaje_descuento > 0 and porcentaje_recargo > 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'detalle_lista_precio_final_check'
      and conrelid = 'public.detalle_lista_precio'::regclass
  ) then
    alter table public.detalle_lista_precio
      add constraint detalle_lista_precio_final_check
      check (precio_final > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'detalle_lista_articulo_unique'
      and conrelid = 'public.detalle_lista_precio'::regclass
  ) then
    alter table public.detalle_lista_precio
      add constraint detalle_lista_articulo_unique
      unique (id_lista, id_articulo);
  end if;
end;
$$;

create index if not exists lista_precio_vigencia_idx
  on public.lista_precio (estado, fecha_inicio, fecha_fin);

create index if not exists detalle_lista_precio_articulo_idx
  on public.detalle_lista_precio (id_articulo);

-- Una lista con estado=true es activa. Se impiden vigencias activas ambiguas.
create or replace function public.validar_vigencia_lista_precio()
returns trigger
language plpgsql
as $$
begin
  if new.estado is true and exists (
    select 1
    from public.lista_precio lp
    where lp.estado is true
      and lp.id_lista <> coalesce(new.id_lista, 0)
      and daterange(lp.fecha_inicio, lp.fecha_fin, '[]')
          && daterange(new.fecha_inicio, new.fecha_fin, '[]')
  ) then
    raise exception 'Ya existe una lista de precios activa para parte de la vigencia indicada';
  end if;

  return new;
end;
$$;

drop trigger if exists lista_precio_vigencia_unica on public.lista_precio;
create trigger lista_precio_vigencia_unica
before insert or update of fecha_inicio, fecha_fin, estado
on public.lista_precio
for each row execute function public.validar_vigencia_lista_precio();

create or replace function public.actualizar_lista_precio_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lista_precio_actualizar_fecha on public.lista_precio;
create trigger lista_precio_actualizar_fecha
before update on public.lista_precio
for each row execute function public.actualizar_lista_precio_updated_at();

drop trigger if exists detalle_lista_precio_actualizar_fecha
  on public.detalle_lista_precio;
create trigger detalle_lista_precio_actualizar_fecha
before update on public.detalle_lista_precio
for each row execute function public.actualizar_lista_precio_updated_at();

-- Devuelve el precio aplicable o ninguna fila cuando el articulo no tiene
-- precio vigente. La pantalla de ventas debe tratar ese caso como un bloqueo.
create or replace function public.obtener_precio_vigente(
  p_id_articulo integer,
  p_fecha_venta date default current_date
)
returns table (
  id_lista integer,
  nombre_lista text,
  precio_base numeric,
  tipo_ajuste text,
  porcentaje_ajuste numeric,
  precio_final numeric
)
language sql
stable
as $$
  select
    lp.id_lista,
    lp.nombre::text,
    dlp.precio,
    dlp.tipo_ajuste,
    case
      when dlp.tipo_ajuste = 'Descuento' then dlp.porcentaje_descuento
      when dlp.tipo_ajuste = 'Recargo' then dlp.porcentaje_recargo
      else 0
    end,
    dlp.precio_final
  from public.lista_precio lp
  join public.detalle_lista_precio dlp
    on dlp.id_lista = lp.id_lista
  where dlp.id_articulo = p_id_articulo
    and lp.estado is true
    and lp.fecha_inicio <= p_fecha_venta
    and (lp.fecha_fin is null or lp.fecha_fin >= p_fecha_venta)
  order by lp.fecha_inicio desc
  limit 1;
$$;

commit;
