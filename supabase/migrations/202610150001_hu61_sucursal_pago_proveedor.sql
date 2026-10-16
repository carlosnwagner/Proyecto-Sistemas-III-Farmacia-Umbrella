-- HU61, primera etapa. Aplicar antes de desplegar el formulario actualizado.
-- Los históricos permanecen sin sucursal hasta su conciliación explícita.
begin;

alter table public.pago_proveedor
  add column if not exists id_sucursal integer references public.sucursal(id_sucursal);

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.pago_proveedor'::regclass and conname='pago_proveedor_id_sucursal_fkey'
  ) then
    alter table public.pago_proveedor add constraint pago_proveedor_id_sucursal_fkey
      foreign key (id_sucursal) references public.sucursal(id_sucursal);
  end if;
end $$;

create index if not exists pago_proveedor_sucursal_fecha_idx
  on public.pago_proveedor(id_sucursal, fecha_pago);

comment on column public.pago_proveedor.id_sucursal is
  'Sucursal del desembolso. NULL solo para históricos pendientes de conciliación HU61.';

create or replace function public.hu61_validar_sucursal_pago()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- El administrador es el rol de Gestión existente; no se agrega otro rol.
  if auth.uid() is null or not exists (
    select 1 from public.usuario u
    where u.auth_id = auth.uid() and u.estado is true and u.rol = 'administrador'
  ) then
    raise exception 'Necesitás una sesión de administrador activa para asignar la sucursal del pago';
  end if;
  if new.id_sucursal is null then
    raise exception 'Seleccioná la sucursal del pago';
  end if;
  if not exists (
    select 1 from public.sucursal s
    where s.id_sucursal = new.id_sucursal and s.estado is true
  ) then
    raise exception 'La sucursal del pago no está disponible';
  end if;
  return new;
end; $$;

drop trigger if exists hu61_validar_sucursal_pago on public.pago_proveedor;
create trigger hu61_validar_sucursal_pago
  before insert or update of id_sucursal on public.pago_proveedor
  for each row execute function public.hu61_validar_sucursal_pago();

revoke all on function public.hu61_validar_sucursal_pago() from public, anon, authenticated;

commit;
